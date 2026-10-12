import json
import threading
import time
import unittest
from unittest.mock import patch
import test_service
from core import Cue


class YouTubeApiTests(unittest.TestCase):
    setUp = test_service.ApiTests.setUp
    tearDown = test_service.ApiTests.tearDown
    request = test_service.ApiTests.request
    def test_youtube_endpoint_result_and_cache_cleanup(self):
        def download(url, folder, report, cancel):
            report(filename='Dental test video', progress=100)
            source = folder / 'audio.m4a'; source.write_bytes(b'test audio')
            return source, {'source_url': url, 'youtube_id': 'IOHvw54rsw4'}
        def recognize(*_): return [Cue(0, 1, 'Dental implants.')], {'language': 'en'}
        with patch('service.download_youtube', download), patch('service.transcribe', recognize):
            status, body = self.request('POST', '/jobs/youtube', json.dumps({
                'url': 'https://youtu.be/IOHvw54rsw4?si=ignored', 'model': 'large-v3', 'precision': 'int8', 'offline': True}))
            self.assertEqual(status, 202)
            identifier = json.loads(body)['id']
            for _ in range(200):
                job = json.loads(self.request('GET', '/jobs')[1])[0]
                if job['status'] == 'done' and not (self.server.store.folder / identifier / 'audio.m4a').exists(): break
                time.sleep(.01)
            self.assertEqual(job['status'], 'done')
            self.assertEqual(job['source_type'], 'youtube')
            self.assertEqual(job['youtube_id'], 'IOHvw54rsw4')
            result = json.loads(self.request('GET', f'/jobs/{identifier}/result')[1])
            self.assertEqual(result['metadata']['youtube_id'], 'IOHvw54rsw4')
            self.assertIn(b'Dental implants.', self.request('GET', f'/jobs/{identifier}/export/srt')[1])
            self.assertFalse((self.server.store.folder / identifier / 'audio.m4a').exists())

    def test_youtube_cancel_and_single_job_limit(self):
        entered = threading.Event()
        def download(url, folder, report, cancel):
            (folder / 'audio.part').write_bytes(b'partial')
            entered.set()
            if not cancel.wait(5): raise RuntimeError('Cancellation did not arrive.')
            raise InterruptedError('Cancelled.')
        data = json.dumps({'url': 'https://youtu.be/IOHvw54rsw4', 'model': 'large-v3', 'precision': 'int8'})
        with patch('service.download_youtube', download), patch('service.transcribe') as recognize:
            status, body = self.request('POST', '/jobs/youtube', data)
            self.assertEqual(status, 202)
            identifier = json.loads(body)['id']
            self.assertTrue(entered.wait(2))
            self.assertEqual(self.request('POST', '/jobs/youtube', data)[0], 409)
            self.request('POST', f'/jobs/{identifier}/cancel')
            for _ in range(200):
                job = json.loads(self.request('GET', '/jobs')[1])[0]
                if job['status'] == 'cancelled' and not (self.server.store.folder / identifier / 'audio.part').exists(): break
                time.sleep(.01)
            self.assertEqual(job['status'], 'cancelled')
            recognize.assert_not_called()
            self.assertFalse((self.server.store.folder / identifier / 'audio.part').exists())

    def test_reject_arbitrary_url_before_creating_job(self):
        status, _ = self.request('POST', '/jobs/youtube', json.dumps({'url': 'http://127.0.0.1/private', 'model': 'large-v3', 'precision': 'int8'}))
        self.assertEqual(status, 400)
        self.assertEqual(json.loads(self.request('GET', '/jobs')[1]), [])
