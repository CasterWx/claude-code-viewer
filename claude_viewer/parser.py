import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Generator
from datetime import datetime
import urllib.parse

logger = logging.getLogger(__name__)

class LogParser:
    def __init__(self, log_dir: Path):
        self.log_dir = log_dir

    def scan_projects(self) -> Generator[Dict[str, Any], None, None]:
        """Scans the log directory for projects and sessions."""
        if not self.log_dir.exists():
            logger.warning(f"Log directory {self.log_dir} does not exist.")
            return

        for project_dir in self.log_dir.iterdir():
            if project_dir.is_dir():
                raw_project_name = project_dir.name
                # Try to use existence check to reconstruct path
                # Standard replacement (often wrong if names have hyphens)
                decoded = raw_project_name.replace('-', '/')
                
                project_path = decoded
                if decoded.startswith('/Users') or decoded.startswith('/home'):
                    reconstructed = self._reconstruct_path(decoded)
                    if reconstructed:
                        project_path = str(reconstructed)
                        project_name = reconstructed.name
                    else:
                         project_name = Path(decoded).name
                else:
                    project_name = raw_project_name

                for log_file in project_dir.glob("*.jsonl"):
                    yield {
                        "project": project_name,
                        "project_path": project_path,
                        "file_path": str(log_file),
                        "session_id": log_file.stem
                    }
    
    def _reconstruct_path(self, decoded_path: str) -> Path | None:
        """
        Attempts to reconstruct the real path from a decoded path (where / became -).
        Since we don't know which -s were originally /s and which were part of the name,
        we walk the path and check for existence.
        
        Args:
            decoded_path: e.g. /Users/wangxiaohu03/Desktop/claude/code/viewer
                          (Originally might be /Users/wangxiaohu03/Desktop/claude-code-viewer)
        """
        parts = decoded_path.strip('/').split('/')
        if not parts:
            return None
            
        current = Path('/')
        i = 0
        while i < len(parts):
            # Try simplest: just next component
            candidate = parts[i]
            test_path = current / candidate
            
            if test_path.exists():
                current = test_path
                i += 1
            else:
                # Does not exist. Maybe part of a hyphenated name?
                # Look ahead to see if merging with next components works
                found_merge = False
                merged_candidate = candidate
                # Try merging up to 3 components (heuristic limit to avoid long loops)
                for j in range(i + 1, min(i + 4, len(parts))):
                    merged_candidate += '-' + parts[j]
                    test_merge_path = current / merged_candidate
                    if test_merge_path.exists():
                        current = test_merge_path
                        i = j + 1
                        found_merge = True
                        break
                
                if not found_merge:
                    # If we can't find it, we just proceed with the original assumption 
                    # or stop if we want to be strict. For now, best effort:
                    current = current / candidate
                    i += 1
                    
        return current if current.exists() else None

    def parse_session(self, file_path: str) -> Dict[str, Any]:
        """Parses a single JSONL session file."""
        messages = []
        metadata = {
            "model": None,
            "total_tokens": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "turns": 0,
            "branch": None,
            "token_usage_history": [],
            "modified_files": set()
        }
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                        
                        # Determine role and content based on schema
                        role = None
                        content = ""
                        timestamp = data.get("timestamp")

                        # Extract metadata from assistant messages
                        if "message" in data:
                            msg_obj = data["message"]
                            if msg_obj.get("model"):
                                metadata["model"] = msg_obj["model"]
                            if msg_obj.get("usage"):
                                usage = msg_obj["usage"]
                                i_tokens = usage.get("input_tokens", 0)
                                o_tokens = usage.get("output_tokens", 0)
                                metadata["input_tokens"] += i_tokens
                                metadata["output_tokens"] += o_tokens
                                metadata["total_tokens"] += (i_tokens + o_tokens)
                                
                                # Record history point
                                metadata["token_usage_history"].append({
                                    "timestamp": timestamp or datetime.now().isoformat(),
                                    "input": metadata["input_tokens"],  # Cumulative
                                    "output": metadata["output_tokens"], # Cumulative
                                    "total": metadata["total_tokens"]
                                })

                        # Case 1: Legacy/Simple format {"role": "...", "content": "..."}
                        if "role" in data:
                            role = data["role"]
                            content = data.get("content", "")
                        
                        # Case 2: New format {"type": "user", "message": {...}}
                        elif "type" in data and data["type"] in ["user", "assistant"]:
                            msg_obj = data.get("message", {})
                            role = msg_obj.get("role")
                            
                            if role == "user":
                                metadata["turns"] += 1

                            raw_content = msg_obj.get("content")
                            
                            if isinstance(raw_content, list):
                                # Extract text from blocks
                                text_parts = []
                                for block in raw_content:
                                    if block.get("type") == "text":
                                        text_parts.append(block.get("text", ""))
                                    elif block.get("type") == "tool_use":
                                        # Format as custom tag for frontend rendering
                                        input_block = block.get('input', {})
                                        input_json = json.dumps(input_block, indent=2)
                                        text_parts.append(f"\n<tool-use name=\"{block.get('name')}\">\n{input_json}\n</tool-use>\n")
                                        
                                        # Track modified files
                                        tool_name = block.get('name', '')
                                        # Heuristic: Check common file manipulation tool names
                                        # Covers: write_to_file, replace_file_content, edit_file, create_file, etc.
                                        if any(x in tool_name.lower() for x in ['write', 'edit', 'replace', 'create', 'append']):
                                            # Try all common path keys
                                            path = (
                                                input_block.get('path') or 
                                                input_block.get('file_path') or 
                                                input_block.get('TargetFile') or
                                                input_block.get('filename') or
                                                input_block.get('target_file') or
                                                input_block.get('file')
                                            )
                                            if path:
                                                metadata["modified_files"].add(path)
                                                metadata["modified_files"].add(path)
                                        
                                        # Heuristic: Detect Git Branch from command
                                        if tool_name == "run_command":
                                            cmd = input_block.get('command', '')
                                            # Look for simple git branch checks
                                            # e.g. git branch --show-current
                                            if "git branch" in cmd or "git status" in cmd:
                                                pass # Ideally we look at tool_result next, but that's hard to correlate in this single pass easily without state.
                                                # Actually, sometimes agents output the branch in the thought process or finding it is hard.
                                                # But we can try to look at 'tool_result' blocks if we had state.
                                                # Simplified: Just check if we see tool_result later? 
                                                # For now, let's leave branch as None unless we find a very obvious indicator.
                                                pass
                                    elif block.get("type") == "tool_result":
                                        content_str = block.get('content', '')
                                        # Truncate very long results for display if needed, but for now keep full
                                        # Check if it's a list (some results are lists of blocks)
                                        if isinstance(content_str, list):
                                            # specific logic for list content in tool result?
                                            # often it's text w/ embedded images or just text
                                            # simple serialization for now
                                            content_str = json.dumps(content_str)
                                            
                                        text_parts.append(f"\n<tool-result>\n{content_str}\n</tool-result>\n")
                                content = "".join(text_parts)
                            elif isinstance(raw_content, str):
                                content = raw_content
                        
                        if role and content:
                            messages.append({
                                "role": role,
                                "content": content,
                                "timestamp": timestamp or datetime.now().isoformat()
                            })

                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse line in {file_path}")
        except Exception as e:
            logger.error(f"Error reading {file_path}: {e}")
        
        # Convert set to count
        metadata["file_change_count"] = len(metadata["modified_files"])
        del metadata["modified_files"]
        
        return {
            "messages": messages,
            "metadata": metadata
        }
