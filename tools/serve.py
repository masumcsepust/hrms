"""Tiny static server with SPA fallback, for running the built application locally.

    python3 tools/serve.py 4200     # then open http://localhost:4200
"""
import http.server
import os
import socketserver
import sys

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist", "hrms", "browser")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4200


class SPA(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_GET(self):
        path = self.translate_path(self.path)
        if (not os.path.exists(path) or os.path.isdir(path)) and "." not in os.path.basename(
            self.path.split("?")[0]
        ):
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), SPA) as httpd:
        print(f"Hana HRM is running on http://localhost:{PORT}")
        httpd.serve_forever()
