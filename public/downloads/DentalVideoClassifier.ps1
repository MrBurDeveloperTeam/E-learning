$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "DentalLearn | Video Orientation Classifier"

function Write-Divider([ConsoleColor]$Color = [ConsoleColor]::DarkGray) {
  Write-Host ("=" * 76) -ForegroundColor $Color
}

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host ("  " + $Title.ToUpperInvariant()) -ForegroundColor Cyan
  Write-Host ("  " + ("-" * 72)) -ForegroundColor DarkGray
}

function Write-ClassifierHeader {
  Write-Divider -Color Cyan
  Write-Host "  DENTALLEARN" -ForegroundColor Green
  Write-Host "  VIDEO ORIENTATION CLASSIFIER" -ForegroundColor Cyan
  Write-Host "  Classifier version: 2026-09-03.2" -ForegroundColor DarkGray
  Write-Divider -Color Cyan
  Write-Host "  Portrait videos  -> Short video"
  Write-Host "  Landscape/square -> Video"
  Write-Host "  Metadata only. No video files are downloaded." -ForegroundColor DarkGray
}

function Read-SecretText([string]$Prompt) {
  $secureText = Read-Host $Prompt -AsSecureString
  $textPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureText)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($textPointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($textPointer)
  }
}

function Invoke-ClassificationSession([string]$accessCode) {
$separator = $accessCode.IndexOf("|")
if ($separator -lt 1) {
  throw "The access code format is invalid. Copy a new code from the Admin page."
}
$siteOrigin = $accessCode.Substring(0, $separator).TrimEnd("/")
$token = $accessCode.Substring($separator + 1).Trim()
$endpoint = "$siteOrigin/dental-api/orientation-videos"
$headers = @{ Authorization = "Bearer $token" }

Write-Section "Setup"
Write-Host "  Choose how many unclassified videos to check (1-500)." -ForegroundColor Gray
$maximumText = Read-Host "  Maximum videos [default: 10]"
$maximumVideos = 10
if ($maximumText) {
  if ($maximumText -notmatch "^\d+$" -or [int]$maximumText -lt 1 -or [int]$maximumText -gt 500) {
    throw "Enter a whole number from 1 to 500."
  }
  $maximumVideos = [int]$maximumText
}

$toolDirectory = Join-Path $env:LOCALAPPDATA "DentalLearnClassifier"
$ytDlpPath = Join-Path $toolDirectory "yt-dlp.exe"
New-Item -ItemType Directory -Path $toolDirectory -Force | Out-Null

if (-not (Test-Path -LiteralPath $ytDlpPath)) {
  Write-Host "  [SETUP] Downloading the metadata tool..." -ForegroundColor Cyan
  $downloadUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
  $checksumUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS"
  $checksumPath = Join-Path $toolDirectory "SHA2-256SUMS"
  Invoke-WebRequest -Uri $downloadUrl -OutFile $ytDlpPath -UseBasicParsing
  Invoke-WebRequest -Uri $checksumUrl -OutFile $checksumPath -UseBasicParsing
  $checksumLine = Get-Content -LiteralPath $checksumPath | Where-Object { $_ -match "\syt-dlp\.exe$" } | Select-Object -First 1
  if (-not $checksumLine) { throw "Unable to verify the downloaded metadata tool." }
  $expectedHash = ($checksumLine -split "\s+")[0].ToUpperInvariant()
  $actualHash = (Get-FileHash -LiteralPath $ytDlpPath -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($actualHash -ne $expectedHash) {
    Remove-Item -LiteralPath $ytDlpPath -Force
    throw "The downloaded metadata tool failed its security check."
  }
} else {
  Write-Host "  [SETUP] Checking the metadata tool for updates..." -ForegroundColor Cyan
  $updateOutput = & $ytDlpPath --update-to stable 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  [SKIPPED] Update unavailable; using the installed metadata tool." -ForegroundColor Yellow
  }
}

function Invoke-ClassifierRequest {
  param(
    [string]$Method,
    [string]$Uri,
    [hashtable]$Headers,
    [string]$Body = $null
  )

  $lastError = $null
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      $requestParameters = @{
        Method = $Method
        Uri = $Uri
        Headers = $Headers
        TimeoutSec = 30
      }
      if (-not [string]::IsNullOrWhiteSpace($Body)) {
        $requestParameters.ContentType = "application/json"
        $requestParameters.Body = $Body
      }
      return Invoke-RestMethod @requestParameters
    } catch {
      $lastError = $_
      if ($attempt -lt 3) {
        Write-Host "  [RETRY] Server request timed out or failed. Retrying ($attempt/3)..." -ForegroundColor Yellow
        Start-Sleep -Seconds (2 * $attempt)
      }
    }
  }

  throw $lastError
}

