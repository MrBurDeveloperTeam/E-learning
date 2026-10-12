from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from youtube_source import normalize_youtube_url, validate_video, download_youtube, cleanup_audio

VIDEO_ID = 'IOHvw54rsw4'


class YouTubeSourceTests(unittest.TestCase):
    def test_video_links(self):
        for link in [f'https://www.youtube.com/watch?v={VIDEO_ID}&list=ignored&t=10',
                     f'https://youtu.be/{VIDEO_ID}?si=ignored', f'youtube.com/shorts/{VIDEO_ID}',
                     f'https://m.youtube.com/watch?v={VIDEO_ID}', f'https://youtube.com/embed/{VIDEO_ID}']:
            self.assertEqual(normalize_youtube_url(link), (f'https://www.youtube.com/watch?v={VIDEO_ID}', VIDEO_ID))

    def test_invalid_and_non_youtube_links(self):
        for link in ['https://youtube.com.evil.test/watch?v=' + VIDEO_ID,
                     'https://youtube.com@127.0.0.1/watch?v=' + VIDEO_ID,
                     'http://127.0.0.1/movie.mp4', 'https://youtube.com/playlist?list=123',
                     'https://youtube.com:8765/watch?v=' + VIDEO_ID, 'javascript:alert(1)',
                     f'https://youtu.be/{VIDEO_ID}/extra', f'https://youtube.com/watch?v={VIDEO_ID}&v={VIDEO_ID}', None]:
            with self.subTest(link=link), self.assertRaises(ValueError): normalize_youtube_url(link)

    def test_video_limits(self):
        base = {'id': VIDEO_ID, 'duration': 60}
        validate_video(base, VIDEO_ID)
        for extra in [{'is_live': True}, {'duration': 14401}, {'duration': None}, {'age_limit': 18}, {'availability': 'private'}, {'id': 'other'}]:
            with self.subTest(extra=extra), self.assertRaises(ValueError): validate_video({**base, **extra}, VIDEO_ID)

    def test_download_progress_and_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            changes = []
            class FakeDownloader:
                def __init__(self, options): self.options = options
                def __enter__(self): return self
                def __exit__(self, *_): pass
                def extract_info(self, url, download):
                    self.url = url
                    return {'id': VIDEO_ID, 'duration': 60, 'title': 'Test video'}
                def process_ie_result(self, info, download):
                    self.options['progress_hooks'][0]({'status': 'downloading', 'downloaded_bytes': 5, 'total_bytes': 10})
                    (folder / 'audio.m4a').write_bytes(b'fake audio')
            with patch('yt_dlp.YoutubeDL', FakeDownloader), patch('youtube_source.find_node', return_value='node'):
                audio, metadata = download_youtube(f'https://youtu.be/{VIDEO_ID}', folder, lambda **data: changes.append(data), threading.Event())
            self.assertTrue(audio.is_file())
            self.assertEqual(metadata['youtube_id'], VIDEO_ID)
            self.assertTrue(any(change.get('progress') == 50 for change in changes))
            (folder / 'subtitles.srt').write_text('keep')
            cleanup_audio(folder)
            self.assertFalse(audio.exists())
            self.assertTrue((folder / 'subtitles.srt').exists())

    def test_pre_cancel_does_not_start_network(self):
        event = threading.Event(); event.set()
        with patch('youtube_source.find_node', return_value='node'), patch('yt_dlp.YoutubeDL') as downloader:
            with self.assertRaises(InterruptedError): download_youtube(f'https://youtu.be/{VIDEO_ID}', Path('.'), lambda **_: None, event)
            downloader.assert_not_called()


if __name__ == '__main__': unittest.main()
