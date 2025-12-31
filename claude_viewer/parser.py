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
                # Clean up project name. 
                # Example: -Users-wangxiaohu03-Desktop-claude-code-dx -> claude-code-dx
                # Heuristic: URL decode, then take the last part of path if it looks like a path
                try:
                    decoded = raw_project_name.replace('-', '/')
                    # If it starts with /Users, it's likely a path
                    if decoded.startswith('/Users') or decoded.startswith('/home'):
                        project_name = Path(decoded).name
                    else:
                        project_name = raw_project_name
                except:
                    project_name = raw_project_name

                for log_file in project_dir.glob("*.jsonl"):
                    yield {
                        "project": project_name,
                        "file_path": str(log_file),
                        "session_id": log_file.stem
                    }

    def parse_session(self, file_path: str) -> Dict[str, Any]:
        """Parses a single JSONL session file."""
        messages = []
        metadata = {
            "model": None,
            "total_tokens": 0,
            "input_tokens": 0,
            "output_tokens": 0
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
                                metadata["input_tokens"] += usage.get("input_tokens", 0)
                                metadata["output_tokens"] += usage.get("output_tokens", 0)
                                metadata["total_tokens"] += (usage.get("input_tokens", 0) + usage.get("output_tokens", 0))

                        # Case 1: Legacy/Simple format {"role": "...", "content": "..."}
                        if "role" in data:
                            role = data["role"]
                            content = data.get("content", "")
                        
                        # Case 2: New format {"type": "user", "message": {...}}
                        elif "type" in data and data["type"] in ["user", "assistant"]:
                            msg_obj = data.get("message", {})
                            role = msg_obj.get("role")
                            raw_content = msg_obj.get("content")
                            
                            if isinstance(raw_content, list):
                                # Extract text from blocks
                                text_parts = []
                                for block in raw_content:
                                    if block.get("type") == "text":
                                        text_parts.append(block.get("text", ""))
                                    elif block.get("type") == "tool_use":
                                        # Format as custom tag for frontend rendering
                                        input_json = json.dumps(block.get('input', {}), indent=2)
                                        text_parts.append(f"\n<tool-use name=\"{block.get('name')}\">\n{input_json}\n</tool-use>\n")
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
        
        return {
            "messages": messages,
            "metadata": metadata
        }
