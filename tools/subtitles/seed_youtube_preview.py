"""Create a clearly labeled local QA job from the real 20-second sample."""
import json
import secrets
from core import ROOT, Cue, save_result

data = json.loads((ROOT / 'output/youtube-validation/subtitles.json').read_text(encoding='utf-8'))
identifier = secrets.token_hex(16)
folder = ROOT / 'output/web' / identifier
cues = [Cue(**cue) for cue in data['cues']]
save_result(folder, cues, data['metadata'])
job = dict(id=identifier, filename='20-second validation · Dentist Compares Tooth Replacement Options',
           source_type='youtube', source_url='https://www.youtube.com/watch?v=IOHvw54rsw4', youtube_id='IOHvw54rsw4',
           model='large-v3', precision='int8', status='done', stage='transcribe', progress=100,
           cue_count=len(cues), message='QA sample only: first 20 seconds recognized, not the full 46-minute video.')
(folder / 'job.json').write_text(json.dumps(job), encoding='utf-8')
print('Created 20-second preview validation job:', identifier)
