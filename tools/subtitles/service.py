"""Loopback-only subtitle API for the e-learning admin frontend."""
import argparse
import hashlib
import hmac
import json
import mimetypes
import os
from pathlib import Path
import re
import secrets
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse, parse_qs
from core import ROOT, Cue, transcribe, save_result, validate
from youtube_source import normalize_youtube_url, download_youtube, cleanup_audio

MAX_UPLOAD = 5 * 1024**3
EXTENSIONS = {'.mp4', '.mkv', '.mov', '.avi', '.webm', '.mp3', '.wav', '.m4a'}
ALLOWED_ORIGINS = {'http://localhost:3000', 'http://127.0.0.1:3000', 'https://e-learning.snabbb.com'}
ALLOWED_ORIGINS.update(filter(None, os.getenv('SUBTITLE_ALLOWED_ORIGINS', '').split(',')))


class Store:
    def __init__(self, folder, token):
        self.folder, self.token = folder, token
        folder.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.slot = threading.Lock()
        self.jobs, self.cancels = {}, {}
        for path in folder.glob('*/job.json'):
            try:
                job = json.loads(path.read_text(encoding='utf-8'))
                if not re.fullmatch('[a-f0-9]{32}', job['id']): continue
                if job['status'] in {'uploading', 'downloading', 'running', 'cancelling'}:
                    job.update(status='error', message='The engine stopped before this job finished. Please upload again.')
                self.jobs[job['id']] = job
            except (ValueError, KeyError, OSError):
                continue

    def update(self, identifier, **changes):
        with self.lock:
            self.jobs[identifier].update(changes)
            path = self.folder / identifier / 'job.json'
            temporary = path.with_suffix('.tmp')
            temporary.write_text(json.dumps(self.jobs[identifier], ensure_ascii=False), encoding='utf-8')
            temporary.replace(path)

    def public(self, job):
        result = dict(job)
        result['media_key'] = hmac.new(self.token.encode(), job['id'].encode(), hashlib.sha256).hexdigest()
        return result

    def run(self, identifier, source, options):
        def report(kind, value):
            if kind == 'progress': self.update(identifier, progress=round(value, 1))
            if kind == 'status': self.update(identifier, message=value)
        try:
            youtube_metadata = {}
            if source is None:
                source, youtube_metadata = download_youtube(
                    self.jobs[identifier]['source_url'], self.folder / identifier,
                    lambda **changes: self.update(identifier, **changes), self.cancels[identifier])
            self.update(identifier, status='running', stage='transcribe', progress=0, message='Loading the English model…')
            cues, metadata = transcribe(source, report, self.cancels[identifier],
                                        options['model'], options['precision'], options.get('prompt', ''), options.get('offline', False))
            if not cues: raise ValueError('No speech was detected. Check that the video has an English audio track.')
            if self.cancels[identifier].is_set(): raise InterruptedError('Cancelled.')
            metadata.update(youtube_metadata)
            save_result(self.folder / identifier, cues, metadata)
            self.update(identifier, status='done', progress=100, cue_count=len(cues), message='Subtitles are ready for review.')
        except InterruptedError:
            self.update(identifier, status='cancelled', message='Cancelled. Import the video or link again to retry.')
        except Exception as exc:
            self.update(identifier, status='error', message=f'{type(exc).__name__}: {exc}')
        finally:
            if self.jobs[identifier].get('source_type') == 'youtube':
                try: cleanup_audio(self.folder / identifier)
                except OSError:
                    with self.lock: self.jobs[identifier]['cache_cleanup_failed'] = True
            with self.lock: self.cancels.pop(identifier, None)
            self.slot.release()


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    @property
    def store(self): return self.server.store

    def log_message(self, *_): pass  # Never log tokens or media URLs.

    def send_headers(self, status, content_type, size, **extra):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(size))
        self.send_header('Cache-Control', 'no-store')
        origin = self.headers_in_origin
        if origin in ALLOWED_ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        for key, value in extra.items(): self.send_header(key.replace('_', '-'), value)
        self.end_headers()

    @property
    def headers_in_origin(self): return self.headers.get('Origin', '')

    def response(self, status, data):
        content = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_headers(status, 'application/json; charset=utf-8', len(content))
        self.wfile.write(content)

    def allowed(self, auth=True):
        host = self.headers.get('Host', '').split(':')[0]
        if host not in {'127.0.0.1', 'localhost'} or (self.headers_in_origin and self.headers_in_origin not in ALLOWED_ORIGINS):
            self.response(403, {'error': 'This origin is not allowed.'}); return False
        if auth and not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + self.store.token):
            self.response(401, {'error': 'Connect using the token from the local subtitle engine.'}); return False
        return True

    def do_OPTIONS(self):
        if not self.allowed(False): return
        self.send_headers(204, 'text/plain', 0, Access_Control_Allow_Methods='GET, POST, PUT, OPTIONS',
                     Access_Control_Allow_Headers='Authorization, Content-Type, X-Filename, X-Subtitle-Options',
                     Access_Control_Allow_Private_Network='true', Access_Control_Max_Age='600')

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/health':
            if self.allowed(False): self.response(200, {'ok': True, 'language': 'en', 'device': 'cpu', 'version': 1})
            return
        match = re.fullmatch(r'/jobs/([a-f0-9]{32})/(result|video|export/(?:srt|vtt|txt|json))', parsed.path)
        if match and match[2] == 'video':
            if not self.allowed(False): return
            identifier = match[1]
            with self.store.lock: job = self.store.jobs.get(identifier)
            if not job: self.response(404, {'error': 'Job not found.'}); return
            key = parse_qs(parsed.query).get('key', [''])[0]
            if not hmac.compare_digest(key, self.store.public(job)['media_key']):
                self.response(401, {'error': 'Video access expired. Reconnect the engine.'}); return
            if job.get('source_type') == 'youtube':
                self.response(409, {'error': 'Play this video using the original YouTube player.'}); return
            self.file(self.store.folder / identifier / ('input' + Path(job['filename']).suffix.lower()), ranges=True)
            return
        if not self.allowed(): return
        if parsed.path == '/jobs':
            with self.store.lock: jobs = [self.store.public(j) for j in reversed(list(self.store.jobs.values()))]
            self.response(200, jobs); return
        if not match: self.response(404, {'error': 'Not found.'}); return
        identifier, kind = match[1], match[2]
        with self.store.lock: job = self.store.jobs.get(identifier)
        if not job: self.response(404, {'error': 'Job not found.'}); return
        if job['status'] != 'done': self.response(409, {'error': 'Subtitles are not ready yet.'}); return
        folder = self.store.folder / identifier
        if kind == 'result':
            self.file(folder / 'subtitles.json')
        else:
            self.file(folder / ('subtitles.' + kind.split('/')[-1]))

    def file(self, path, ranges=False):
        if not path.is_file(): self.response(404, {'error': 'File not found.'}); return
        size, start, end = path.stat().st_size, 0, path.stat().st_size - 1
        extra = {}
        partial = False
        if ranges:
            extra['Accept_Ranges'] = 'bytes'
            header = self.headers.get('Range')
            if header:
                match = re.fullmatch(r'bytes=(\d*)-(\d*)', header)
                if not match or not any(match.groups()):
                    self.send_headers(416, 'text/plain', 0, Content_Range=f'bytes */{size}'); return
                if match[1]:
                    start = int(match[1]); end = min(end, int(match[2])) if match[2] else end
                else: start = max(0, size - int(match[2]))
                if start > end or start >= size:
                    self.send_headers(416, 'text/plain', 0, Content_Range=f'bytes */{size}'); return
                partial = True; extra['Content_Range'] = f'bytes {start}-{end}/{size}'
        content_type = mimetypes.guess_type(str(path))[0] or 'application/octet-stream'
        self.send_headers(206 if partial else 200, content_type, end-start+1, **extra)
        try:
            with path.open('rb') as source:
                source.seek(start); remaining = end-start+1
                while remaining:
                    chunk = source.read(min(1024*1024, remaining))
                    if not chunk: break
                    self.wfile.write(chunk); remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError): pass

    def do_POST(self):
        if not self.allowed(): self.close_connection = True; return
        parsed = urlparse(self.path)
        if parsed.path == '/jobs/youtube':
            self.youtube_job(); return
        cancel = re.fullmatch(r'/jobs/([a-f0-9]{32})/cancel', parsed.path)
        if cancel:
            with self.store.lock:
                event = self.store.cancels.get(cancel[1])
                if event and self.store.jobs[cancel[1]]['status'] in {'running', 'downloading', 'uploading', 'cancelling'}:
                    event.set(); self.store.update(cancel[1], status='cancelling', message='Waiting for the current network request or recognition segment to stop…')
            self.response(200, {'ok': True}); return
        if parsed.path != '/jobs': self.response(404, {'error': 'Not found.'}); return
        try:
            filename = Path(unquote(self.headers.get('X-Filename', ''))).name
            suffix = Path(filename).suffix.lower()
            size = int(self.headers.get('Content-Length', '0'))
            options = json.loads(unquote(self.headers.get('X-Subtitle-Options', '{}')))
            if suffix not in EXTENSIONS: raise ValueError('Choose MP4, MKV, MOV, AVI, WebM, MP3, WAV or M4A.')
            if not 0 < size <= MAX_UPLOAD: raise ValueError('Choose a non-empty file up to 5 GB.')
            if options.get('model') not in {'large-v3', 'medium.en', 'small.en'}: raise ValueError('Unsupported model.')
            if options.get('precision') not in {'int8', 'float32'}: raise ValueError('Unsupported precision.')
            if not isinstance(options.get('prompt', ''), str) or len(options.get('prompt', '')) > 2000: raise ValueError('Prompt must be at most 2000 characters.')
        except (ValueError, TypeError, AttributeError) as exc:
            self.response(400, {'error': str(exc)}); self.close_connection = True; return
        if not self.store.slot.acquire(False):
            self.response(409, {'error': 'Another video is being processed. Wait for it to finish.'}); self.close_connection = True; return
        identifier = secrets.token_hex(16)
        folder = self.store.folder / identifier; folder.mkdir()
        source = folder / ('input' + suffix)
        with self.store.lock:
            self.store.jobs[identifier] = dict(id=identifier, filename=filename, model=options['model'], precision=options['precision'], status='uploading', progress=0, cue_count=0, message='Receiving video…')
            self.store.cancels[identifier] = threading.Event()
        try:
            remaining = size
            with source.open('wb') as target:
                while remaining:
                    chunk = self.rfile.read(min(1024*1024, remaining))
                    if not chunk: raise ValueError('Upload interrupted. Please retry.')
                    target.write(chunk); remaining -= len(chunk)
            self.store.update(identifier, status='running')
        except Exception as exc:
            self.store.update(identifier, status='error', message=str(exc))
            with self.store.lock: self.store.cancels.pop(identifier, None)
            self.store.slot.release(); self.response(400, {'error': str(exc)}); return
        threading.Thread(target=self.store.run, args=(identifier, source, options), daemon=True).start()
        self.response(202, {'id': identifier})

    def youtube_job(self):
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 32768: raise ValueError('Invalid YouTube request size.')
            options = json.loads(self.rfile.read(size))
            canonical, video_id = normalize_youtube_url(options.get('url'))
            if options.get('model') not in {'large-v3', 'medium.en', 'small.en'}: raise ValueError('Unsupported model.')
            if options.get('precision') not in {'int8', 'float32'}: raise ValueError('Unsupported precision.')
            if not isinstance(options.get('prompt', ''), str) or len(options.get('prompt', '')) > 2000: raise ValueError('Prompt must be at most 2000 characters.')
            if not isinstance(options.get('offline', False), bool): raise ValueError('Offline must be true or false.')
        except (ValueError, TypeError, AttributeError) as exc:
            self.response(400, {'error': str(exc)}); self.close_connection = True; return
        if not self.store.slot.acquire(False):
            self.response(409, {'error': 'Another video is being processed. Wait for it to finish.'}); return
        identifier = secrets.token_hex(16)
        try:
            (self.store.folder / identifier).mkdir()
            with self.store.lock:
                self.store.jobs[identifier] = dict(id=identifier, filename=f'YouTube video ({video_id})',
                    source_type='youtube', source_url=canonical, youtube_id=video_id,
                    model=options['model'], precision=options['precision'], status='downloading',
                    stage='download', progress=0, cue_count=0, message='Looking up the YouTube video…')
                self.store.cancels[identifier] = threading.Event()
                self.store.update(identifier)
            threading.Thread(target=self.store.run, args=(identifier, None, options), daemon=True).start()
        except Exception:
            with self.store.lock: self.store.cancels.pop(identifier, None)
            self.store.slot.release()
            self.response(500, {'error': 'Could not create the YouTube job. Check local disk space.'}); return
        self.response(202, {'id': identifier})

    def do_PUT(self):
        if not self.allowed(): return
        match = re.fullmatch('/jobs/([a-f0-9]{32})/result', urlparse(self.path).path)
        if not match: self.response(404, {'error': 'Not found.'}); return
        with self.store.lock:
            job = self.store.jobs.get(match[1])
            if not job or job['status'] != 'done': self.response(409, {'error': 'Subtitles are not ready.'}); return
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 20*1024*1024: raise ValueError('Invalid edit payload size.')
                data = json.loads(self.rfile.read(size))
                cues = [Cue(**c) for c in data['cues']]
                if not cues or len(cues) > 100000: raise ValueError('Invalid subtitle count.')
                validate(cues)
                folder = self.store.folder / match[1]
                metadata = json.loads((folder / 'subtitles.json').read_text(encoding='utf-8'))['metadata']
                save_result(folder, cues, metadata)
                self.store.update(match[1], cue_count=len(cues))
            except (ValueError, TypeError, KeyError, OSError) as exc:
                self.response(400, {'error': str(exc)}); return
        self.response(200, {'ok': True})


def create_server(port=8765, folder=None, token=None):
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    server.daemon_threads = True
    server.store = Store(folder or ROOT / 'output' / 'web', token or secrets.token_urlsafe(32))
    return server


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    server = create_server(args.port, token=os.getenv('SUBTITLE_ENGINE_TOKEN'))
    (ROOT / '.session-token').write_text(server.store.token, encoding='utf-8')
    print(f'Subtitle engine ready: http://127.0.0.1:{args.port}', flush=True)
    print('Paste the token from tools/subtitles/.session-token into the admin page.', flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()
