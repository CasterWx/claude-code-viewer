import sqlite3
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging
import threading

logger = logging.getLogger(__name__)


class Storage:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._lock = threading.Lock()  # Thread lock for write operations
        self.init_db()

    def init_db(self):
        """Initialize the database schema."""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        # Enable WAL mode for better concurrent performance
        c.execute("PRAGMA journal_mode=WAL")
        c.execute("PRAGMA synchronous=NORMAL")
        
        # Projects table
        c.execute('''CREATE TABLE IF NOT EXISTS projects (
            name TEXT PRIMARY KEY,
            path TEXT,
            last_updated TIMESTAMP
        )''')
        
        # Sessions table
        c.execute('''CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            project_name TEXT,
            file_path TEXT,
            start_time TIMESTAMP,
            model TEXT,
            total_tokens INTEGER,
            FOREIGN KEY(project_name) REFERENCES projects(name)
        )''')
        
        # Check if columns exist (migration for existing DB)
        try:
            c.execute("ALTER TABLE sessions ADD COLUMN model TEXT")
        except sqlite3.OperationalError:
            pass # Column exists
            
        try:
            c.execute("ALTER TABLE sessions ADD COLUMN total_tokens INTEGER")
        except sqlite3.OperationalError:
            pass # Column exists

        try:
            c.execute("ALTER TABLE sessions ADD COLUMN file_change_count INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass # Column exists

        try:
            c.execute("ALTER TABLE projects ADD COLUMN path TEXT")
        except sqlite3.OperationalError:
            pass # Column exists

        # New columns for Session details
        for col, type_ in [
            ("input_tokens", "INTEGER DEFAULT 0"),
            ("output_tokens", "INTEGER DEFAULT 0"),
            ("turns", "INTEGER DEFAULT 0"),
            ("branch", "TEXT"),
            ("token_usage_history", "TEXT"),
            ("total_duration_seconds", "INTEGER DEFAULT 0"),
            ("user_duration_seconds", "INTEGER DEFAULT 0"),
            ("model_duration_seconds", "INTEGER DEFAULT 0"),
            ("total_messages", "INTEGER DEFAULT 0"),
            ("tool_stats", "TEXT"),
            ("read_write_ratio", "REAL DEFAULT 0"),
            ("nav_miss_rate", "REAL DEFAULT 0"),
            ("avg_prompt_len", "REAL DEFAULT 0")
        ]:
            try:
                c.execute(f"ALTER TABLE sessions ADD COLUMN {col} {type_}")
            except sqlite3.OperationalError:
                pass
        
        # Messages table with FTS
        c.execute('''CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            role TEXT,
            content TEXT,
            timestamp TIMESTAMP,
            FOREIGN KEY(session_id) REFERENCES sessions(id)
        )''')
        
        # FTS table for full-text search on content
        c.execute('''CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
            content,
            content_rowid UNINDEXED
        )''')
        
        # Tags table
        c.execute('''CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            color TEXT
        )''')

        # Session Tags mapping
        c.execute('''CREATE TABLE IF NOT EXISTS session_tags (
            session_id TEXT,
            tag_id INTEGER,
            PRIMARY KEY (session_id, tag_id),
            FOREIGN KEY(session_id) REFERENCES sessions(id),
            FOREIGN KEY(tag_id) REFERENCES tags(id)
        )''')
        
        conn.commit()
        conn.close()

    def save_session(self, project_name: str, session_data: Dict[str, Any], messages: List[Dict[str, Any]], metadata: Dict[str, Any] = None, project_path: str = None):
        """Save a session and its messages to the DB. Thread-safe."""
        if metadata is None:
            metadata = {}

        with self._lock:  # Ensure thread-safe database access
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            c = conn.cursor()

            try:
                # Insert/Update Project
                c.execute("INSERT OR IGNORE INTO projects (name, path, last_updated) VALUES (?, ?, datetime('now'))", (project_name, project_path))
                if project_path:
                    c.execute("UPDATE projects SET path = ?, last_updated = datetime('now') WHERE name = ?", (project_path, project_name))
                else:
                    c.execute("UPDATE projects SET last_updated = datetime('now') WHERE name = ?", (project_name,))

                # Insert/Update Session
                c.execute("""
                    INSERT OR REPLACE INTO sessions (
                        id, project_name, file_path, start_time, model,
                        total_tokens, input_tokens, output_tokens, turns, branch, token_usage_history,
                        file_change_count, total_duration_seconds, user_duration_seconds, model_duration_seconds,
                        total_messages, tool_stats, read_write_ratio, nav_miss_rate, avg_prompt_len
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    session_data['session_id'],
                    project_name,
                    session_data['file_path'],
                    messages[0]['timestamp'] if messages else None,
                    metadata.get('model'),
                    metadata.get('total_tokens', 0),
                    metadata.get('input_tokens', 0),
                    metadata.get('output_tokens', 0),
                    metadata.get('turns', 0),
                    metadata.get('branch'),
                    json.dumps(metadata.get('token_usage_history', [])),
                    metadata.get('file_change_count', 0),
                    metadata.get('total_duration_seconds', 0),
                    metadata.get('user_duration_seconds', 0),
                    metadata.get('model_duration_seconds', 0),
                    metadata.get('total_messages', 0),
                    json.dumps(metadata.get('tool_stats', {})),
                    metadata.get('read_write_ratio', 0.0),
                    metadata.get('nav_miss_rate', 0.0),
                    metadata.get('avg_prompt_len', 0.0)
                ))

                # Insert Messages
                c.execute("DELETE FROM messages WHERE session_id = ?", (session_data['session_id'],))
                c.execute("DELETE FROM messages_fts WHERE content_rowid IN (SELECT id FROM messages WHERE session_id = ?)", (session_data['session_id'],))

                for msg in messages:
                    c.execute("INSERT INTO messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
                              (session_data['session_id'], msg['role'], msg.get('content', ''), msg['timestamp']))

                    # Index for search
                    row_id = c.lastrowid
                    c.execute("INSERT INTO messages_fts (content_rowid, content) VALUES (?, ?)", (row_id, msg.get('content', '')))

                conn.commit()
            finally:
                conn.close()

    def save_sessions_batch(self, sessions_data: List[tuple], progress_callback=None):
        """
        Batch save multiple sessions in a single transaction for better performance.

        Args:
            sessions_data: List of (project_name, session_data, messages, metadata, project_path) tuples
            progress_callback: Optional callback(completed_count) to report progress
        """
        if not sessions_data:
            return

        with self._lock:
            conn = sqlite3.connect(self.db_path, timeout=60.0)
            c = conn.cursor()

            try:
                # Use a single transaction for all inserts
                c.execute("BEGIN TRANSACTION")

                for i, (project_name, session_data, messages, metadata, project_path) in enumerate(sessions_data):
                    if metadata is None:
                        metadata = {}

                    # Insert/Update Project
                    c.execute("INSERT OR IGNORE INTO projects (name, path, last_updated) VALUES (?, ?, datetime('now'))", (project_name, project_path))
                    if project_path:
                        c.execute("UPDATE projects SET path = ?, last_updated = datetime('now') WHERE name = ?", (project_path, project_name))
                    else:
                        c.execute("UPDATE projects SET last_updated = datetime('now') WHERE name = ?", (project_name,))

                    # Insert/Update Session
                    c.execute("""
                        INSERT OR REPLACE INTO sessions (
                            id, project_name, file_path, start_time, model,
                            total_tokens, input_tokens, output_tokens, turns, branch, token_usage_history,
                            file_change_count, total_duration_seconds, user_duration_seconds, model_duration_seconds,
                            total_messages, tool_stats, read_write_ratio, nav_miss_rate, avg_prompt_len
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        session_data['session_id'],
                        project_name,
                        session_data['file_path'],
                        messages[0]['timestamp'] if messages else None,
                        metadata.get('model'),
                        metadata.get('total_tokens', 0),
                        metadata.get('input_tokens', 0),
                        metadata.get('output_tokens', 0),
                        metadata.get('turns', 0),
                        metadata.get('branch'),
                        json.dumps(metadata.get('token_usage_history', [])),
                        metadata.get('file_change_count', 0),
                        metadata.get('total_duration_seconds', 0),
                        metadata.get('user_duration_seconds', 0),
                        metadata.get('model_duration_seconds', 0),
                        metadata.get('total_messages', 0),
                        json.dumps(metadata.get('tool_stats', {})),
                        metadata.get('read_write_ratio', 0.0),
                        metadata.get('nav_miss_rate', 0.0),
                        metadata.get('avg_prompt_len', 0.0)
                    ))

                    # Delete old messages
                    c.execute("DELETE FROM messages WHERE session_id = ?", (session_data['session_id'],))

                    # Insert Messages
                    for msg in messages:
                        c.execute("INSERT INTO messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
                                  (session_data['session_id'], msg['role'], msg.get('content', ''), msg['timestamp']))
                        row_id = c.lastrowid
                        c.execute("INSERT INTO messages_fts (content_rowid, content) VALUES (?, ?)", (row_id, msg.get('content', '')))

                    if progress_callback and (i + 1) % 50 == 0:
                        progress_callback(i + 1)

                conn.commit()

                if progress_callback:
                    progress_callback(len(sessions_data))

            except Exception as e:
                conn.rollback()
                raise e
            finally:
                conn.close()

    def cleanup_orphaned_sessions(self, valid_session_ids: set) -> int:
        """
        Remove sessions from database that no longer exist in file system.

        Args:
            valid_session_ids: Set of session IDs that exist in file system

        Returns:
            Number of orphaned sessions removed
        """
        with self._lock:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            c = conn.cursor()

            try:
                # Get all session IDs in database
                c.execute("SELECT id FROM sessions")
                db_session_ids = set(row[0] for row in c.fetchall())

                # Find orphaned sessions
                orphaned_ids = db_session_ids - valid_session_ids

                if orphaned_ids:
                    # Delete orphaned sessions and their messages
                    placeholders = ','.join('?' * len(orphaned_ids))
                    orphaned_list = list(orphaned_ids)

                    c.execute(f"DELETE FROM messages WHERE session_id IN ({placeholders})", orphaned_list)
                    c.execute(f"DELETE FROM messages_fts WHERE content_rowid IN (SELECT id FROM messages WHERE session_id IN ({placeholders}))", orphaned_list)
                    c.execute(f"DELETE FROM session_tags WHERE session_id IN ({placeholders})", orphaned_list)
                    c.execute(f"DELETE FROM sessions WHERE id IN ({placeholders})", orphaned_list)

                    conn.commit()
                    logger.info(f"Cleaned up {len(orphaned_ids)} orphaned sessions")

                return len(orphaned_ids)
            finally:
                conn.close()

    def get_projects(self) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        sql = '''
            SELECT 
                p.name, 
                p.path,
                MAX(s.start_time) as last_updated,
                COUNT(s.id) as session_count,
                SUM(s.total_tokens) as total_tokens,
                SUM(s.turns) as total_turns,
                SUM(s.file_change_count) as total_files
            FROM projects p
            LEFT JOIN sessions s ON p.name = s.project_name
            GROUP BY p.name
            HAVING COUNT(s.id) > 0
            ORDER BY last_updated DESC
        '''
        c.execute(sql)
        projects = [dict(row) for row in c.fetchall()]
        conn.close()
        return projects

    def get_sessions(self, project_name: str) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Get sessions with tags
        sql = '''
            SELECT s.*, 
                   group_concat(t.name) as tag_names,
                   group_concat(t.color) as tag_colors
            FROM sessions s
            LEFT JOIN session_tags st ON s.id = st.session_id
            LEFT JOIN tags t ON st.tag_id = t.id
            WHERE s.project_name = ?
            GROUP BY s.id
            ORDER BY s.start_time DESC
        '''
        c.execute(sql, (project_name,))
        
        results = []
        for row in c.fetchall():
            d = dict(row)
            if d['tag_names']:
                names = d['tag_names'].split(',')
                colors = d['tag_colors'].split(',') if d['tag_colors'] else ['#gray'] * len(names)
                d['tags'] = [{'name': n, 'color': c} for n, c in zip(names, colors)]
            else:
                d['tags'] = []
            results.append(d)
            
        conn.close()
        return results

    def get_messages(self, session_id: str) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC", (session_id,))
        messages = [dict(row) for row in c.fetchall()]
        conn.close()
        return messages

    def search_messages(self, query: str) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        # Join with sessions and projects to give context
        sql = '''
            SELECT m.*, s.project_name, s.id as session_id
            FROM messages m
            JOIN messages_fts fts ON m.id = fts.content_rowid
            JOIN sessions s ON m.session_id = s.id
            WHERE fts.content MATCH ?
            ORDER BY m.timestamp DESC
            LIMIT 50
        '''
        c.execute(sql, (query,))
        results = [dict(row) for row in c.fetchall()]
        conn.close()
        return results

    def get_all_tags(self) -> List[Dict[str, str]]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM tags ORDER BY name")
        tags = [dict(row) for row in c.fetchall()]
        conn.close()
        return tags

    def add_tag(self, name: str, color: str = "blue") -> int:
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)", (name, color))
        c.execute("SELECT id FROM tags WHERE name = ?", (name,))
        tag_id = c.fetchone()[0]
        conn.commit()
        conn.close()
        return tag_id

    def tag_session(self, session_id: str, tag_name: str, color: str = "blue"):
        tag_id = self.add_tag(tag_name, color)
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("INSERT OR IGNORE INTO session_tags (session_id, tag_id) VALUES (?, ?)", (session_id, tag_id))
        conn.commit()
        conn.close()

    def untag_session(self, session_id: str, tag_name: str):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            DELETE FROM session_tags 
            WHERE session_id = ? AND tag_id IN (SELECT id FROM tags WHERE name = ?)
        ''', (session_id, tag_name))
        conn.commit()
        conn.close()
