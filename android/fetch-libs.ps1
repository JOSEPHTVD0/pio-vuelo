# Descarga y cachea el grafo de librerias del SDK de Google Mobile Ads (Next-Gen)
# Resuelve los .pom de forma recursiva y baja cada .aar/.jar a android\libs\
# Uso: powershell -ExecutionPolicy Bypass -File fetch-libs.ps1
param(
  [string]$Root = 'com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk:1.4.0'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$libsDir = Join-Path $scriptDir 'libs'
New-Item -ItemType Directory -Path $libsDir -Force | Out-Null

$repos = @(
  'https://dl.google.com/dl/android/maven2',
  'https://repo1.maven.org/maven2'
)

function Get-RemoteText([string]$url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 90
    if ($r.Content -is [byte[]]) { return [System.Text.Encoding]::UTF8.GetString($r.Content) }
    return [string]$r.Content
  } catch {
    return $null
  }
}

function Get-Text([string]$url) {
  $p = Join-Path $libsDir ([System.IO.Path]::GetFileName($url))
  if (Test-Path $p) { return (Get-Content -LiteralPath $p -Raw) }
  return $null
}

# --- POM: propiedades, dependencyManagement y dependencias -------------------
function Read-Pom([string]$g, [string]$a, [string]$v) {
  $rel = ($g -replace '\.', '/') + "/$a/$v/$a-$v.pom"
  $file = Join-Path $libsDir "$a-$v.pom"
  $text = $null
  foreach ($repo in $repos) {
    $url = "$repo/$rel"
    if (Test-Path $file) { $text = Get-Content -LiteralPath $file -Raw; break }
    $text = Get-RemoteText $url
    if ($text) { Set-Content -LiteralPath $file -Value $text -Encoding UTF8; break }
  }
  if (-not $text) { Write-Host "  ! no se pudo leer POM $g`:$a`:$v" -ForegroundColor Yellow; return $null }

  $x = $null
  try { $x = [xml]$text } catch { return $null }

  $props = @{}
  $managed = @{}
  $deps = @()

  # properties heredadas del parent (1 nivel, por seguridad)
  $parentNode = $x.project.parent
  if ($parentNode) {
    $pg = $parentNode.groupId; $pa = $parentNode.artifactId; $pv = $parentNode.version
    if ($pv -match '^\$\{') { $pv = $props[$pv.Trim('${}')] }
    if ($pg -and $pa -and $pv) {
      $prel = ($pg -replace '\.', '/') + "/$pa/$pv/$pa-$pv.pom"
      $ptext = $null
      foreach ($repo in $repos) {
        if (Test-Path (Join-Path $libsDir "$pa-$pv.pom")) { $ptext = Get-Content -LiteralPath (Join-Path $libsDir "$pa-$pv.pom") -Raw; break }
        $ptext = Get-RemoteText "$repo/$prel"
        if ($ptext) { Set-Content -LiteralPath (Join-Path $libsDir "$pa-$pv.pom") -Value $ptext -Encoding UTF8; break }
      }
      if ($ptext) {
        try {
          $px = [xml]$ptext
          if ($px.project.properties) {
            foreach ($n in $px.project.properties.ChildNodes) { $props[$n.Name] = $n.InnerText }
          }
          if ($px.project.dependencyManagement.dependencies) {
            foreach ($d in $px.project.dependencyManagement.dependencies.dependency) {
              $managed["$($d.groupId):$($d.artifactId)"] = $d.version
            }
          }
        } catch { }
      }
    }
  }

  if ($x.project.properties) {
    foreach ($n in $x.project.properties.ChildNodes) { $props[$n.Name] = $n.InnerText }
  }
  $props['project.version'] = $v
  $props['project.groupId'] = $g

  if ($x.project.dependencyManagement.dependencies) {
    foreach ($d in $x.project.dependencyManagement.dependencies.dependency) {
      $managed["$($d.groupId):$($d.artifactId)"] = $d.version
    }
  }

  if ($x.project.dependencies) {
    foreach ($d in $x.project.dependencies.dependency) {
      $scope = if ($d.scope) { [string]$d.scope } else { 'compile' }
      $type = if ($d.type) { [string]$d.type } else { 'jar' }
      $opt = if ($d.optional) { [string]$d.optional } else { 'false' }
      $deps += [pscustomobject]@{
        groupId = [string]$d.groupId; artifactId = [string]$d.artifactId
        version = [string]$d.version; scope = $scope; type = $type; optional = $opt
      }
    }
  }

  return [pscustomobject]@{ props = $props; managed = $managed; deps = $deps; packaging = [string]$x.project.packaging }
}

