[CmdletBinding()]
param(
  [string]$DeploymentRepository = 'C:\git\fao-oer-diem-hub',
  [switch]$AllowDirtyDeploymentRepository
)

$ErrorActionPreference = 'Stop'

$sourceRepository = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$expectedRemote = 'https://github.com/un-fao/fao-oer-diem-hub.git'
$allowedPaths = @(
  '.github',
  'src',
  '.gitignore',
  'index.html',
  'oauth-callback.html',
  'package.json',
  'package-lock.json',
  'tsconfig.app.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts'
)

function Get-GitOutput([string]$Repository, [string[]]$Arguments) {
  $result = & git -C $Repository @Arguments
  if ($LASTEXITCODE -ne 0) { throw "git $($Arguments -join ' ') failed in $Repository" }
  return ($result | Out-String).Trim()
}

$deploymentRepository = (Resolve-Path $DeploymentRepository).Path
if ($deploymentRepository -eq $sourceRepository) { throw 'The deployment repository must be separate from the development repository.' }
if (-not (Test-Path (Join-Path $deploymentRepository '.git'))) { throw "No Git repository found at $deploymentRepository" }
if ((Get-GitOutput $deploymentRepository @('remote', 'get-url', 'origin')) -ne $expectedRemote) { throw 'The deployment checkout origin is not the approved FAO repository.' }
if (-not $AllowDirtyDeploymentRepository -and (Get-GitOutput $deploymentRepository @('status', '--porcelain'))) { throw 'Deployment checkout is dirty. Inspect it, or rerun with -AllowDirtyDeploymentRepository for an intentional migration.' }

$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("diem-hub-web-" + [guid]::NewGuid())
$stagingDirectory = Join-Path $temporaryRoot 'payload'
New-Item -ItemType Directory -Path $stagingDirectory -Force | Out-Null

try {
  foreach ($path in $allowedPaths) {
    $from = Join-Path $sourceRepository $path
    $to = Join-Path $stagingDirectory $path
    if (-not (Test-Path $from)) { throw "Required deployment path is missing: $path" }
    if ((Get-Item $from).PSIsContainer) {
      Copy-Item -LiteralPath $from -Destination $to -Recurse -Force
    } else {
      Copy-Item -LiteralPath $from -Destination $to -Force
    }
  }

  @'
node_modules/
dist/
.env
.env.*
!.env.example
*.local
*.log
.DS_Store
Thumbs.db
'@ | Set-Content -LiteralPath (Join-Path $stagingDirectory '.gitignore') -NoNewline

  @'
{
  "projects": {
    "default": "fao-oer"
  }
}
'@ | Set-Content -LiteralPath (Join-Path $stagingDirectory '.firebaserc') -NoNewline

  @'
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
'@ | Set-Content -LiteralPath (Join-Path $stagingDirectory 'firebase.json') -NoNewline

  $workflowDirectory = Join-Path $stagingDirectory '.github\workflows'
  New-Item -ItemType Directory -Path $workflowDirectory -Force | Out-Null
  @'
name: Manual Deploy

on:
  workflow_dispatch:
    inputs:
      ref:
        description: Branch or tag to deploy
        required: true
        type: string
        default: main
      environment:
        description: Target environment
        required: true
        type: choice
        options: [fao-oer-review, fao-oer]

jobs:
  deploy:
    name: Build and deploy to Firebase Hosting
    runs-on: ubuntu-22.04
    environment: ${{ inputs.environment }}
    permissions:
      id-token: write
      contents: read
      issues: write
    steps:
      - uses: actions/checkout@v7
        with:
          ref: ${{ inputs.ref }}
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: google-github-actions/auth@v3
        with:
          workload_identity_provider: ${{ vars.WORKLOAD_ID_PROVIDER }}
          service_account: ${{ vars.SERVICE_ACCOUNT }}
      - uses: google-github-actions/setup-gcloud@v3
      - run: npm install -g firebase-tools@15.24.0
      - name: Deploy to Firebase
        run: |
          jq --arg site "${{ vars.SITE_ID }}" '.hosting.site = $site' firebase.json > /tmp/firebase.json
          mv /tmp/firebase.json firebase.json
          firebase deploy --project "${{ vars.PROJECT_ID }}" --only hosting
      - name: Create issue on failure
        if: failure()
        uses: un-fao/fao-ga-create-issue@v2
'@ | Set-Content -LiteralPath (Join-Path $workflowDirectory 'manual_deploy.yml') -NoNewline

  $readme = @'
# FAO DIEM Hub web deployment

This repository contains only the source required to build and deploy the DIEM Hub web application. GitHub Actions builds the app and Firebase Hosting publishes `dist/`.

Do not add agent instructions, AI context, internal handoff material, local environment files, or generated build output here. Update this repository with the guarded synchronization script in the development repository.
'@
  Set-Content -LiteralPath (Join-Path $stagingDirectory 'README.md') -Value $readme -NoNewline

  Get-ChildItem -LiteralPath $deploymentRepository -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force
  Get-ChildItem -LiteralPath $stagingDirectory -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $deploymentRepository $_.Name) -Recurse -Force
  }
  Write-Host "Deployment repository prepared at $deploymentRepository. Inspect git status before committing."
}
finally {
  if (Test-Path $temporaryRoot) { Remove-Item -LiteralPath $temporaryRoot -Recurse -Force }
}
