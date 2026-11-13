"""Runs the TRAIN LOG Flask app inside Pyodide and answers requests from the page."""
from __future__ import annotations

import json
import os
import sys

os.environ.setdefault("TRAINS_SUPPORT_DIR", "/data/support")
os.environ.setdefault("TRAINS_DB", "/data/trains.db")
os.environ.setdefault("TRAINS_FIELD", "1")
sys.path.insert(0, "/app")

from app import create_app  # noqa: E402

application = create_app(watch_inbound=False)
client = application.test_client()


def _touch_data() -> None:
    # IDBFS only saves files whose mtime moved; SQLite's in-place writes leave it alone.
    for folder, _dirs, files in os.walk("/data"):
        for name in files:
            try:
                os.utime(os.path.join(folder, name))
            except OSError:
                pass


def handle(method: str, url: str, headers_json: str, body) -> tuple:
    headers = json.loads(headers_json or "{}")
    data = body.to_bytes() if hasattr(body, "to_bytes") else None
    response = client.open(url, method=method, headers=headers, data=data)
    if method not in ("GET", "HEAD"):
        _touch_data()
    out_headers = {key: value for key, value in response.headers.items()}
    return response.status_code, json.dumps(out_headers), response.get_data()
