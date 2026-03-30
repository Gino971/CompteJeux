#!/usr/bin/env python3
"""
Serveur HTTP local qui désactive le cache via les en-têtes et ouvre le navigateur.

Usage:
  python3 serve_nocache.py [--port PORT]

Le script sert le répertoire courant (où se trouve `index.html`). Il ajoute
les en-têtes `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`,
`Pragma: no-cache` et `Expires: 0` pour forcer les navigateurs à recharger les
ressources. Il tente d'ouvrir Google Chrome en navigation privée; sinon il
ouvre le navigateur par défaut avec un paramètre anti-cache (`?_ts=`).
"""

import argparse
import http.server
import socketserver
import socket
import threading
import time
import webbrowser
import subprocess
import shutil
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add headers that prevent caching
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


def find_free_port(preferred=8000):
    s = socket.socket()
    try:
        s.bind(('127.0.0.1', preferred))
        port = preferred
    except OSError:
        s.bind(('127.0.0.1', 0))
        port = s.getsockname()[1]
    finally:
        s.close()
    return port


def open_browser_incognito(url):
    # Try Chrome, Brave, Chromium with incognito flag using macOS `open -a` if available
    apps = [
        ("Google Chrome", ["--incognito"]),
        ("Brave Browser", ["--incognito"]),
        ("Chromium", ["--incognito"]),
        ("Firefox", ["-private-window"])  # Firefox uses a different flag
    ]
    for app, args in apps:
        try:
            # macOS: use `open -a "AppName" --args ...` which works if the app is installed
            cmd = ["open", "-a", app, "--args"] + args + [url]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        except Exception:
            continue
    return False


def serve(port):
    handler = NoCacheHandler
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        sa = httpd.socket.getsockname()
        print(f"Serving HTTP on {sa[0]} port {sa[1]} (http://127.0.0.1:{sa[1]}/) ...")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server...")
            httpd.shutdown()


def main():
    parser = argparse.ArgumentParser(description='Serve index.html with cache disabled')
    parser.add_argument('--port', '-p', type=int, default=8000, help='Port to bind (default: 8000)')
    args = parser.parse_args()

    port = find_free_port(args.port)

    url = f'http://127.0.0.1:{port}/index.html?_ts={int(time.time())}'

    # Start server in background thread
    t = threading.Thread(target=serve, args=(port,), daemon=True)
    t.start()

    # Give server a moment to start
    time.sleep(0.25)

    opened = False
    try:
        opened = open_browser_incognito(url)
    except Exception:
        opened = False

    if not opened:
        # Fallback: open default browser with cache-busting query param
        print('Could not open a browser in private mode; opening default browser instead...')
        webbrowser.open(url, new=1)

    print('Server running. Press Ctrl+C to stop.')
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print('\nShutting down.')
        sys.exit(0)


if __name__ == '__main__':
    main()