function Resolve-Version([string]$ver, [hashtable]$props, [hashtable]$managed, [string]$g, [string]$a) {
  if (-not $ver) { $ver = $managed["$g`:$a"] }
  if (-not $ver) { return $null }
  for ($i = 0; $i -lt 5 -and $ver -match '\$\{([^}]+)\}'; $i++) {
    $key = $Matches[1]
    if ($props.ContainsKey($key)) { $ver = $ver -replace ('\$\{' + [regex]::Escape($key) + '\}'), $props[$key] }
    else { return $null }
  }
  if ($ver -match '\$\{') { return $null }
  # rangos exactos tipo [1.0.0] -> 1.0.0
  $ver = ($ver -replace '^\[|\]$', '').Trim()
  return $ver
}

# --- comparacion de versiones -------------------------------------------------
function Compare-Ver([string]$a, [string]$b) {
  if ($a -eq $b) { return 0 }
  $pa = @($a -split '[.\-+]'); $pb = @($b -split '[.\-+]')
  $n = [math]::Max($pa.Count, $pb.Count)
  for ($i = 0; $i -lt $n; $i++) {
    $x = if ($i -lt $pa.Count) { $pa[$i] } else { '0' }
    $y = if ($i -lt $pb.Count) { $pb[$i] } else { '0' }
    $nx = 0; $ny = 0
    if ([int]::TryParse($x, [ref]$nx) -and [int]::TryParse($y, [ref]$ny)) {
      if ($nx -ne $ny) { return [math]::Sign($nx - $ny) }
    } elseif ($x -ne $y) {
      $c = [string]::Compare($x, $y, [System.StringComparison]::OrdinalIgnoreCase)
      if ($c -ne 0) { return [math]::Sign($c) }
    }
  }
  return 0
}

# devuelve las dependencias transitivas de un POM (ya resueltas)
function Get-PomDeps($pom, $g, $a) {
  $deps = @()
  foreach ($d in $pom.deps) {
    if ($d.optional -eq 'true') { continue }
    if ($d.scope -ne 'compile' -and $d.scope -ne 'runtime') { continue }
    if ($d.type -and $d.type -ne 'aar' -and $d.type -ne 'jar' -and $d.type -ne 'bundle') { continue }
    $dv = Resolve-Version $d.version $pom.props $pom.managed $d.groupId $d.artifactId
    if (-not $dv) { Write-Host "   ? sin version: $($d.groupId):$($d.artifactId)" -ForegroundColor DarkYellow; continue }
    $deps += [pscustomobject]@{ g = $d.groupId; a = $d.artifactId; v = $dv }
  }
  return $deps
}

$rootParts = $Root -split ':'

# --- 1a pasada: descubrir la version mas alta de cada artefacto ---------------
Write-Host "Resolviendo dependencias de $Root"
$queue = New-Object System.Collections.Queue
$queue.Enqueue(@{ g = $rootParts[0]; a = $rootParts[1]; v = $rootParts[2] })
$visited = @{}
$best = @{}
while ($queue.Count -gt 0) {
  $cur = $queue.Dequeue()
  $vk = "$($cur.g):$($cur.a):$($cur.v)"
  if ($visited.ContainsKey($vk)) { continue }
  $visited[$vk] = $true
  $gk = "$($cur.g):$($cur.a)"
  if (-not $best.ContainsKey($gk) -or (Compare-Ver $cur.v $best[$gk]) -gt 0) {
    if ($best.ContainsKey($gk)) { Write-Host "   ~ $($cur.g):$($cur.a) $($best[$gk]) -> $($cur.v)" -ForegroundColor DarkCyan }
    $best[$gk] = $cur.v
  }
  $pom = Read-Pom $cur.g $cur.a $cur.v
  if (-not $pom) { continue }
  foreach ($d in (Get-PomDeps $pom $cur.g $cur.a)) { $queue.Enqueue(@{ g = $d.g; a = $d.a; v = $d.v }) }
}

# --- 2a pasada: grafo final, una sola version por artefacto --------------------
Write-Host ''
Write-Host 'Grafo final:'
$queue = New-Object System.Collections.Queue
$queue.Enqueue(@{ g = $rootParts[0]; a = $rootParts[1]; v = $rootParts[2] })
$seen = @{}
$artifacts = @()
while ($queue.Count -gt 0) {
  $cur = $queue.Dequeue()
  $gk = "$($cur.g):$($cur.a)"
  if ($seen.ContainsKey($gk)) { continue }
  $v = $cur.v
  if ($best.ContainsKey($gk)) { $v = $best[$gk] }
  $seen[$gk] = $v
  $pom = Read-Pom $cur.g $cur.a $v
  if (-not $pom) { continue }
  $artifacts += [pscustomobject]@{ g = $cur.g; a = $cur.a; v = $v; type = $pom.packaging }
  foreach ($d in (Get-PomDeps $pom $cur.g $cur.a)) { $queue.Enqueue(@{ g = $d.g; a = $d.a; v = $d.v }) }
}

