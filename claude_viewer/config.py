from pathlib import Path
import os

def get_default_log_path() -> Path:
    """Returns the default path for Claude Code project logs."""
    return Path.home() / ".claude" / "projects"

CLAUDE_LOG_PATH = os.environ.get("CLAUDE_LOG_PATH", get_default_log_path())
DB_PATH = Path("claude_logs.db")
