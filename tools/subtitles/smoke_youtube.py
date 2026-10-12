"""Verify the supplied YouTube source with a bounded 20-second ASR sample."""
from pathlib import Path
import threading
import wave
import av
import numpy as np
from youtube_source import download_youtube, cleanup_audio
from core import ROOT, transcribe, save_result

folder = ROOT / 'output' / 'youtube-validation'
folder.mkdir(parents=True, exist_ok=True)
last_progress = [-10]
def report(**changes):
    if 'filename' in changes: print('Video:', changes['filename'], flush=True)
    if changes.get('progress', 0) - last_progress[0] >= 10:
        last_progress[0] = changes['progress']; print('Audio read:', changes['progress'], flush=True)

event = threading.Event()
audio = None
try:
    audio, metadata = download_youtube('https://www.youtube.com/watch?v=IOHvw54rsw4', folder, report, event)
    resampler = av.AudioResampler(format='s16', layout='mono', rate=16000)
    samples, count = [], 0
    with av.open(str(audio)) as container:
        for frame in container.decode(audio=0):
            for converted in resampler.resample(frame):
                data = converted.to_ndarray().reshape(-1)[:320000-count]
                samples.append(data); count += len(data)
                if count >= 320000: break
            if count >= 320000: break
    wav_path = folder / 'validation-20-seconds.wav'
    with wave.open(str(wav_path), 'wb') as output:
        output.setnchannels(1); output.setsampwidth(2); output.setframerate(16000)
        output.writeframes(np.concatenate(samples).tobytes())
    print('Recognizing the first 20 seconds with large-v3 (offline)…', flush=True)
    cues, info = transcribe(wav_path, lambda k, v: print(k, v, flush=True), event, offline=True)
    if not cues: raise RuntimeError('The sample did not produce subtitles.')
    info.update(metadata); info.update(validation_only=True, sample_seconds=count/16000)
    save_result(folder, cues, info)
    print('RESULT:', ' '.join(c.text.replace('\n', ' ') for c in cues), flush=True)
finally:
    cleanup_audio(folder)
    print('Temporary YouTube audio cleaned.', flush=True)