# --- limpieza de artefactos redundantes ---------------------------------------
# Kotlin >= 1.8: kotlin-stdlib-jdk7/jdk8/common son envoltorios vacios que
# duplican las clases de kotlin-stdlib y rompen el dexado.
# Kotlin multiplatform: el artefacto "raiz" (okio, kotlinx-coroutines-core) es
# solo metadatos; las clases estan en el variante "-jvm".
$drop = New-Object System.Collections.Generic.HashSet[string]
$have = @{}
foreach ($art in $artifacts) { $have["$($art.a)"] = $art.v }
$ks = $have['kotlin-stdlib']
if ($ks -and (Compare-Ver $ks '1.8.0') -ge 0) {
  foreach ($a in @('kotlin-stdlib-jdk7', 'kotlin-stdlib-jdk8', 'kotlin-stdlib-common')) {
    if ($have.ContainsKey($a)) { $drop.Add($a) | Out-Null }
  }
}
foreach ($art in @($artifacts)) {
  if ($have.ContainsKey("$($art.a)-jvm")) { $drop.Add($art.a) | Out-Null }
}
if ($drop.Count -gt 0) {
  $artifacts = @($artifacts | Where-Object { -not $drop.Contains($_.a) })
}

# --- descarga de los binarios -------------------------------------------------
Write-Host ''
Write-Host 'Descargando binarios:'
$missing = @()
foreach ($art in $artifacts) {
  $ext = if ($art.type -eq 'aar') { 'aar' } else { 'jar' }
  $file = Join-Path $libsDir "$($art.a)-$($art.v).$ext"
  if (Test-Path $file) { Write-Host "  = $($art.a)-$($art.v).$ext (cache)"; continue }
  $rel = ($art.g -replace '\.', '/') + "/$($art.a)/$($art.v)/$($art.a)-$($art.v).$ext"
  $ok = $false
  foreach ($repo in $repos) {
    $url = "$repo/$rel"
    try {
      Invoke-WebRequest -Uri $url -OutFile $file -UseBasicParsing -TimeoutSec 180
      $ok = $true; break
    } catch { }
  }
  if ($ok) { Write-Host "  + $($art.a)-$($art.v).$ext" -ForegroundColor Green }
  else { Write-Host "  ! FALLO $($art.g):$($art.a):$($art.v)" -ForegroundColor Red; $missing += "$($art.g):$($art.a):$($art.v)" }
}

Write-Host ''
if ($missing.Count -gt 0) {
  Write-Host "Faltaron: $($missing -join ', ')" -ForegroundColor Red
  exit 1
}

# borra binarios de descargas anteriores que ya no forman parte del grafo
# (si no, build.ps1 los mete en el DEX y aparecen clases duplicadas)
$expected = @{}
foreach ($art in $artifacts) {
  $ext = if ($art.type -eq 'aar') { 'aar' } else { 'jar' }
  $expected["$($art.a)-$($art.v).$ext"] = $true
}
foreach ($f in @(Get-ChildItem $libsDir -File | Where-Object { $_.Extension -in @('.jar', '.aar') })) {
  if (-not $expected.ContainsKey($f.Name)) {
    Write-Host "  - $($f.Name) (obsoleto)"
    Remove-Item $f.FullName -Force
  }
}

$total = ($artifacts | Measure-Object).Count
Write-Host "Listo: $total artefactos en $libsDir"

# --- R8 (dexador) --------------------------------------------------------------
# El d8 que viene en build-tools 34.0.0 (8.2.2) peta con un NPE al procesar
# androidx.webkit:webkit 1.15.0, asi que usamos una version moderna de R8.
Write-Host ''
Write-Host 'Descargando R8 (dexador):'
$toolsDir = Join-Path $scriptDir 'tools'
New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
$r8Jar = Join-Path $toolsDir 'r8.jar'
$r8Version = $env:R8_VERSION
if (-not $r8Version) {
  try {
    $meta = Get-RemoteText 'https://dl.google.com/dl/android/maven2/com/android/tools/r8/maven-metadata.xml'
    $all = @([regex]::Matches($meta, '<version>([^<]+)</version>') | ForEach-Object { $_.Groups[1].Value })
    $stable = @($all | Where-Object { $_ -notmatch 'dev|alpha|beta' -and $_ -match '^8\.' })
    if ($stable.Count -gt 0) { $r8Version = $stable[-1] }
  } catch { }
}
if (-not $r8Version) { $r8Version = '8.13.24' }
if (Test-Path $r8Jar) {
  Write-Host "  = r8.jar (cache, version $r8Version)"
} else {
  $url = "https://dl.google.com/dl/android/maven2/com/android/tools/r8/$r8Version/r8-$r8Version.jar"
  try {
    Invoke-WebRequest -Uri $url -OutFile $r8Jar -UseBasicParsing -TimeoutSec 600
    Write-Host ("  + r8 $r8Version (" + [math]::Round((Get-Item $r8Jar).Length / 1MB, 1) + " MB)" ) -ForegroundColor Green
  } catch {
    Write-Host "  ! FALLO la descarga de R8" -ForegroundColor Red
    exit 1
  }
}
