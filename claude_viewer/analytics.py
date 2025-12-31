from typing import Dict, Any, List
import sqlite3
from pathlib import Path

class Analytics:
    def __init__(self, db_path: Path):
        self.db_path = db_path

    def get_stats(self) -> Dict[str, Any]:
        """Aggregate stats from the DB."""
        with sqlite3.connect(self.db_path) as db:
            total_projects = db.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
            total_sessions = db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
            total_messages = db.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
            
            # Messages over time (group by day) - limit to last 30 days
            daily_activity = db.execute("""
                SELECT date(timestamp), count(*) 
                FROM messages 
                WHERE timestamp IS NOT NULL 
                GROUP BY date(timestamp) 
                ORDER BY date(timestamp) DESC 
                LIMIT 30
            """).fetchall()

            # Stats by Tag
            tag_stats_rows = db.execute("""
                SELECT t.name, t.color, count(DISTINCT s.id) as sessions, count(m.id) as messages
                FROM tags t
                JOIN session_tags st ON t.id = st.tag_id
                JOIN sessions s ON st.session_id = s.id
                LEFT JOIN messages m ON s.id = m.session_id
                GROUP BY t.id
            """).fetchall()
            
            tag_stats = [
                {"name": r[0], "color": r[1], "sessions": r[2], "messages": r[3]} 
                for r in tag_stats_rows
            ]
            
        return {
            "total_projects": total_projects,
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "daily_activity": [{"date": r[0], "count": r[1]} for r in daily_activity],
            "tag_stats": tag_stats
        }
