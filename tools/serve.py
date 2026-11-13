"""A local server for the game.

Run: python3 tools/serve.py [port]    (5173 by default, then open http://localhost:5173)

It differs from plain `python3 -m http.server` in one thing: it forbids the browser to cache files.
Without that, after editing code or images the browser may keep showing an old version.
It listens on this computer only; the game is not visible from the network.
"""

import functools
import http.server
import os
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
print(f"Overarmed: http://localhost:{port}")
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Handler, directory=root)).serve_forever()
