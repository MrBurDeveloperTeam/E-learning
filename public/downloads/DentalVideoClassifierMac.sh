#!/bin/bash

set -u

CLASSIFIER_VERSION="2026-09-03.2"
SITE_WIDTH=76

color_reset='\033[0m'
color_gray='\033[90m'
color_red='\033[31m'
color_green='\033[32m'
color_yellow='\033[33m'
color_cyan='\033[36m'

divider() {
  printf "${2:-$color_gray}%${SITE_WIDTH}s${color_reset}\n" "" | tr ' ' "${1:-=}"
}

section() {
  printf "\n${color_cyan}  %s${color_reset}\n" "$(printf '%s' "$1" | tr '[:lower:]' '[:upper:]')"
  printf "${color_gray}  ------------------------------------------------------------------------${color_reset}\n"
}

header() {
  clear
  divider '=' "$color_cyan"
  printf "${color_green}  DENTALLEARN${color_reset}\n"
  printf "${color_cyan}  VIDEO ORIENTATION CLASSIFIER FOR macOS${color_reset}\n"
  printf "${color_gray}  Classifier version: %s${color_reset}\n" "$CLASSIFIER_VERSION"
  divider '=' "$color_cyan"
  printf "  Portrait videos  -> Short video\n"
  printf "  Landscape/square -> Video\n"
  printf "${color_gray}  Metadata only. No video files are downloaded.${color_reset}\n"
}

cleanup() {
  [ -n "${session_dir:-}" ] && rm -rf "$session_dir"
}
trap cleanup EXIT INT TERM

json_video_rows() {
  /usr/bin/osascript -l JavaScript -e '
    ObjC.import("Foundation");
    var path = $.NSProcessInfo.processInfo.environment.objectForKey("JSON_FILE").js;
    var data = $.NSData.dataWithContentsOfFile(path);
    var obj = $.NSJSONSerialization.JSONObjectWithDataOptionsError(data, 0, null).js;
    (obj.videos || []).map(function (v) {
      return String(v.id) + "\t" + String(v.video_id);
    }).join("\n");
  '
}

json_dimensions() {
  /usr/bin/osascript -l JavaScript -e '
    ObjC.import("Foundation");
    var path = $.NSProcessInfo.processInfo.environment.objectForKey("JSON_FILE").js;
    var data = $.NSData.dataWithContentsOfFile(path);
    var obj = $.NSJSONSerialization.JSONObjectWithDataOptionsError(data, 0, null).js;
    var width = Number(obj.width || 0), height = Number(obj.height || 0);
    if (!(width > 0 && height > 0)) {
      (obj.formats || []).forEach(function (f) {
        var w = Number(f.width || 0), h = Number(f.height || 0);
        if (w > 0 && h > 0 && w * h > width * height) { width = w; height = h; }
      });
    }
    width + "\t" + height;
  '
}

download_metadata_tool() {
  tool_dir="$HOME/Library/Application Support/DentalLearnClassifier"
  yt_dlp="$tool_dir/yt-dlp_macos"
  mkdir -p "$tool_dir"

  if [ ! -x "$yt_dlp" ]; then
    printf "${color_cyan}  [SETUP] Downloading the metadata tool...${color_reset}\n"
    curl -fL --retry 3 --connect-timeout 20 \
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos" -o "$yt_dlp"
    checksum_file="$session_dir/SHA2-256SUMS"
    curl -fL --retry 3 --connect-timeout 20 \
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS" -o "$checksum_file"
    expected_hash="$(awk '$2 == "yt-dlp_macos" { print $1; exit }' "$checksum_file")"
    actual_hash="$(shasum -a 256 "$yt_dlp" | awk '{ print $1 }')"
    if [ -z "$expected_hash" ] || [ "$expected_hash" != "$actual_hash" ]; then
      rm -f "$yt_dlp"
      printf "${color_red}  [FAILED] The metadata tool failed its security check.${color_reset}\n"
      return 1
    fi
    chmod 700 "$yt_dlp"
  else
    printf "${color_cyan}  [SETUP] Checking the metadata tool for updates...${color_reset}\n"
    "$yt_dlp" --update-to stable >/dev/null 2>&1 || \
      printf "${color_yellow}  [SKIPPED] Update unavailable; using the installed tool.${color_reset}\n"
  fi
}

