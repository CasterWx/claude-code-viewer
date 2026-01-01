from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import os
from pathlib import Path
import logging

from claude_viewer.config import CLAUDE_LOG_PATH, DB_PATH
from claude_viewer.parser import LogParser
from claude_viewer.storage import Storage
from claude_viewer.config_manager import ConfigManager

logger = logging.getLogger(__name__)

app = FastAPI(title="Claude Code Viewer")

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

storage = Storage(DB_PATH)
parser = LogParser(CLAUDE_LOG_PATH)
config_manager = ConfigManager()

@app.on_event("startup")
async def startup_event():
    logger.info("Starting up...")
    logger.info("Scanning logs...")
    # In a real app we might want to do this async or on demand
    for session_info in parser.scan_projects():
        result = parser.parse_session(session_info['file_path'])
        if result['messages']:
            storage.save_session(session_info['project'], session_info, result['messages'], result['metadata'], project_path=session_info.get('project_path'))
    logger.info("Scan complete.")

@app.get("/api/projects")
def get_projects():
    return storage.get_projects()

@app.get("/api/projects/{project_name}/details")
def get_project_details(project_name: str):
    details = analytics.get_project_details(project_name)
    if not details:
        raise HTTPException(status_code=404, detail="Project not found")
    return details

@app.get("/api/projects/{project_name}/sessions")
def get_sessions(project_name: str):
    return storage.get_sessions(project_name)

@app.get("/api/sessions/{session_id}/changes")
def get_session_changes(session_id: str):
    return analytics.get_session_changes(session_id)

@app.get("/api/sessions/{session_id}")
def get_session(session_id: str):
    return storage.get_messages(session_id)

@app.get("/api/search")
def search(q: str = Query(..., min_length=1)):
    return storage.search_messages(q)

@app.get("/api/tags")
def get_tags():
    return storage.get_all_tags()

from claude_viewer.models import TagRequest

@app.post("/api/sessions/{session_id}/tags")
def add_tag(session_id: str, tag: TagRequest):
    storage.tag_session(session_id, tag.name, tag.color)
    return {"status": "ok"}

@app.delete("/api/sessions/{session_id}/tags/{tag_name}")
def remove_tag(session_id: str, tag_name: str):
    storage.untag_session(session_id, tag_name)
    return {"status": "ok"}

# Config management endpoints
@app.get("/api/configs")
def list_configs():
    """List all available configuration files."""
    try:
        return config_manager.list_configs()
    except Exception as e:
        logger.error(f"Error listing configs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/configs/{path:path}")
def get_config(path: str):
    """Read a configuration file."""
    try:
        return config_manager.read_config(path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error reading config {path}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/configs/{path:path}")
async def update_config(path: str, request: dict):
    """Update a configuration file."""
    try:
        content = request.get("content", "")
        return config_manager.write_config(path, content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating config {path}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/configs/{path:path}")
def delete_config(path: str):
    """Delete a configuration file."""
    try:
        return config_manager.delete_config(path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting config {path}: {e}")
        raise HTTPException(status_code=500, detail=str(e))



from claude_viewer.analytics import Analytics

analytics = Analytics(DB_PATH)

@app.get("/api/analytics")
def get_analytics():
    return analytics.get_stats()

# Dashboard endpoint
@app.get("/api/dashboard")
def get_dashboard():
    """Get dashboard statistics."""
    try:
        data = analytics.get_stats()
        # Add some additional computed stats
        return {
            **data,
            "avg_messages_per_session": data["total_messages"] / data["total_sessions"] if data["total_sessions"] > 0 else 0
        }
    except Exception as e:
        logger.error(f"Error getting dashboard data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Mount frontend build
# Priority:
# 1. claude_viewer/static (packaged)
# 2. frontend/dist (development)

static_dir = Path(__file__).parent / "static"
if not static_dir.exists():
    # Try development path
    static_dir = Path(__file__).parent.parent / "frontend" / "dist"

if static_dir.exists():
    # Mount assets if they exist
    if (static_dir / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")
    
    # Catch-all for SPA
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Check if file exists
        file_path = static_dir / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
            
        # Don't fallback for API routes
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
            
        # Fallback to index.html
        return FileResponse(static_dir / "index.html")