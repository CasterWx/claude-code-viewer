import sqlite3
import subprocess
import os
import json
import re
import difflib
from pathlib import Path
from typing import Dict, Any, List, Optional
from .storage import Storage

class Analytics:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.storage = Storage(db_path)

    def get_stats(self) -> Dict[str, Any]:
        """Aggregate stats from the DB."""
        with sqlite3.connect(self.db_path) as db:
            total_projects = db.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
            total_sessions = db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
            total_messages = db.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
            
            # Messages over time (group by day) - limit to last 30 days
            daily_activity = db.execute("""
                SELECT 
                    date(m.timestamp), 
                    count(m.id),
                    count(DISTINCT s.id),
                    count(DISTINCT s.project_name)
                FROM messages m
                JOIN sessions s ON m.session_id = s.id
                WHERE m.timestamp IS NOT NULL 
                GROUP BY date(m.timestamp) 
                ORDER BY date(m.timestamp) DESC 
                LIMIT 365
            """).fetchall()

            # Stats by Tag
            tag_stats_rows = db.execute("""
                SELECT t.name, t.color, count(DISTINCT s.id) as sessions, count(m.id) as messages
                FROM tags t
                JOIN session_tags st ON t.id = st.tag_id
                JOIN sessions s ON st.session_id = s.id
                LEFT JOIN messages m ON s.id = m.session_id
                GROUP BY t.id
            """).fetchall()
            
            tag_stats = [
                {"name": r[0], "color": r[1], "sessions": r[2], "messages": r[3]} 
                for r in tag_stats_rows
            ]

            # Token Stats
            total_tokens = db.execute("SELECT SUM(total_tokens) FROM sessions").fetchone()[0] or 0
            
            # Model Usage
            model_stats_rows = db.execute("""
                SELECT model, count(*) 
                FROM sessions 
                WHERE model IS NOT NULL 
                GROUP BY model
            """).fetchall()
            model_stats = [{"model": r[0], "count": r[1]} for r in model_stats_rows]

            # Hourly Activity
            hourly_activity_rows = db.execute("""
                SELECT strftime('%H', timestamp) as hour, count(*)
                FROM messages
                WHERE timestamp IS NOT NULL
                GROUP BY hour
                ORDER BY hour
            """).fetchall()
            
            # Fill all 24 hours
            hourly_map = {int(r[0]): r[1] for r in hourly_activity_rows if r[0] is not None}
            hourly_activity = [{"hour": h, "count": hourly_map.get(h, 0)} for h in range(24)]

        # Find the most used model
        most_used_model = "Unknown"
        if model_stats:
            most_used_model = max(model_stats, key=lambda x: x['count'])['model']
            
        return {
            "total_projects": total_projects,
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "total_tokens": total_tokens,
            "most_used_model": most_used_model,
            "daily_activity": [{"date": r[0], "count": r[1], "sessions": r[2], "projects": r[3]} for r in daily_activity],
            "tag_stats": tag_stats,
            "model_stats": model_stats,
            "hourly_activity": hourly_activity
        }

    def get_project_details(self, project_name: str) -> Optional[Dict[str, Any]]:
        """Get detailed stats and info for a specific project."""
        with sqlite3.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            project = db.execute("SELECT * FROM projects WHERE name = ?", (project_name,)).fetchone()
            
            if not project:
                return None
                
            path = project['path']
            
            # Aggregate stats
            stats = db.execute("""
                SELECT 
                    count(s.id) as sessions, 
                    sum(s.total_tokens) as tokens,
                    max(s.start_time) as last_active
                FROM sessions s 
                WHERE s.project_name = ?
            """, (project_name,)).fetchone()
            
            message_count = db.execute("""
                SELECT count(m.id) 
                FROM messages m 
                JOIN sessions s ON m.session_id = s.id 
                WHERE s.project_name = ?
            """, (project_name,)).fetchone()[0]
            
            # Git Info
            git_branch = None
            if path and os.path.isdir(path):
                try:
                    # Check if it's a git repo and get branch
                    result = subprocess.run(
                        ['git', 'branch', '--show-current'], 
                        cwd=path, 
                        capture_output=True, 
                        text=True, 
                        timeout=1
                    )
                    if result.returncode == 0:
                        git_branch = result.stdout.strip()
                except Exception:
                    pass
            
            # Config Files
            config_files = []
            if path and os.path.isdir(path):
                try:
                     # Check root claude.json
                    root_config = Path(path) / "claude.json"
                    if root_config.exists():
                        config_files.append({"name": "claude.json", "path": str(root_config)})
                        
                    # Check .claude directory
                    claude_dir = Path(path) / ".claude"
                    if claude_dir.exists() and claude_dir.is_dir():
                        for f in claude_dir.glob("*"):
                            if f.is_file() and not f.name.startswith('.'):
                                config_files.append({"name": f".claude/{f.name}", "path": str(f)})
                except Exception:
                    pass

            return {
                "name": project['name'],
                "path": path,
                "last_updated": project['last_updated'],
                "stats": {
                    "sessions": stats['sessions'] or 0,
                    "messages": message_count,
                    "tokens": stats['tokens'] or 0,
                    "last_active": stats['last_active']
                },
                "git": {
                    "is_repo": bool(git_branch),
                    "branch": git_branch
                },
                "configs": config_files
            }

    def get_session_changes(self, session_id: str) -> List[Dict[str, Any]]:
        """Extracts file changes from a session's messages."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            
            c.execute("""
                SELECT content, timestamp 
                FROM messages 
                WHERE session_id = ? AND role = 'assistant'
                ORDER BY timestamp ASC
            """, (session_id,))
            
            messages = c.fetchall()
        
        changes = []
        
        # Regex to find tool-use blocks
        # Format: <tool-use name="ToolName">\n{JSON}\n</tool-use>
        tool_pattern = re.compile(r'<tool-use name="([^"]+)">\n(.*?)\n</tool-use>', re.DOTALL)
        
        for msg_row in messages:
            content = msg_row['content']
            timestamp = msg_row['timestamp']
            
            for match in tool_pattern.finditer(content):
                tool_name = match.group(1)
                input_json = match.group(2)
                
                # Check heuristics
                if any(x in tool_name.lower() for x in ['write', 'edit', 'replace', 'create', 'append']):
                    try:
                        input_data = json.loads(input_json)
                        
                        path = (
                            input_data.get('path') or 
                            input_data.get('file_path') or 
                            input_data.get('TargetFile') or
                            input_data.get('filename') or
                            input_data.get('target_file') or
                            input_data.get('file')
                        )
                        
                        if path:
                            # Extract content or diff
                            file_content = (
                                input_data.get('content') or 
                                input_data.get('code') or 
                                input_data.get('file_content') or
                                input_data.get('CodeContent') or 
                                input_data.get('ReplacementContent') or
                                input_data.get('new_string')
                            )
                            
                            target_content = (
                                input_data.get('TargetContent') or
                                input_data.get('old_string')
                            )
                            
                            # Handle chunks for multi-replace
                            if 'ReplacementChunks' in input_data:
                                chunks = input_data['ReplacementChunks']
                                if isinstance(chunks, list):
                                    targets = []
                                    replacements = []
                                    for i, chunk in enumerate(chunks):
                                        targets.append(chunk.get('TargetContent', ''))
                                        replacements.append(chunk.get('ReplacementContent', ''))
                                    
                                    # Use aggregated contents
                                    if not file_content:
                                        file_content = "\n\n... [unchanged] ...\n\n".join(replacements)
                                    if not target_content:
                                        target_content = "\n\n... [unchanged] ...\n\n".join(targets)
                            
                            # Handle 'edits' list (another format)
                            elif 'edits' in input_data:
                                edits = input_data['edits']
                                if isinstance(edits, list):
                                    targets = []
                                    replacements = []
                                    for i, edit in enumerate(edits):
                                        targets.append(edit.get('old_string', ''))
                                        replacements.append(edit.get('new_string', ''))
                                    
                                    if not file_content:
                                        file_content = "\n\n... [unchanged] ...\n\n".join(replacements)
                                    if not target_content:
                                        target_content = "\n\n... [unchanged] ...\n\n".join(targets)

                            # Generate Diff
                            # Parse content into lines, handling potential None
                            target_lines = (target_content or '').splitlines()
                            file_lines = (file_content or '').splitlines()
                            
                            diff = ""
                            try:
                                diff = '\n'.join(difflib.unified_diff(
                                    target_lines, 
                                    file_lines, 
                                    fromfile='Original', 
                                    tofile='New', 
                                    lineterm=''
                                ))
                            except Exception:
                                pass

                            change_type = 'write'
                            if 'replace' in tool_name.lower() or 'edit' in tool_name.lower():
                                change_type = 'edit'
                                
                            changes.append({
                                'tool': tool_name,
                                'type': change_type,
                                'path': path,
                                'timestamp': timestamp,
                                'content': file_content,
                                'target_content': target_content,
                                'diff': diff
                            })
                            
                    except json.JSONDecodeError:
                        continue
                        
        return changes

