from pathlib import Path
from typing import List, Dict, Any, Optional
import json
import logging

logger = logging.getLogger(__name__)

class ConfigManager:
    """Manages Claude Code configuration files."""
    
    def __init__(self, claude_home: Path = None):
        self.claude_home = claude_home or Path.home() / ".claude"
        
    def list_configs(self) -> Dict[str, Any]:
        """List available configuration files and directories."""
        configs = {
            "files": [],
            "directories": {}
        }
        
        # Main config files
        settings_file = self.claude_home / "settings.json"
        claude_md = self.claude_home / "CLAUDE.md"
        
        if settings_file.exists():
            configs["files"].append({
                "name": "settings.json",
                "path": "settings.json",
                "type": "json"
            })
            
        if claude_md.exists():
            configs["files"].append({
                "name": "CLAUDE.md",
                "path": "CLAUDE.md",
                "type": "markdown"
            })
        
        # Agents directory
        agents_dir = self.claude_home / "agents"
        if agents_dir.exists() and agents_dir.is_dir():
            agents = []
            for agent_file in agents_dir.glob("*.md"):
                agents.append({
                    "name": agent_file.name,
                    "path": f"agents/{agent_file.name}",
                    "type": "markdown"
                })
            configs["directories"]["agents"] = agents
            
        # Commands directory
        commands_dir = self.claude_home / "commands"
        if commands_dir.exists() and commands_dir.is_dir():
            commands = []
            for cmd_file in commands_dir.iterdir():
                if cmd_file.is_file():
                    commands.append({
                        "name": cmd_file.name,
                        "path": f"commands/{cmd_file.name}",
                        "type": "text"
                    })
            configs["directories"]["commands"] = commands
            
        return configs
    
    def read_config(self, path: str) -> Dict[str, Any]:
        """Read a configuration file."""
        file_path = self.claude_home / path
        
        if not file_path.exists():
            raise FileNotFoundError(f"Config file not found: {path}")
            
        # Security check: ensure path is within claude_home
        try:
            file_path.resolve().relative_to(self.claude_home.resolve())
        except ValueError:
            raise ValueError(f"Invalid path: {path}")
        
        content = file_path.read_text(encoding='utf-8')
        
        file_type = "text"
        if path.endswith('.json'):
            file_type = "json"
            try:
                # Validate JSON
                json.loads(content)
            except json.JSONDecodeError as e:
                logger.warning(f"Invalid JSON in {path}: {e}")
        elif path.endswith('.md'):
            file_type = "markdown"
            
        return {
            "path": path,
            "content": content,
            "type": file_type
        }
    
    def write_config(self, path: str, content: str) -> Dict[str, Any]:
        """Write to a configuration file."""
        file_path = self.claude_home / path
        
        # Security check: ensure path is within claude_home
        try:
            file_path.resolve().parent.relative_to(self.claude_home.resolve())
        except ValueError:
            raise ValueError(f"Invalid path: {path}")
        
        # Validate JSON files
        if path.endswith('.json'):
            try:
                json.loads(content)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON: {e}")
        
        # Create parent directory if needed
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write file
        file_path.write_text(content, encoding='utf-8')
        logger.info(f"Updated config file: {path}")
        
        return {"success": True, "path": path}
    
    def delete_config(self, path: str) -> Dict[str, Any]:
        """Delete a configuration file."""
        file_path = self.claude_home / path
        
        # Security check
        try:
            file_path.resolve().relative_to(self.claude_home.resolve())
        except ValueError:
            raise ValueError(f"Invalid path: {path}")
        
        if not file_path.exists():
            raise FileNotFoundError(f"Config file not found: {path}")
            
        file_path.unlink()
        logger.info(f"Deleted config file: {path}")
        
        return {"success": True, "path": path}