classify_session() {
  access_code="$1"
  case "$access_code" in
    *\|*) ;;
    *) printf "${color_red}  [FAILED] Invalid access code. Copy a new code from Admin.${color_reset}\n"; return 1 ;;
  esac
  site_origin="${access_code%%|*}"
  token="${access_code#*|}"
  endpoint="${site_origin%/}/dental-api/orientation-videos"

  section "Setup"
  printf "  Choose how many unclassified videos to check (1-500).\n"
  printf "  Maximum videos [default: 10]: "
  IFS= read -r maximum
  maximum="${maximum:-10}"
  case "$maximum" in
    *[!0-9]*|'') printf "${color_red}  [FAILED] Enter a whole number from 1 to 500.${color_reset}\n"; return 1 ;;
  esac
  if [ "$maximum" -lt 1 ] || [ "$maximum" -gt 500 ]; then
    printf "${color_red}  [FAILED] Enter a whole number from 1 to 500.${color_reset}\n"
    return 1
  fi

  session_dir="$(mktemp -d "${TMPDIR:-/tmp}/DentalLearnClassifier.XXXXXX")"
  download_metadata_tool || return 1

  attempted_file="$session_dir/attempted.txt"
  : > "$attempted_file"
  checked=0
  processed=0
  short_videos=0
  videos=0
  skipped=0
  failed_offset=0

  section "Classification progress"
  printf "  Target: up to %s videos\n" "$maximum"

  while [ "$checked" -lt "$maximum" ]; do
    remaining=$((maximum - checked))
    batch_limit=10
    [ "$remaining" -lt 10 ] && batch_limit="$remaining"
    response_file="$session_dir/videos.json"
    rows_file="$session_dir/videos.tsv"
    printf "\n${color_cyan}  [LOAD] Fetching the next batch... %s/%s checked${color_reset}\n" "$checked" "$maximum"
    http_code="$(curl -sS --retry 2 --connect-timeout 20 --max-time 45 -o "$response_file" -w '%{http_code}' \
      -H "Authorization: Bearer $token" "${endpoint}?limit=${batch_limit}&offset=${failed_offset}")" || http_code="000"
    if [ "$http_code" != "200" ]; then
      printf "${color_red}  [FAILED] Unable to load videos (HTTP %s). The code may have expired.${color_reset}\n" "$http_code"
      return 1
    fi
    JSON_FILE="$response_file" export JSON_FILE
    json_video_rows > "$rows_file" 2>/dev/null || {
      printf "${color_red}  [FAILED] The server returned unreadable video data.${color_reset}\n"
      return 1
    }
    [ -s "$rows_file" ] || break

    payload_items=""
    batch_results=0
    while IFS="$(printf '\t')" read -r row_id youtube_id; do
      [ -n "$row_id" ] || continue
      grep -qxF "$row_id" "$attempted_file" && continue
      printf '%s\n' "$row_id" >> "$attempted_file"
      checked=$((checked + 1))
      percent=$((checked * 100 / maximum))
      printf "${color_cyan}  [%3s%%] [%s/%s]${color_reset} YouTube %s\n" "$percent" "$checked" "$maximum" "$youtube_id"

      metadata_file="$session_dir/metadata.json"
      error_file="$session_dir/metadata.err"
      if "$yt_dlp" --dump-single-json --skip-download --no-warnings --no-playlist \
          --socket-timeout 20 --retries 2 --extractor-retries 2 \
          "https://www.youtube.com/watch?v=$youtube_id" > "$metadata_file" 2> "$error_file"; then
        JSON_FILE="$metadata_file" export JSON_FILE
        dimensions="$(json_dimensions 2>/dev/null || true)"
        width="${dimensions%%$'\t'*}"
        height="${dimensions#*$'\t'}"
        if [ -n "$width" ] && [ -n "$height" ] && [ "$width" -gt 0 ] 2>/dev/null && [ "$height" -gt 0 ] 2>/dev/null; then
          if [ "$height" -gt "$width" ]; then
            video_type="short_video"; label="Short video"; short_videos=$((short_videos + 1))
          else
            video_type="video"; label="Video"; videos=$((videos + 1))
          fi
          [ -n "$payload_items" ] && payload_items="$payload_items,"
          payload_items="${payload_items}{\"id\":\"${row_id}\",\"videoType\":\"${video_type}\"}"
          batch_results=$((batch_results + 1))
          processed=$((processed + 1))
          printf "${color_green}         [SUCCESS] %sx%s -> %s${color_reset}\n" "$width" "$height" "$label"
        else
          skipped=$((skipped + 1)); failed_offset=$((failed_offset + 1))
          printf "${color_yellow}         [SKIPPED] No video dimensions returned.${color_reset}\n"
        fi
      else
        skipped=$((skipped + 1)); failed_offset=$((failed_offset + 1))
        reason="$(grep 'ERROR:' "$error_file" | tail -n 1)"
        [ -n "$reason" ] || reason="Metadata unavailable"
        printf "${color_yellow}         [SKIPPED] %s${color_reset}\n" "$reason"
      fi
    done < "$rows_file"

    if [ "$batch_results" -gt 0 ]; then
      save_file="$session_dir/save.json"
      save_code="$(curl -sS --retry 2 --connect-timeout 20 --max-time 45 -o "$save_file" -w '%{http_code}' \
        -X PATCH -H "Authorization: Bearer $token" -H "Content-Type: application/json" \
        --data "{\"results\":[${payload_items}]}" "$endpoint")" || save_code="000"
      if [ "$save_code" != "200" ] && [ "$save_code" != "207" ]; then
        printf "${color_red}  [FAILED] Results were detected but could not be saved (HTTP %s).${color_reset}\n" "$save_code"
        return 1
      fi
      printf "${color_green}  [SUCCESS] Saved %s classifications.${color_reset}\n" "$batch_results"
    fi
  done

  section "Result summary"
  total=$((processed + skipped))
  if [ "$total" -gt 0 ]; then success_rate=$((processed * 100 / total)); else success_rate=0; fi
  divider '-' "$color_gray"
  printf "${color_green}  STATUS           COMPLETED${color_reset}\n"
  printf "  TOTAL CHECKED    %s\n" "$total"
  printf "${color_green}  SUCCESSFUL       %s${color_reset}\n" "$processed"
  printf "${color_cyan}  SHORT VIDEOS     %s${color_reset}\n" "$short_videos"
  printf "${color_cyan}  VIDEOS           %s${color_reset}\n" "$videos"
  printf "${color_yellow}  SKIPPED          %s${color_reset}\n" "$skipped"
  printf "  SUCCESS RATE     %s%%\n" "$success_rate"
  divider '-' "$color_gray"
  rm -rf "$session_dir"
  session_dir=""
}

header
while :; do
  section "Temporary access code"
  printf "  Copy a fresh code from Admin > Fetch videos.\n"
  printf "${color_gray}  The code is hidden while you paste it. Press Enter without a code to exit.${color_reset}\n"
  printf "  Temporary access code: "
  stty -echo
  IFS= read -r access_code
  stty echo
  printf "\n"
  [ -n "$access_code" ] || break
  classify_session "$access_code"

  section "Next action"
  printf "${color_cyan}  [1] Start another classification round${color_reset}\n"
  printf "  [2] Exit\n"
  while :; do
    printf "  Select 1 or 2: "
    IFS= read -r action
    if [ "$action" = "1" ] || [ "$action" = "2" ]; then break; fi
    printf "${color_yellow}  Please enter 1 to continue or 2 to exit.${color_reset}\n"
  done
  [ -n "${session_dir:-}" ] && rm -rf "$session_dir"
  session_dir=""
  [ "$action" = "2" ] && break
done

printf "\n${color_gray}  DentalLearn classifier closed safely.${color_reset}\n"
