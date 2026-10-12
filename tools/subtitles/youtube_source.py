"""Public, single-video YouTube import. No browser cookies or credentials."""
import os
from pathlib import Path
import re
import shutil
from urllib.parse import urlparse, parse_qs

MAX_AUDIO_BYTES = 1024**3
MAX_DURATION = 4 * 3600


def normalize_youtube_url(value):
    if not isinstance(value, str) or not value.strip() or len(value) > 2048:
        raise ValueError('Paste a valid YouTube video link.')
    value = value.strip()
    if '://' not in value: value = 'https://' + value
    parsed = urlparse(value)
    if parsed.scheme not in {'http', 'https'} or parsed.username or parsed.password or parsed.port is not None:
        raise ValueError('Only public YouTube video links are supported.')
    host = parsed.hostname
    path = parsed.path.rstrip('/')
    if host in {'youtu.be', 'www.youtu.be'}:
        video_id = path.removeprefix('/')
    elif host in {'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'}:
        if path == '/watch':
            identifiers = parse_qs(parsed.query).get('v', [])
            video_id = identifiers[0] if len(identifiers) == 1 else ''
        elif re.fullmatch(r'/(shorts|embed|live)/[^/]+', path):
            video_id = path.split('/')[-1]
        else: video_id = ''
    else: raise ValueError('Use a youtube.com or youtu.be video link.')
    if not re.fullmatch(r'[A-Za-z0-9_-]{11}', video_id):
        raise ValueError('Paste a single YouTube video link, not a channel or playlist.')
    return f'https://www.youtube.com/watch?v={video_id}', video_id


def validate_video(info, video_id):
    if not isinstance(info, dict) or info.get('id') != video_id or info.get('_type', 'video') != 'video':
        raise ValueError('The link did not resolve to a single YouTube video.')
    if info.get('is_live') or info.get('live_status') in {'is_live', 'is_upcoming', 'post_live'}:
        raise ValueError('Live or upcoming streams are not supported. Use a completed recording.')
    duration = info.get('duration')
    if not isinstance(duration, (int, float)) or duration <= 0 or duration > MAX_DURATION:
        raise ValueError('Choose a recorded YouTube video up to 4 hours long.')
    if info.get('age_limit', 0) >= 18 or info.get('availability') in {'private', 'premium_only', 'subscriber_only', 'needs_auth'}:
        raise ValueError('This video requires access or age verification. Use a public video.')


def find_node():
    configured = os.getenv('SUBTITLE_NODE_PATH')
    if configured and Path(configured).is_file(): return configured
    installed = shutil.which('node')
    if installed: return installed
    # Reuse Codex's bundled runtime on this machine, when Node isn't on PATH.
    bundled = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
    if bundled.is_file(): return str(bundled)
    raise ValueError('YouTube import needs Node.js 22 or newer. Install Node or set SUBTITLE_NODE_PATH, then restart the engine.')


def cleanup_audio(folder):
    folder = folder.resolve()
    for path in folder.glob('audio.*'):
        if path.is_file() and path.resolve().parent == folder:
            path.unlink(missing_ok=True)


def download_youtube(url, folder, report, cancel):
    from yt_dlp import YoutubeDL
    from yt_dlp.utils import DownloadError
    canonical, video_id = normalize_youtube_url(url)
    folder = folder.resolve()

    def check_cancel():
        if cancel.is_set(): raise InterruptedError('Cancelled.')

    def progress(data):
        check_cancel()
        downloaded = data.get('downloaded_bytes') or 0
        total = data.get('total_bytes') or data.get('total_bytes_estimate') or 0
        if downloaded > MAX_AUDIO_BYTES or total > MAX_AUDIO_BYTES:
            raise ValueError('The audio track is too large (maximum 1 GB).')
        if data.get('status') == 'downloading':
            percent = min(99, downloaded / total * 100) if total else 0
            report(progress=round(percent, 1), message='Reading the YouTube audio track…')

    class Logger:
        def debug(self, _): pass
        def warning(self, _): pass
        def error(self, _): pass

    options = dict(
        format='bestaudio/best', outtmpl=str(folder / 'audio.%(ext)s'),
        noplaylist=True, quiet=True, no_warnings=True, logger=Logger(),
        socket_timeout=20, retries=1, fragment_retries=1, extractor_retries=1,
        max_filesize=MAX_AUDIO_BYTES, progress_hooks=[progress],
        js_runtimes={'node': {'path': find_node()}},
    )
    check_cancel()
    report(status='downloading', stage='download', progress=0, message='Looking up the YouTube video…')
    try:
        with YoutubeDL(options) as downloader:
            info = downloader.extract_info(canonical, download=False)
            check_cancel()
            validate_video(info, video_id)
            report(filename=info.get('title') or video_id, duration=info['duration'])
            downloader.process_ie_result(info, download=True)
        check_cancel()
        files = [path for path in folder.glob('audio.*') if path.suffix not in {'.part', '.ytdl', '.temp'}]
        if len(files) != 1 or not files[0].is_file() or files[0].stat().st_size == 0:
            raise ValueError('No audio track was downloaded. The video may be unavailable or blocked.')
        return files[0], dict(source_url=canonical, youtube_id=video_id, title=info.get('title'), duration=info['duration'])
    except DownloadError as exc:
        if cancel.is_set(): raise InterruptedError('Cancelled.') from exc
        raise ValueError('YouTube could not provide the audio. Check that the video is public and available in your region. YouTube may require sign-in or temporarily block automated requests. Update yt-dlp if this persists.') from exc
