import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Generator, Optional
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
    
    def _reconstruct_path(self, decoded_path: str) -> Optional[Path]:
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
            "total_messages": 0,
            "branch": None,
            "token_usage_history": [],
            "tool_stats": {},
            "modified_files": set(),
            # Analytics Counters
            "read_count": 0,
            "write_count": 0,
            "nav_miss_count": 0,
            "nav_total_count": 0,
            "user_chars": 0
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
                                        txt = block.get("text", "")
                                        text_parts.append(txt)
                                        if role == "user":
                                            metadata["user_chars"] += len(txt)
                                    elif block.get("type") == "tool_use":
                                        # Track Tool Stats
                                        t_name = block.get('name')
                                        if t_name:
                                            metadata["tool_stats"][t_name] = metadata["tool_stats"].get(t_name, 0) + 1
                                            
                                        # Format as custom tag for frontend rendering
                                        input_block = block.get('input', {})
                                        input_json = json.dumps(input_block, indent=2)
                                        text_parts.append(f"\n<tool-use name=\"{block.get('name')}\">\n{input_json}\n</tool-use>\n")

                                        # Analytics: Read vs Write
                                        tn_lower = t_name.lower()
                                        if any(x in tn_lower for x in ['view', 'read', 'list', 'search', 'glob', 'find']):
                                            metadata["read_count"] += 1
                                        elif any(x in tn_lower for x in ['write', 'edit', 'replace', 'create', 'append', 'run']):
                                            metadata["write_count"] += 1
                                        
                                        # Analytics: Navigation Total (view/list)
                                        if any(x in tn_lower for x in ['view_file', 'list_dir']):
                                            metadata["nav_total_count"] += 1
                                        
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
                                            
                                        # Analytics: Navigation Miss
                                        # Check if this result indicates a file system error
                                        # We accept false positives/negatives as heuristic
                                        low_res = content_str.lower()
                                        if "no such file" in low_res or "file not found" in low_res or "cannot access" in low_res:
                                             metadata["nav_miss_count"] += 1

                                        text_parts.append(f"\n<tool-result>\n{content_str}\n</tool-result>\n")
                                        
                                content = "".join(text_parts)
                                
                                # Heuristic: If the message originates from 'user' but contains 'tool_result' and NO 'text' blocks that are just user input,
                                # it is likely a tool output message.
                                # Check the blocks again to be sure:
                                if role == "user":
                                    has_tool_result = any(b.get("type") == "tool_result" for b in raw_content)
                                    has_user_text = any(b.get("type") == "text" for b in raw_content)
                                    
                                    if has_tool_result and not has_user_text:
                                        role = "tool"
                                        # Decrement turns since this isn't a user turn
                                        metadata["turns"] -= 1

                            elif isinstance(raw_content, str):
                                content = raw_content
                        
                        if role and content:
                            metadata["total_messages"] += 1
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
        # Convert set to count
        metadata["file_change_count"] = len(metadata["modified_files"])
        del metadata["modified_files"]

        # Final Analytics Calculations
        # 1. Read/Write Ratio
        if metadata["write_count"] > 0:
            metadata["read_write_ratio"] = round(metadata["read_count"] / metadata["write_count"], 2)
        else:
            metadata["read_write_ratio"] = metadata["read_count"] # If no writes, ratio is just read count (infinity proxy) or just raw count.
            # actually better to store as float. If write=0, maybe set to read_count * 1.0 or 999.0?
            # Let's just set it to read_count if write is 0, treating it as "ratio to 1" conceptually if we consider base work.
            # Or simplified: just store them as raw or calculated. Let's store ratio.
            if metadata["read_count"] > 0:
                metadata["read_write_ratio"] = float(metadata["read_count"])
            else:
                metadata["read_write_ratio"] = 0.0

        # 2. Nav Miss Rate
        if metadata["nav_total_count"] > 0:
            metadata["nav_miss_rate"] = round((metadata["nav_miss_count"] / metadata["nav_total_count"]) * 100, 1)
        else:
            metadata["nav_miss_rate"] = 0.0

        # 3. Avg Prompt Length
        # Use Turns count (which we decremented for tool outputs, so it represents User Turns)
        user_turns = max(1, metadata["turns"])
        metadata["avg_prompt_len"] = round(metadata["user_chars"] / user_turns, 1)

        # Cleanup temp counters
        del metadata["read_count"]
        # del metadata["write_count"] # Keep raw counts if useful? No, schema will just store metadata fields if we map them.
        # Actually storage.py maps specific keys. I should ensure these keys exist in metadata.
        # I will leave them in metadata for now, but explicit keys are 'read_write_ratio', 'nav_miss_rate', 'avg_prompt_len'.
        del metadata["nav_miss_count"]
        del metadata["nav_total_count"]
        del metadata["user_chars"]

        # Calculate Timing Analysis
        if messages:
             # Sort by timestamp just in case
            try:
                sorted_msgs = sorted(messages, key=lambda m: m["timestamp"])
                start_time = datetime.fromisoformat(sorted_msgs[0]["timestamp"])
                end_time = datetime.fromisoformat(sorted_msgs[-1]["timestamp"])
                
                total_duration = (end_time - start_time).total_seconds()
                metadata["total_duration_seconds"] = total_duration
                
                user_duration = 0
                model_duration = 0
                
                # Iterate and attribute time to the *responder* 
                # (Time gap comes BEFORE the message, so gap = prev_msg to curr_msg)
                # If curr_msg is user, gap is "User Think Time" -> user_duration
                # If curr_msg is bot/tool, gap is "Processing Time" -> model_duration
                
                for i in range(1, len(sorted_msgs)):
                    curr = sorted_msgs[i]
                    prev = sorted_msgs[i-1]
                    
                    t_curr = datetime.fromisoformat(curr["timestamp"])
                    t_prev = datetime.fromisoformat(prev["timestamp"])
                    diff = (t_curr - t_prev).total_seconds()
                    
                    if curr["role"] == "user":
                        user_duration += diff
                    else:
                        model_duration += diff
                        
                metadata["user_duration_seconds"] = user_duration
                metadata["model_duration_seconds"] = model_duration
                
            except Exception as e:
                logger.warning(f"Failed to calc timing for {file_path}: {e}")
                metadata["total_duration_seconds"] = 0
                metadata["user_duration_seconds"] = 0
                metadata["model_duration_seconds"] = 0
        
        return {
            "messages": messages,
            "metadata": metadata
        }
