from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import os
from pathlib import Path
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from time import time

from claude_viewer.config import CLAUDE_LOG_PATH, DB_PATH
from claude_viewer.parser import LogParser
from claude_viewer.storage import Storage
from claude_viewer.config_manager import ConfigManager
from claude_viewer.watcher import LogWatcher

logger = logging.getLogger(__name__)


@dataclass
class ScanProgress:
    """Track background scan progress."""
    total: int = 0
    completed: int = 0
    skipped: int = 0      # Empty files or metadata-only files (no conversation)
    failed: int = 0       # Actual parse errors
    is_scanning: bool = False
    start_time: float = 0
    end_time: float = 0

    @property
    def percent(self) -> float:
        if self.total == 0:
            return 0
        return round((self.completed / self.total) * 100, 1)

    @property
    def elapsed_seconds(self) -> float:
        if self.start_time == 0:
            return 0
        end = self.end_time if self.end_time > 0 else time()
        return round(end - self.start_time, 2)

    def to_dict(self) -> dict:
        return {
            "total": self.total,
            "completed": self.completed,
            "skipped": self.skipped,
            "failed": self.failed,
            "percent": self.percent,
            "is_scanning": self.is_scanning,
            "elapsed_seconds": self.elapsed_seconds
        }


# Global scan progress tracker
scan_progress = ScanProgress()

app = FastAPI(title="Claude Code Viewer")

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure config dir exists
if not DB_PATH.parent.exists():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

storage = Storage(DB_PATH)
parser = LogParser(CLAUDE_LOG_PATH)
config_manager = ConfigManager()


# Parse result status
PARSE_OK = "ok"
PARSE_SKIPPED = "skipped"  # Empty file or no messages (metadata only)
PARSE_FAILED = "failed"    # Actual error


def _parse_single_session(session_info: dict) -> tuple:
    """
    Parse a single session file.
    Returns (session_info, result, status) where status is PARSE_OK/PARSE_SKIPPED/PARSE_FAILED.
    """
    file_path = session_info['file_path']
    try:
        # Check if file is empty
        if os.path.getsize(file_path) == 0:
            return (session_info, None, PARSE_SKIPPED)

        result = parser.parse_session(file_path)
        if result['messages']:
            return (session_info, result, PARSE_OK)
        # File has content but no valid messages (metadata only)
        return (session_info, None, PARSE_SKIPPED)
    except Exception as e:
        logger.error(f"Error parsing {file_path}: {e}")
        return (session_info, None, PARSE_FAILED)


def _background_scan():
    """Background task to scan and parse all sessions in parallel."""
    global scan_progress

    scan_progress.is_scanning = True
    scan_progress.start_time = time()
    scan_progress.completed = 0
    scan_progress.skipped = 0
    scan_progress.failed = 0
    scan_progress.end_time = 0

    # Collect all session info first
    session_list = list(parser.scan_projects())
    scan_progress.total = len(session_list)

    if scan_progress.total == 0:
        scan_progress.is_scanning = False
        scan_progress.end_time = time()
        logger.info("No sessions found to scan.")
        return

    logger.info(f"Starting parallel scan of {scan_progress.total} sessions...")

    # Use ThreadPoolExecutor for parallel I/O-bound parsing
    max_workers = min(32, os.cpu_count() * 4 or 8)

    # Collect parsed results first, then batch save
    parsed_results = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(_parse_single_session, info): info
            for info in session_list
        }

        for future in as_completed(futures):
            session_info, result, status = future.result()
            if status == PARSE_OK:
                parsed_results.append((session_info, result))
            elif status == PARSE_SKIPPED:
                scan_progress.skipped += 1
            else:  # PARSE_FAILED
                scan_progress.failed += 1

    # Batch save to database (single transaction, much faster)
    logger.info(f"Parsing complete, saving {len(parsed_results)} sessions to database...")

    def update_progress(count):
        scan_progress.completed = count

    try:
        batch_data = [
            (
                session_info['project'],
                session_info,
                result['messages'],
                result['metadata'],
                session_info.get('project_path')
            )
            for session_info, result in parsed_results
        ]
        storage.save_sessions_batch(batch_data, progress_callback=update_progress)
    except Exception as e:
        logger.error(f"Error in batch save: {e}")
        scan_progress.failed += len(parsed_results) - scan_progress.completed

    # Cleanup orphaned sessions (files deleted but records remain in DB)
    all_file_session_ids = set(s['session_id'] for s in session_list)
    orphaned_count = storage.cleanup_orphaned_sessions(all_file_session_ids)
    if orphaned_count > 0:
        logger.info(f"Removed {orphaned_count} orphaned session(s) from database")

    scan_progress.is_scanning = False
    scan_progress.end_time = time()
    logger.info(
        f"Scan complete: {scan_progress.completed} sessions loaded, "
        f"{scan_progress.skipped} skipped, {scan_progress.failed} failed, "
        f"took {scan_progress.elapsed_seconds}s"
    )


@app.on_event("startup")
async def startup_event():
    logger.info("Starting up...")

    # Start background scan in a separate thread (non-blocking)
    scan_thread = threading.Thread(target=_background_scan, daemon=True)
    scan_thread.start()
    logger.info("Background scan started, server is ready to accept requests.")

    # Start watcher for live updates
    def on_log_change(file_path):
        try:
            for session_info in parser.scan_projects():
                if os.path.abspath(session_info['file_path']) == os.path.abspath(file_path):
                    result = parser.parse_session(file_path)
                    if result['messages']:
                        storage.save_session(
                            session_info['project'],
                            session_info,
                            result['messages'],
                            result['metadata'],
                            project_path=session_info.get('project_path')
                        )
                    logger.info(f"Updated session from {file_path}")
                    break
        except Exception as e:
            logger.error(f"Error processing update: {e}")

    watcher = LogWatcher(CLAUDE_LOG_PATH, on_log_change)
    watcher.start()

    # Store watcher in app state to prevent GC
    app.state.watcher = watcher

@app.on_event("shutdown")
def shutdown_event():
    if hasattr(app.state, "watcher"):
        app.state.watcher.stop()


@app.get("/api/scan/progress")
def get_scan_progress():
    """Get background scan progress status."""
    return scan_progress.to_dict()


@app.post("/api/scan/rescan")
def trigger_rescan():
    """Trigger a manual rescan of all sessions."""
    global scan_progress
    if scan_progress.is_scanning:
        return {"status": "already_scanning", "progress": scan_progress.to_dict()}

    scan_thread = threading.Thread(target=_background_scan, daemon=True)
    scan_thread.start()
    return {"status": "started"}


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

@app.get("/api/sessions/{session_id}/oneshot")
def get_session_oneshot(session_id: str, exclude: Optional[str] = None):
    exclude_list = exclude.split(',') if exclude else None
    return analytics.calculate_oneshot_stats(session_id, exclude_list)

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