#!/usr/bin/env python3
"""Serve a compiled Angular candidate with safe SPA history fallback.

CI-only static server. It serves no user data and cannot proxy production APIs.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import sys


ROOT = Path(sys.argv[1]).resolve()
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 4173
if not (ROOT / "index.html").is_file():
    raise SystemExit(f"Missing built Angular index.html in {ROOT}")


class SpaHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        request_path = unquote(urlsplit(self.path).path)
        candidate = (ROOT / request_path.lstrip("/")).resolve()
        is_safe_path = candidate == ROOT or ROOT in candidate.parents
        if not is_safe_path:
            self.send_error(403)
            return
        if not candidate.exists() and "." not in Path(request_path).name:
            self.path = "/index.html"
        return super().do_GET()


ThreadingHTTPServer(("127.0.0.1", PORT), SpaHandler).serve_forever()
