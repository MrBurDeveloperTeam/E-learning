# E-learning admin subtitles

The new **AI subtitles** navigation entry is directly below **Content review**. Route: `/admin/subtitles`. It uses the existing AdminLayout, AdminSectionCard, AdminStatCard, theme tokens and admin access guard.

## Start

1. Double-click `start-subtitles.cmd` in the e-learning root (or `tools/subtitles/start-api.cmd`). Keep that engine window open.
2. Open e-learning as an admin and select **AI subtitles**.
3. Copy the contents of `tools/subtitles/.session-token` into **Connect your subtitle engine**, then connect. The token is regenerated when the engine restarts. It is stored in the browser tab's session storage, not the database.
4. Choose an English video, generate subtitles, review and save edits, then export SRT/VTT/TXT. Jobs persist under `tools/subtitles/output/web/`.

The large-v3 model and Python environment are already migrated into `tools/subtitles`. CPU INT8 is the default for this machine's 2GB MX550. Check **Use downloaded models only** for offline inference; uncheck for first-time model downloads. Full precision needs more RAM and is slower; it does not guarantee better results on every recording.

## Deployment boundary

The React page can be deployed with the existing e-learning frontend, but Cloudflare Pages/Workers does not run the Python model. Each admin who uses this feature must run the local engine on their computer. Videos and generated subtitles are sent only to that loopback engine, not to Supabase, Mux or a paid API. This implementation exports caption files; it does not attach them to published videos automatically.

The browser may request local network permission when the deployed HTTPS site connects to `127.0.0.1`. Allow that permission. If browser policy blocks it, use the local e-learning preview at `http://127.0.0.1:3000`. MP4/WebM playback depends on the codec; use VLC with exported SRT for unsupported formats.

## Configuration

Default engine: `http://127.0.0.1:8765`. Optional frontend variable: `VITE_SUBTITLE_API_URL`. The API binds only to 127.0.0.1, requires a random bearer token, and allows only local port 3000 and `https://e-learning.snabbb.com`. Additional exact origins can be provided using the comma-separated `SUBTITLE_ALLOWED_ORIGINS` environment variable. Never expose this local API to the public network. Inference jobs are serialized to avoid exhausting CPU/RAM.

Dependencies can be reinstalled by running `tools/subtitles/setup.ps1` with uv. Runtime packages, model caches, output media and `.session-token` are Git-ignored.

## Verify

From `tools/subtitles`: `.venv\Scripts\python.exe -m unittest discover -s tests -v`. Tests cover subtitle formatting and API authentication, CORS, upload, saved edits, exports and range playback. Real large-v3 inference is validated separately with the short JFK MP4 fixture; this is not a film accuracy benchmark.

Browser QA used the isolated development fixture at tests/fixtures/qa-subtitles.html with a mock admin profile and no real user session. Verified real MP4 upload, large-v3 offline inference, subtitle correction/save, video seeking and SRT download. The full site timed out or crashed in the embedded preview browser; authenticated navigation has not been verified or deployed. The isolated subtitle page and real local inference flow passed browser QA.

## YouTube links

Choose **YouTube link**, paste a public video URL, and select **Generate subtitles**. Standard watch URLs, Shorts, embed URLs and youtu.be sharing links are supported. Channel/playlist-only links are rejected; playlist and start-time parameters on video links are ignored, so one complete video is transcribed from time zero.

The engine reads a temporary audio track with yt-dlp, recognizes it locally, and cleans the downloaded audio after success, failure or cancellation. Recorded videos are limited to four hours and a 1 GB audio track. Private, paid, age-restricted, region-blocked and live/upcoming videos may be unavailable. The engine does not read browser cookies or sign in on your behalf.

Preview uses the original YouTube iframe player with generated subtitles overlaid. Clicking a subtitle seeks the player. If YouTube's own captions are enabled, turn off CC to avoid duplicate captions. Embedding may be disabled by the video owner; subtitle editing and export still work. Preview and source retrieval require an internet connection; **Use downloaded models only** refers to model downloads, not YouTube access.

No YouTube API key or paid transcription API is used. YouTube import needs Node.js 22 or newer; this machine reuses Codex's existing Node runtime. On other machines install Node, or provide its executable path in SUBTITLE_NODE_PATH. yt-dlp and its official EJS package are included in the Python requirements. If YouTube changes its access behavior, update yt-dlp[default] in the subtitle virtual environment.

Validation: 16 backend tests, 10 frontend URL validation cases and the frontend production build passed. The provided IOHvw54rsw4 video was fetched successfully. Its first 20 seconds were actually transcribed with large-v3 offline; this is a bounded smoke test, not a complete transcription of the 46-minute video. Browser QA verified link submission, cancellation, original YouTube playback and seeking from generated cues using the isolated admin fixture. A clearly labeled 20-second validation job is retained locally for review.