function Get-VideoMetadataJson {
  param(
    [string]$YtDlpPath,
    [string]$YoutubeUrl,
    [string]$ToolDirectory
  )

  $runtimeTempPath = Join-Path $ToolDirectory "runtime-temp"
  New-Item -ItemType Directory -Path $runtimeTempPath -Force | Out-Null
  $process = $null
  try {
    $arguments = @(
      "--dump-single-json",
      "--skip-download",
      "--no-warnings",
      "--no-playlist",
      "--socket-timeout", "20",
      "--retries", "2",
      "--extractor-retries", "2",
      $YoutubeUrl
    )

    # Read both streams directly. Windows PowerShell can occasionally lose
    # redirected output when Start-Process exits quickly, which previously
    # made every failure look like missing metadata.
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $YtDlpPath
    $startInfo.Arguments = ($arguments -join " ")
    $startInfo.WorkingDirectory = $ToolDirectory
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.EnvironmentVariables["TEMP"] = $runtimeTempPath
    $startInfo.EnvironmentVariables["TMP"] = $runtimeTempPath

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    if (-not $process.Start()) { throw "The metadata tool could not be started" }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit(60000)) {
      try { $process.Kill() } catch {}
      $process.WaitForExit()
      throw "YouTube metadata request exceeded 60 seconds"
    }

    $jsonOutput = $stdoutTask.Result
    $errorOutput = $stderrTask.Result
    if ($process.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($jsonOutput)) {
      $errorLine = ($errorOutput -split "`r?`n" | Where-Object { $_ -match "ERROR:" } | Select-Object -Last 1)
      if (-not $errorLine) {
        $errorLine = ($errorOutput -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Last 1)
      }
      if (-not $errorLine) { $errorLine = "The metadata tool returned no details" }
      throw $errorLine.Trim()
    }
    return $jsonOutput
  } finally {
    if ($process) { $process.Dispose() }
  }
}

$processed = 0
$shortVideos = 0
$videos = 0
$failed = 0
$attemptedVideoIds = [System.Collections.Generic.HashSet[string]]::new()
$failedVideoIds = [System.Collections.Generic.HashSet[string]]::new()
$failureMessages = [System.Collections.Generic.Dictionary[string,string]]::new()

Write-Section "Classification progress"
Write-Host ("  Target: up to " + $maximumVideos + " videos") -ForegroundColor Gray

while ($attemptedVideoIds.Count -lt $maximumVideos) {
  $remaining = $maximumVideos - $attemptedVideoIds.Count
  $batchLimit = [Math]::Min(10, $remaining)
  $failedOffset = $failedVideoIds.Count
  Write-Host ("`n  [LOAD] Fetching the next batch... " + $attemptedVideoIds.Count + "/" + $maximumVideos + " checked") -ForegroundColor Cyan
  try {
    $batch = Invoke-ClassifierRequest -Method Get -Uri "${endpoint}?limit=${batchLimit}&offset=${failedOffset}" -Headers $headers
  } catch {
    $serverMessage = $_.Exception.Message
    if ($_.ErrorDetails.Message) {
      try {
        $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
        if ($errorBody.error) { $serverMessage = $errorBody.error }
      } catch {
        $serverMessage = $_.ErrorDetails.Message
      }
    }
    throw "Unable to load videos: $serverMessage"
  }
  if (-not $batch.videos -or $batch.videos.Count -eq 0) { break }

  $attemptedBeforeBatch = $attemptedVideoIds.Count
  $results = @()
  foreach ($item in $batch.videos) {
    if (-not $attemptedVideoIds.Add([string]$item.id)) { continue }
    $progressPercent = [Math]::Min(100, [Math]::Floor(($attemptedVideoIds.Count / $maximumVideos) * 100))
    $displayTitle = [string]$item.title
    if ($displayTitle.Length -gt 76) { $displayTitle = $displayTitle.Substring(0, 73) + "..." }
    Write-Host ("  [{0,3}%] [{1}/{2}] " -f $progressPercent, $attemptedVideoIds.Count, $maximumVideos) -ForegroundColor Cyan -NoNewline
    Write-Host $displayTitle -ForegroundColor White
    try {
      $youtubeUrl = "https://www.youtube.com/watch?v=$($item.video_id)"
      $jsonOutput = Get-VideoMetadataJson -YtDlpPath $ytDlpPath -YoutubeUrl $youtubeUrl -ToolDirectory $toolDirectory
      $metadata = $jsonOutput | ConvertFrom-Json
      $width = [int]($metadata.width)
      $height = [int]($metadata.height)

      if ($width -le 0 -or $height -le 0) {
        $format = $metadata.formats |
          Where-Object { $_.vcodec -ne "none" -and $_.width -gt 0 -and $_.height -gt 0 } |
          Sort-Object @{ Expression = { [int64]$_.width * [int64]$_.height }; Descending = $true } |
          Select-Object -First 1
        if (-not $format) { throw "No video dimensions returned" }
        $width = [int]$format.width
        $height = [int]$format.height
      }

      $videoType = if ($height -gt $width) { "short_video" } else { "video" }
      $results += @{ id = $item.id; videoType = $videoType }
      if ($videoType -eq "short_video") { $shortVideos++ } else { $videos++ }
      $processed++
      $displayType = if ($videoType -eq "short_video") { "Short video" } else { "Video" }
      Write-Host ("         [SUCCESS] " + $width + "x" + $height + " -> " + $displayType) -ForegroundColor Green
    } catch {
      $failureMessage = $_.Exception.Message
      Write-Host ("         [SKIPPED] " + $item.video_id + " - " + $failureMessage) -ForegroundColor Yellow
      if ($failedVideoIds.Add([string]$item.id)) {
        $failureMessages[[string]$item.video_id] = $failureMessage
        $failed++
      }
    }
  }

  if ($attemptedVideoIds.Count -eq $attemptedBeforeBatch) {
    Write-Host "  [COMPLETE] No additional unclassified videos are available." -ForegroundColor Cyan
    break
  }

  if ($results.Count -gt 0) {
    $payload = @{ results = $results } | ConvertTo-Json -Depth 4
    try {
      Write-Host "  [SAVE] Saving successful classifications..." -ForegroundColor Cyan
      $response = Invoke-ClassifierRequest -Method Patch -Uri $endpoint -Headers $headers -Body $payload
      Write-Host ("  [SUCCESS] Saved " + $response.updated + " classifications.") -ForegroundColor Green
      if ($response.updated -eq 0) { throw "The server did not accept any classifications" }
    } catch {
      throw "Classification succeeded locally, but the results could not be saved. Copy a new code and retry."
    }
  }
}

