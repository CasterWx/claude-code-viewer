import click
import uvicorn
from claude_viewer.config import CLAUDE_LOG_PATH

@click.group()
def cli():
    """Claude Code Viewer CLI"""
    pass

@cli.command()
@click.option("--host", default="127.0.0.1", help="Host to bind authentication server to.")
@click.option("--port", default=8000, help="Port to bind authentication server to.")
def serve(host, port):
    """Start the Claude Code Viewer server."""
    print(f"Starting server at http://{host}:{port}")
    from claude_viewer.server import app 
    uvicorn.run(app, host=host, port=port)
    print(f"Scanning logs from: {CLAUDE_LOG_PATH}")

if __name__ == "__main__":
    cli()
