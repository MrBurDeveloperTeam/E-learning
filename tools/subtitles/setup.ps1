$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) { throw 'Install uv from https://docs.astral.sh/uv/getting-started/installation/ first.' }
if (-not (Test-Path '.venv\Scripts\python.exe')) {
    uv venv --python 3.11
    if ($LASTEXITCODE) { throw 'Could not create Python environment.' }
}
uv pip install --python .venv\Scripts\python.exe -r requirements-lock.txt
if ($LASTEXITCODE) { throw 'Dependency installation failed.' }
Write-Host 'Ready. Use start-api.cmd for e-learning, or start.cmd for the desktop tool.'
