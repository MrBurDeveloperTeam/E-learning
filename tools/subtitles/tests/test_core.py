import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from core import Cue, timestamp, serialize, words_to_cues, save_result, preview


class SubtitleTests(unittest.TestCase):
    def test_timestamp_rounding(self):
        self.assertEqual(timestamp(59.9996), '00:01:00,000')
        self.assertEqual(timestamp(3600.125, True), '01:00:00.125')

    def test_reject_overlap(self):
        with self.assertRaises(ValueError):
            serialize([Cue(0, 2, 'a'), Cue(1, 3, 'b')])
        with self.assertRaises(ValueError):
            serialize([Cue(float('nan'), 2, 'a')])

    def test_pause_and_sentence_split(self):
        words = [SimpleNamespace(start=0, end=.4, word=' Hello'),
                 SimpleNamespace(start=.4, end=.8, word=' world.'),
                 SimpleNamespace(start=2, end=2.5, word=' Next')]
        cues = words_to_cues(words)
        self.assertEqual([c.text for c in cues], ['Hello world.', 'Next'])
        self.assertEqual(cues[0].end, .8)
        self.assertEqual(cues[1].start, 2)

    def test_readable_wrap_preserves_words(self):
        words = [SimpleNamespace(start=i*.2, end=(i+1)*.2, word=' example') for i in range(30)]
        cues = words_to_cues(words)
        self.assertEqual(sum(len(c.text.split()) for c in cues), 30)
        self.assertTrue(all(len(c.text.splitlines()) <= 2 for c in cues))
        self.assertTrue(all(c.end-c.start <= 6.01 for c in cues))

    def test_export_and_preview_escape(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            cues = [Cue(0, 1, '</script><b> & test')]
            save_result(folder, cues, {'model': 'test'})
            self.assertTrue((folder / 'subtitles.vtt').read_text().startswith('WEBVTT\n\n'))
            self.assertIn('&lt;/script&gt;', (folder / 'subtitles.vtt').read_text())
            page = preview(folder, folder / 'movie.mp4', cues).read_text()
            self.assertNotIn('</script><b>', page)
            self.assertIn('\\u003c/script', page)


if __name__ == '__main__':
    unittest.main()
