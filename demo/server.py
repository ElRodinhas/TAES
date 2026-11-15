"""One-origin classroom server: python3 demo/server.py (Python 3.10+)."""
import argparse
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from recipe_service import RecipeError, generate

PWA_ROOT = Path(__file__).resolve().parents[1] / 'PWA'


class DemoHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # Do not serve symlinks pointing outside the public app folder.
        path = Path(self.translate_path(self.path)).resolve()
        if not path.is_relative_to(PWA_ROOT):
            self.send_error(403)
            return
        if path.is_dir() and not (path / 'index.html').is_file():
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        if urlsplit(self.path).path != '/api/generate-recipe':
            self.send_error(404)
            return
        # Local demo only: browser requests must come from this server's origin.
        origin = self.headers.get('Origin')
        if origin and origin != 'http://' + self.headers.get('Host', ''):
            self.reply(403, {'error': 'ORIGIN'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 20_000 or self.headers.get_content_type() != 'application/json':
                raise RecipeError('INPUT', 400)
            self.connection.settimeout(10)
            data = json.loads(self.rfile.read(length))
            self.reply(200, generate(data))
        except RecipeError as error:
            self.reply(error.status, {'error': error.code})
        except (ValueError, UnicodeError, TimeoutError):
            self.reply(400, {'error': 'INPUT'})

    def reply(self, status, body):
        raw = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    handler = partial(DemoHandler, directory=str(PWA_ROOT))
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    print(f'SmartPantry classroom demo: http://localhost:{args.port}/recipes.html', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
