# ─────────────────────────────────────────────────────────────────────────────
# NomachiBot — one-shot GitHub push.
#
# What this does
#   1. Initialises a git repo in this folder (if it isn't one already).
#   2. Sets the remote to your NomachiBot repo on GitHub.
#   3. Stages every file (respecting .gitignore — node_modules is excluded).
#   4. Commits as "Phase 9: security hardening + deploy config".
#   5. Pushes to the `main` branch, overwriting whatever's there.
#
# How to run
#   Right-click this file → "Run with PowerShell".
#   OR open PowerShell in this folder and run:
#       powershell -ExecutionPolicy Bypass -File .\push-to-github.ps1
#
# What it asks for
#   - Your GitHub username (default: BakhtiyorRustamov)
#   - A GitHub Personal Access Token (PAT) with `repo` scope.
#     Generate one at https://github.com/settings/tokens?type=beta
#     Choose: Repositories → Only select repositories → NomachiBot
#             Permissions → Contents: Read and write
#   - Your name + email for the commit author (one-time git config).
#
# Safety
#   - We force-push to `main`. If you have unrelated work on GitHub `main`
#     that ISN'T in this folder, STOP and copy it down first — this will
#     overwrite it.
#   - The PAT is used once and is NOT saved to disk.
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "NomachiBot → GitHub push" -ForegroundColor Cyan
Write-Host "================================================================"

# ── Prereqs ─────────────────────────────────────────────────────────────────
try {
    $gitVersion = git --version
    Write-Host "git found: $gitVersion"
} catch {
    Write-Host "ERROR: git is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Install Git for Windows: https://git-scm.com/download/win" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# ── Prompt for credentials ──────────────────────────────────────────────────
$defaultUser = "BakhtiyorRustamov"
$ghUser = Read-Host "GitHub username [$defaultUser]"
if ([string]::IsNullOrWhiteSpace($ghUser)) { $ghUser = $defaultUser }

$repo = "NomachiBot"
$repoUrl = "https://github.com/$ghUser/$repo.git"
Write-Host "Repo URL: $repoUrl"

$tokenSecure = Read-Host "GitHub Personal Access Token (input hidden)" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokenSecure)
$token = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host "ERROR: token is empty." -ForegroundColor Red
    exit 1
}

# ── Configure git author if missing ─────────────────────────────────────────
$existingName  = (git config --global user.name)  2>$null
$existingEmail = (git config --global user.email) 2>$null
if ([string]::IsNullOrWhiteSpace($existingName)) {
    $authorName = Read-Host "Commit author name (e.g. Baxtiyor Rustamov)"
    git config --global user.name $authorName
}
if ([string]::IsNullOrWhiteSpace($existingEmail)) {
    $authorEmail = Read-Host "Commit author email (e.g. bakhtiyor1chi@gmail.com)"
    git config --global user.email $authorEmail
}

# ── Initialise repo if needed ───────────────────────────────────────────────
if (-not (Test-Path ".git")) {
    Write-Host "Initialising new git repository..." -ForegroundColor Yellow
    git init | Out-Null
    git branch -M main
} else {
    Write-Host "Existing git repo detected."
    # Make sure we're on main
    git checkout -B main | Out-Null
}

# ── Set remote (with embedded token, used only for this push) ───────────────
$authedUrl = "https://$($ghUser):$($token)@github.com/$ghUser/$repo.git"
if ((git remote) -contains "origin") {
    git remote set-url origin $authedUrl | Out-Null
} else {
    git remote add origin $authedUrl | Out-Null
}

# ── Stage + commit ──────────────────────────────────────────────────────────
Write-Host "Staging files..."
git add -A

# Bail out early if there's nothing to commit (e.g. user re-ran the script).
$pending = git status --porcelain
if ([string]::IsNullOrWhiteSpace($pending)) {
    Write-Host "Nothing to commit — working tree is clean." -ForegroundColor Yellow
} else {
    Write-Host "Committing..."
    git commit -m "Phase 9: security hardening + deploy config" | Out-Null
}

# ── Push (force, since the remote likely has unrelated history) ─────────────
Write-Host "Pushing to $repoUrl ..."
$pushOutput = git push --force --set-upstream origin main 2>&1
$pushExit = $LASTEXITCODE

# ── Scrub the token from the remote URL before we leave ─────────────────────
git remote set-url origin "https://github.com/$ghUser/$repo.git" | Out-Null

Write-Host ""
if ($pushExit -eq 0) {
    Write-Host "SUCCESS — pushed to https://github.com/$ghUser/$repo" -ForegroundColor Green
    Write-Host "Render will auto-deploy if you've already connected the repo."
} else {
    Write-Host "Push failed:" -ForegroundColor Red
    Write-Host $pushOutput
    Write-Host ""
    Write-Host "Common causes:"
    Write-Host "  - PAT lacks 'Contents: Read and write' permission on this repo"
    Write-Host "  - Repo doesn't exist yet — create it empty at https://github.com/new"
    Write-Host "  - Token expired"
}

Read-Host "Press Enter to close"
