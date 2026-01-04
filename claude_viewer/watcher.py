from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import time
import logging
from threading import Timer
import os

logger = logging.getLogger(__name__)

class LogWatcher(FileSystemEventHandler):
    def __init__(self, log_dir: Path, callback):
        self.log_dir = log_dir
        self.callback = callback
        self.observer = Observer()
        self.debouncers = {}
        self.DEBOUNCE_SECONDS = 1.0

    def start(self):
        """Start monitoring the log directory."""
        if not self.log_dir.exists():
            logger.warning(f"Log directory {self.log_dir} does not exist. Watcher will not start.")
            return

        logger.info(f"Starting log watcher on {self.log_dir}")
        self.observer.schedule(self, str(self.log_dir), recursive=True)
        self.observer.start()

    def stop(self):
        """Stop monitoring."""
        self.observer.stop()
        self.observer.join()

    def on_modified(self, event):
        if event.is_directory:
            return
            
        filename = Path(event.src_path).name
        if not filename.endswith('.jsonl'):
            return

        # Debounce to avoid too many updates
        if filename in self.debouncers:
            self.debouncers[filename].cancel()
            
        self.debouncers[filename] = Timer(
            self.DEBOUNCE_SECONDS, 
            self._handle_change, 
            [event.src_path]
        )
        self.debouncers[filename].start()

    def on_created(self, event):
        if event.is_directory:
            return
            
        filename = Path(event.src_path).name
        if filename.endswith('.jsonl'):
            logger.info(f"New log file detected: {filename}")
            # Immediate update for new files
            self._handle_change(event.src_path)

    def _handle_change(self, file_path):
        try:
            logger.info(f"Processing change in {file_path}")
            self.callback(file_path)
            
            # Clean up debouncer
            filename = Path(file_path).name
            if filename in self.debouncers:
                del self.debouncers[filename]
                
        except Exception as e:
            logger.error(f"Error handling file change: {e}")
