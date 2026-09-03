$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "DentalLearn Video Classifier"

Write-Host "DentalLearn Video Orientation Classifier" -ForegroundColor Cyan
Write-Host "Classifies portrait videos as short_video and all other videos as video."
Write-Host "No video files are downloaded.`n"

$secureAccessCode = Read-Host "Paste the temporary access code from the Admin page" -AsSecureString
$accessCodePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureAccessCode)
try {
  $accessCode = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($accessCodePointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($accessCodePointer)
}
$separator = $accessCode.IndexOf("|")
if ($separator -lt 1) {
  throw "The access code format is invalid. Copy a new code from the Admin page."
}
$siteOrigin = $accessCode.Substring(0, $separator).TrimEnd("/")
$token = $accessCode.Substring($separator + 1).Trim()
$endpoint = "$siteOrigin/dental-api/orientation-videos"
$headers = @{ Authorization = "Bearer $token" }

$maximumText = Read-Host "Maximum videos to classify this run (1-500, default 10)"
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
  Write-Host "Downloading the orientation metadata tool..."
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
}

$processed = 0
$shortVideos = 0
$videos = 0
$failed = 0
$classifiedResults = @()

while (($processed + $failed) -lt $maximumVideos) {
  $remaining = $maximumVideos - ($processed + $failed)
  $batchLimit = [Math]::Min(10, $remaining)
  try {
    $batch = Invoke-RestMethod -Method Get -Uri "${endpoint}?limit=$batchLimit" -Headers $headers
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

  $results = @()
  foreach ($item in $batch.videos) {
    Write-Host ("Checking: " + $item.title)
    try {
      $youtubeUrl = "https://www.youtube.com/watch?v=$($item.video_id)"
      $jsonOutput = & $ytDlpPath --dump-single-json --skip-download --no-warnings --no-playlist $youtubeUrl 2>$null | Out-String
      if ($LASTEXITCODE -ne 0 -or -not $jsonOutput.Trim()) { throw "Metadata unavailable" }
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
    } catch {
      Write-Warning ("Skipped " + $item.video_id + ": " + $_.Exception.Message)
      $failed++
    }
  }

  if ($results.Count -eq 0) { break }
  $payload = @{ results = $results } | ConvertTo-Json -Depth 4
  try {
    $response = Invoke-RestMethod -Method Patch -Uri $endpoint -Headers $headers -ContentType "application/json" -Body $payload
    Write-Host ("Saved " + $response.updated + " classifications.`n") -ForegroundColor Green
    if ($response.updated -eq 0) { throw "The server did not accept any classifications" }
    foreach ($classified in $response.classified) {
      $classifiedResults += @{ i = $classified.id; t = $classified.videoType }
    }
  } catch {
    throw "Classification succeeded locally, but the results could not be saved. Copy a new code and retry."
  }
}

Write-Host "Classification complete" -ForegroundColor Green
Write-Host "Processed: $processed"
Write-Host "Short videos: $shortVideos"
Write-Host "Videos: $videos"
Write-Host "Skipped: $failed"

if ($classifiedResults.Count -gt 0) {
  $reportIds = @()
  $reportTypes = ""
  foreach ($classified in $classifiedResults) {
    $reportIds += $classified.i.Replace("-", "")
    $reportTypes += if ($classified.t -eq "short_video") { "1" } else { "0" }
  }
  $reportJson = @{ i = $reportIds; t = $reportTypes } | ConvertTo-Json -Compress -Depth 3
  $reportBytes = [Text.Encoding]::UTF8.GetBytes($reportJson)
  $reportCode = [Convert]::ToBase64String($reportBytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
  $reportUrl = "$siteOrigin/admin/fetch-videos#orientation-results=$reportCode"
  Write-Host "Opening the classification report in your browser..." -ForegroundColor Cyan
  Start-Process $reportUrl
}

Read-Host "Press Enter to close"
