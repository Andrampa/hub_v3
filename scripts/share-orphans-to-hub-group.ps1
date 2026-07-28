<#
.SYNOPSIS
Shares DIEM products that are missing from the DIEM Hub content group.

.DESCRIPTION
The Hub only displays products that belong to the DIEM Hub content group.
Items that reach a public surface (for example the Countries pages) without
that membership are curation gaps: the Hub hides them, even though they are
legitimate published products.

This script finds every item in the Countries group that is not in the Hub
content group and shares it with the Hub group. It is idempotent; rerunning it
after a successful pass reports nothing to do.

.PARAMETER Token
An ArcGIS Online token for an account that can share the items (the item owner,
or a group/organization administrator). Generate one from your own session; do
not commit it. If omitted the script reads the ARCGIS_TOKEN environment
variable.

.PARAMETER WhatIf
Lists the items that would be shared without changing anything.

.EXAMPLE
$env:ARCGIS_TOKEN = '<token>'
.\scripts\share-orphans-to-hub-group.ps1 -WhatIf
.\scripts\share-orphans-to-hub-group.ps1
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$Token = $env:ARCGIS_TOKEN,
  [string]$HubGroupId = 'ab8a43038b6347ac93507988f7e2a90b',
  [string]$CountryGroupId = 'c27d3dbba52343c6addfd61edaaa3e86'
)

$ErrorActionPreference = 'Stop'
$restRoot = 'https://www.arcgis.com/sharing/rest'

if (-not $Token) {
  throw 'No token supplied. Set $env:ARCGIS_TOKEN or pass -Token. Never commit the value.'
}

function Invoke-ArcGISRest {
  param([string]$Uri, [hashtable]$Body)
  $response = if ($Body) {
    Invoke-RestMethod -Uri $Uri -Method Post -Body $Body
  } else {
    Invoke-RestMethod -Uri $Uri -Method Get
  }
  # ArcGIS reports failures inside a 200 response, so the error must be read
  # from the payload rather than from the HTTP status code.
  if ($response.error) { throw "ArcGIS error $($response.error.code): $($response.error.message)" }
  return $response
}

Write-Host 'Checking the current identity...'
$self = Invoke-ArcGISRest -Uri "$restRoot/community/self?f=json&token=$Token"
if (-not $self.username) { throw 'The token did not resolve to a user. It may be expired.' }
Write-Host "  Signed in as $($self.username)"

Write-Host 'Finding products missing from the Hub group...'
$orphans = @()
$start = 1
while ($start -gt 0) {
  $query = [uri]::EscapeDataString("group:$CountryGroupId -group:$HubGroupId")
  $page = Invoke-ArcGISRest -Uri "$restRoot/search?f=json&q=$query&num=100&start=$start&token=$Token"
  $orphans += $page.results
  $start = $page.nextStart
}

if (-not $orphans) {
  Write-Host 'Nothing to do: every Countries product is already in the Hub group.'
  return
}

Write-Host "Found $($orphans.Count) item(s) to share:"
$orphans | ForEach-Object { Write-Host "  $($_.id)  [$($_.type)] $($_.title)" }

$shared = 0
$failed = @()
foreach ($item in $orphans) {
  $label = "$($item.title) ($($item.id))"
  if (-not $PSCmdlet.ShouldProcess($label, "Share with Hub group $HubGroupId")) { continue }
  try {
    # Sharing runs against the owner's item endpoint; an administrator token
    # works here too because ArcGIS resolves the owner from the item itself.
    $result = Invoke-ArcGISRest `
      -Uri "$restRoot/content/users/$($item.owner)/items/$($item.id)/share" `
      -Body @{ f = 'json'; token = $Token; groups = $HubGroupId }
    if ($result.notSharedWith -and $result.notSharedWith.Count -gt 0) {
      throw "ArcGIS declined to share with group(s): $($result.notSharedWith -join ', ')"
    }
    $shared++
    Write-Host "  shared: $label"
  } catch {
    $failed += [pscustomobject]@{ Item = $label; Reason = $_.Exception.Message }
    Write-Warning "  FAILED: $label -> $($_.Exception.Message)"
  }
}

Write-Host ''
Write-Host "Shared $shared of $($orphans.Count) item(s)."
if ($failed) {
  Write-Host 'The following items still need attention:'
  $failed | ForEach-Object { Write-Host "  $($_.Item): $($_.Reason)" }
  exit 1
}
