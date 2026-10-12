import http.client
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
import service
from core import Cue


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.server = service.create_server(0, Path(self.temporary.name), 'test-token')
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown(); self.server.server_close()
        self.temporary.cleanup()

    def request(self, method, path, data=None, auth=True, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        extra = {'Authorization': 'Bearer test-token'} if auth else {}
        extra.update(headers or {})
        connection.request(method, path, body=data, headers=extra)
        response = connection.getresponse()
        status, result = response.status, response.read()
        connection.close()
        return status, result

    def test_auth_cors_and_host(self):
        self.assertEqual(self.request('GET', '/health', auth=False)[0], 200)
        self.assertEqual(self.request('GET', '/jobs', auth=False)[0], 401)
        self.assertEqual(self.request('GET', '/jobs', headers={'Origin': 'https://untrusted.example'})[0], 403)
        self.assertEqual(self.request('GET', '/jobs', headers={'Host': 'untrusted.example'})[0], 403)
        self.assertEqual(self.request('OPTIONS', '/jobs', auth=False, headers={'Origin': 'https://e-learning.snabbb.com'})[0], 204)

    def test_upload_edit_export_and_seek(self):
        def recognize(path, report, cancel, *_):
            report('progress', 50)
            return [Cue(0, 1, 'Hello world.')], {'source': str(path), 'model': 'test'}
        with patch.object(service, 'transcribe', recognize):
            status, body = self.request('POST', '/jobs', b'0123456789', headers={
                'X-Filename': 'sample.mp4', 'X-Subtitle-Options': json.dumps({'model': 'large-v3', 'precision': 'int8'})})
            self.assertEqual(status, 202)
            identifier = json.loads(body)['id']
            for _ in range(100):
                jobs = json.loads(self.request('GET', '/jobs')[1])
                if jobs[0]['status'] == 'done': break
                time.sleep(.01)
            self.assertEqual(jobs[0]['status'], 'done')
            self.assertEqual(self.request('GET', f'/jobs/{identifier}/result')[0], 200)
            key = jobs[0]['media_key']
            self.assertEqual(self.request('GET', f'/jobs/{identifier}/video?key=wrong', auth=False)[0], 401)
            status, media = self.request('GET', f'/jobs/{identifier}/video?key={key}', auth=False, headers={'Range': 'bytes=3-5'})
            self.assertEqual((status, media), (206, b'345'))
            self.assertEqual(self.request('GET', f'/jobs/{identifier}/video?key={key}', auth=False, headers={'Range': 'bytes=99-'})[0], 416)
            edits = json.dumps({'cues': [{'start': 0, 'end': 1.2, 'text': 'Corrected text.'}]})
            self.assertEqual(self.request('PUT', f'/jobs/{identifier}/result', edits)[0], 200)
            self.assertIn(b'Corrected text.', self.request('GET', f'/jobs/{identifier}/export/srt')[1])
            invalid = json.dumps({'cues': [{'start': 2, 'end': 1, 'text': 'Invalid'}]})
            self.assertEqual(self.request('PUT', f'/jobs/{identifier}/result', invalid)[0], 400)
            self.assertIn(b'Corrected text.', self.request('GET', f'/jobs/{identifier}/export/srt')[1])
            with self.server.store.lock:
                self.assertEqual(self.server.store.jobs[identifier]['status'], 'done')
            self.request('POST', f'/jobs/{identifier}/cancel')
            self.assertEqual(json.loads(self.request('GET', '/jobs')[1])[0]['status'], 'done')

    def test_invalid_file(self):
        status, _ = self.request('POST', '/jobs', b'x', headers={'X-Filename': 'file.exe', 'X-Subtitle-Options': '{}'})
        self.assertEqual(status, 400)


if __name__ == '__main__': unittest.main()
