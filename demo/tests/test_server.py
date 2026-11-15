"""Exercise HTTP request handling without binding a socket or calling Gemini."""
import io
import json
import sys
import unittest
from email.message import Message
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import DemoHandler
from test_recipe_service import request_data, recipe_output


class ServerTests(unittest.TestCase):
    def handler(self, data=None, origin='http://localhost:8000', content_type='application/json', raw=None):
        handler = object.__new__(DemoHandler)
        handler.path = '/api/generate-recipe'
        handler.headers = Message()
        handler.headers['Host'] = 'localhost:8000'
        handler.headers['Origin'] = origin
        handler.headers['Content-Type'] = content_type
        body = raw if raw is not None else json.dumps(data or request_data()).encode()
        handler.headers['Content-Length'] = str(len(body))
        handler.rfile = io.BytesIO(body)
        handler.connection = type('Connection', (), {'settimeout': lambda *args: None})()
        handler.reply = lambda status, body: setattr(handler, 'result', (status, body))
        return handler

    def test_valid_request_delegates_to_adapter(self):
        handler = self.handler()
        with patch('server.generate', return_value=recipe_output()) as adapter:
            handler.do_POST()
        adapter.assert_called_once_with(request_data())
        self.assertEqual(handler.result, (200, recipe_output()))

    def test_cross_origin_and_non_json_rejected_without_generation(self):
        for handler, status in [(self.handler(origin='https://other.test'), 403),
                                (self.handler(content_type='text/plain'), 400),
                                (self.handler(raw=b'{'), 400)]:
            with patch('server.generate') as adapter:
                handler.do_POST()
            adapter.assert_not_called()
            self.assertEqual(handler.result[0], status)

    def test_unconfigured_service_is_reported_without_key(self):
        handler = self.handler()
        with patch.dict('os.environ', {}, clear=True):
            handler.do_POST()
        self.assertEqual(handler.result, (503, {'error': 'NOT_CONFIGURED'}))

    def test_oversized_body_rejected(self):
        handler = self.handler(raw=b' ' * 20_001)
        with patch('server.generate') as adapter:
            handler.do_POST()
        adapter.assert_not_called()
        self.assertEqual(handler.result[0], 400)


if __name__ == '__main__':
    unittest.main()
