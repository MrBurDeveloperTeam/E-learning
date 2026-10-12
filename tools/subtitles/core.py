"""Local English transcription and subtitle formatting."""
from dataclasses import dataclass, asdict
from pathlib import Path
import html
import json
import textwrap
import threading

ROOT = Path(__file__).resolve().parent


@dataclass
class Cue:
    start: float
    end: float
    text: str


def timestamp(seconds, vtt=False):
    ms = max(0, round(seconds * 1000))
    hours, ms = divmod(ms, 3600000)
    minutes, ms = divmod(ms, 60000)
    seconds, ms = divmod(ms, 1000)
    return f'{hours:02}:{minutes:02}:{seconds:02}{"." if vtt else ","}{ms:03}'


def validate(cues):
    previous = 0.0
    for cue in cues:
        import math
        if not isinstance(cue.text, str) or not isinstance(cue.start, (int, float)) or not isinstance(cue.end, (int, float)):
            raise ValueError('Subtitle text must be a string and times must be numbers.')
        if not math.isfinite(cue.start) or not math.isfinite(cue.end):
            raise ValueError('Times must be finite numbers.')
        if cue.start < previous or cue.end <= cue.start or not cue.text.strip():
            raise ValueError('Subtitles must have text, positive duration, and no overlaps.')
        previous = cue.end


def serialize(cues, vtt=False):
    validate(cues)
    blocks = []
    for index, cue in enumerate(cues, 1):
        text = html.escape(cue.text, quote=False) if vtt else cue.text
        blocks.append(f'{index}\n{timestamp(cue.start, vtt)} --> {timestamp(cue.end, vtt)}\n{text}\n')
    return ('WEBVTT\n\n' if vtt else '') + '\n'.join(blocks)


def words_to_cues(words):
    """Split at pauses, punctuation, 6 seconds or two 42-character lines."""
    cues, group = [], []

    def flush():
        if not group:
            return
        text = ''.join(w.word for w in group).strip()
        if text:
            start = max(group[0].start, cues[-1].end if cues else 0)
            end = max(start + .01, group[-1].end)
            cues.append(Cue(start, end, '\n'.join(textwrap.wrap(text, 42))))
        group.clear()

    for word in words:
        if not word.word.strip():
            continue
        candidate = ''.join(w.word for w in group) + word.word
        if group and (word.start - group[-1].end > .7 or
                      word.end - group[0].start > 6 or
                      len(textwrap.wrap(candidate.strip(), 42)) > 2):
            flush()
        group.append(word)
        if word.word.rstrip().endswith(('.', '?', '!')):
            flush()
    flush()
    return cues


def transcribe(path, report, cancel: threading.Event, model_name='large-v3', precision='int8', prompt='', offline=False):
    from faster_whisper import WhisperModel
    report('status', 'Loading model (first run downloads several GB)…')
    model = WhisperModel(model_name, device='cpu', compute_type=precision,
                         download_root=str(ROOT / 'models'), local_files_only=offline)
    if cancel.is_set():
        raise InterruptedError('Cancelled.')
    report('status', 'Recognizing English speech…')
    segments, info = model.transcribe(
        str(path), language='en', task='transcribe', beam_size=5,
        word_timestamps=True, vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=700, speech_pad_ms=400),
        condition_on_previous_text=True, initial_prompt=prompt or None,
        hallucination_silence_threshold=2,
    )
    cues, raw = [], []
    for segment in segments:
        if cancel.is_set():
            raise InterruptedError('Cancelled. No final result was saved.')
        raw.append(dict(start=segment.start, end=segment.end, text=segment.text,
                        avg_logprob=segment.avg_logprob,
                        words=[dict(start=w.start, end=w.end, word=w.word, probability=w.probability)
                               for w in (segment.words or [])]))
        new = words_to_cues(segment.words or [])
        if not new and segment.text.strip():
            new = [Cue(segment.start, segment.end, segment.text.strip())]
        for cue in new:
            if cues:
                cue.start = max(cue.start, cues[-1].end)
                cue.end = max(cue.end, cue.start + .01)
            cues.append(cue)
        report('progress', min(99, segment.end / max(info.duration, .01) * 100))
    if cancel.is_set():
        raise InterruptedError('Cancelled.')
    return cues, dict(model=model_name, device='cpu', precision=precision,
                      language='en', source=str(path), duration=info.duration, segments=raw)


def save_result(folder, cues, metadata):
    folder.mkdir(parents=True, exist_ok=True)
    for suffix, content in [('srt', serialize(cues)), ('vtt', serialize(cues, True)),
                            ('txt', '\n'.join(c.text.replace('\n', ' ') for c in cues)),
                            ('json', json.dumps(dict(metadata=metadata, cues=[asdict(c) for c in cues]), ensure_ascii=False, indent=2))]:
        target = folder / f'subtitles.{suffix}'
        temporary = target.with_suffix(target.suffix + '.tmp')
        temporary.write_text(content, encoding='utf-8')
        temporary.replace(target)


def preview(folder, video, cues):
    # Embed data; no network, CDN, server, or browser file upload required.
    data = json.dumps([asdict(c) for c in cues], ensure_ascii=True).replace('<', '\\u003c')
    page = '''<!doctype html><meta charset="utf-8"><title>English subtitles preview</title>
<style>body{background:#111827;color:#eee;font:16px system-ui;max-width:1100px;margin:30px auto}
.stage{position:relative}video{width:100%;max-height:75vh;background:black}
#caption{position:absolute;bottom:65px;left:8%;right:8%;text-align:center;white-space:pre-line;font:bold 26px system-ui;text-shadow:0 2px 4px black;pointer-events:none}
#caption span{background:#000b;padding:4px 10px}button{margin:3px;padding:8px}#list{max-height:230px;overflow:auto}</style>
<h1>English subtitles preview</h1><p>Local preview · click a subtitle to seek. If the video codec is unsupported, use VLC with subtitles.srt.</p>
<div class="stage"><video id="video" controls src="VIDEO"></video><div id="caption"><span id="text"></span></div></div><div id="list"></div>
<script>const cues=DATA;const v=document.getElementById('video');const t=document.getElementById('text');
v.addEventListener('timeupdate',()=>{const c=cues.find(c=>v.currentTime>=c.start&&v.currentTime<c.end);t.textContent=c?c.text:'';});
for(const c of cues){const b=document.createElement('button');b.textContent=c.start.toFixed(2)+'  '+c.text;b.onclick=()=>{v.currentTime=c.start;v.play();};document.getElementById('list').append(b);}
</script>'''.replace('VIDEO', html.escape(video.as_uri(), quote=True)).replace('DATA', data)
    target = folder / 'preview.html'
    target.write_text(page, encoding='utf-8')
    return target