Write-Section "Result summary"
$totalChecked = $processed + $failed
$successRate = if ($totalChecked -gt 0) { [Math]::Round(($processed / $totalChecked) * 100, 1) } else { 0 }
Write-Divider -Color DarkGray
Write-Host ("  STATUS           COMPLETED") -ForegroundColor Green
Write-Host ("  TOTAL CHECKED    " + $totalChecked) -ForegroundColor White
Write-Host ("  SUCCESSFUL       " + $processed) -ForegroundColor Green
Write-Host ("  SHORT VIDEOS     " + $shortVideos) -ForegroundColor Cyan
Write-Host ("  VIDEOS           " + $videos) -ForegroundColor Cyan
Write-Host ("  SKIPPED          " + $failed) -ForegroundColor Yellow
Write-Host ("  SUCCESS RATE     " + $successRate + "%") -ForegroundColor White
Write-Divider -Color DarkGray
if ($failureMessages.Count -gt 0) {
  Write-Host "`n  Skipped video details:" -ForegroundColor Yellow
  foreach ($entry in $failureMessages.GetEnumerator()) {
    Write-Host ("  - " + $entry.Key + ": " + $entry.Value) -ForegroundColor Yellow
  }
}
}

Write-ClassifierHeader
$prompt = "  Temporary access code"
while ($true) {
  Write-Section "Temporary access code"
  Write-Host "  Copy a fresh code from Admin > Fetch videos." -ForegroundColor Gray
  Write-Host "  The code is hidden while you paste it. Press Enter without a code to exit." -ForegroundColor DarkGray
  $accessCode = Read-SecretText $prompt
  if ([string]::IsNullOrWhiteSpace($accessCode)) { break }

  try {
    Invoke-ClassificationSession $accessCode.Trim()
  } catch {
    Write-Section "Classification failed"
    Write-Host ("  [FAILED] " + $_.Exception.Message) -ForegroundColor Red
  }

  Write-Section "Next action"
  Write-Host "  [1] Start another classification round" -ForegroundColor Cyan
  Write-Host "  [2] Exit" -ForegroundColor Gray
  do {
    $nextAction = Read-Host "  Select 1 or 2"
    if ($nextAction -ne "1" -and $nextAction -ne "2") {
      Write-Host "  Please enter 1 to continue or 2 to exit." -ForegroundColor Yellow
    }
  } while ($nextAction -ne "1" -and $nextAction -ne "2")
  if ($nextAction -eq "2") { break }
  $prompt = "  New temporary access code"
}

Write-Host "`n  DentalLearn classifier closed safely." -ForegroundColor DarkGray
