# Compila el APK "Pío Vuelo" sin Gradle: aapt2 + javac + d8 + zipalign + apksigner
# Requiere: JDK 17+ instalado y Android SDK (platform-tools, platforms;android-34, build-tools;34.0.0)
# Con anuncios: incluye el SDK de Google Mobile Ads (GMA Next-Gen) que se descarga
#               solo a android\libs con fetch-libs.ps1
param([switch]$NoAds)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
$outDir = Join-Path $root 'dist'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

# ------ rutas de herramientas ------
$jdk = $env:JAVA_HOME
if (-not $jdk -or -not (Test-Path (Join-Path $jdk 'bin\javac.exe'))) {
  if (Test-Path "$env:USERPROFILE\jdk17\extracted") {
    $jdk = (Get-ChildItem "$env:USERPROFILE\jdk17\extracted" -Directory | Select-Object -First 1).FullName
  } else {
    throw 'No se encontró el JDK. Define JAVA_HOME o instala JDK 17.'
  }
}
$sdk = $env:ANDROID_HOME
if (-not $sdk) {
  if (Test-Path "$env:USERPROFILE\AndroidSDK") { $sdk = "$env:USERPROFILE\AndroidSDK" } else { throw 'No se encontró el Android SDK. Define ANDROID_HOME.' }
}
$buildTools = Join-Path $sdk 'build-tools\34.0.0'
$platform = Join-Path $sdk 'platforms\android-34'
$androidJar = Join-Path $platform 'android.jar'
foreach ($f in @("$buildTools\aapt2.exe", "$buildTools\d8.bat", "$buildTools\zipalign.exe", "$buildTools\apksigner.bat", $androidJar)) {
  if (-not (Test-Path $f)) { throw "Falta: $f" }
}
$env:JAVA_HOME = $jdk
$env:Path = "$jdk\bin;$env:Path"

# El trabajo temporal va fuera del proyecto: OneDrive mueve/borrar archivos
# mientras compila y rompe la extracción de las librerías.
# Carpeta única por compilación para no pelearse con archivos bloqueados.
$work = Join-Path $env:TEMP ('PioVueloBuild_' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $work -Force | Out-Null

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# ejecuta una herramienta de build mostrando su salida si falla
function Invoke-Tool([string]$exe, [string[]]$toolArgs, [string]$what) {
  $ea = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $out = & $exe @toolArgs 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $ea
  if ($code -ne 0) {
    if ($out) { $out | Select-Object -Last 25 | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkRed } }
    throw "$what falló (código $code)"
  }
}

Write-Host '== 1/8 Copiando assets del juego =='
$assets = Join-Path $work 'assets'
if (Test-Path $assets) { Remove-Item $assets -Recurse -Force }
New-Item -ItemType Directory -Path $assets -Force | Out-Null
Copy-Item (Join-Path $root 'index.html') $assets
Copy-Item (Join-Path $root 'manifest.webmanifest') $assets
Copy-Item (Join-Path $root 'sw.js') $assets
Copy-Item -Recurse (Join-Path $root 'css') $assets
Copy-Item -Recurse (Join-Path $root 'js') $assets
Copy-Item -Recurse (Join-Path $root 'icons') $assets

Write-Host '== 2/8 Extrayendo librerías =='
$libJars = @()   # clases que van al DEX
$libRes = @()    # res compilados que se enlazan con los nuestros
$libManifests = @()
$libsDir = Join-Path $scriptDir 'libs'
if (-not $NoAds) {
  if (-not (Test-Path $libsDir)) { throw 'Falta android\libs. Ejecuta: powershell -File fetch-libs.ps1' }
  $libWork = Join-Path $work 'lib'
  New-Item -ItemType Directory -Path $libWork -Force | Out-Null
  $aars = Get-ChildItem $libsDir -Filter *.aar | Sort-Object Name
  if (-not $aars) { throw 'No hay AAR en android\libs. Ejecuta: powershell -File fetch-libs.ps1' }
  foreach ($aar in $aars) {
    $name = [System.IO.Path]::GetFileNameWithoutExtension($aar.Name)
    $dest = Join-Path $libWork $name
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    $zip = [System.IO.Compression.ZipFile]::OpenRead($aar.FullName)
    try {
      foreach ($entryName in @('classes.jar', 'AndroidManifest.xml', 'R.txt')) {
        $entry = $zip.GetEntry($entryName)
        if (-not $entry) { continue }
        $target = Join-Path $dest $entryName
        $fs = [System.IO.File]::Create($target)
        try { $entry.Open().CopyTo($fs) } finally { $fs.Dispose() }
      }
      $resEntries = @($zip.Entries | Where-Object { $_.FullName -like 'res/*' -and $_.Length -gt 0 })
      if ($resEntries.Count -gt 0) {
        $resDest = Join-Path $dest 'res'
        foreach ($entry in $resEntries) {
          $rel = $entry.FullName.Substring(4)
          $target = Join-Path $resDest $rel
          New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
          $fs = [System.IO.File]::Create($target)
          try { $entry.Open().CopyTo($fs) } finally { $fs.Dispose() }
        }
      }
    } finally { $zip.Dispose() }
    $cj = Join-Path $dest 'classes.jar'
    if (Test-Path $cj) { $libJars += $cj }
    if (Test-Path (Join-Path $dest 'AndroidManifest.xml')) { $libManifests += (Join-Path $dest 'AndroidManifest.xml') }
    if (Test-Path (Join-Path $dest 'res')) { $libRes += (Join-Path $dest 'res') }
  }
  Get-ChildItem $libsDir -Filter *.jar | ForEach-Object { $libJars += $_.FullName }
  Write-Host ("   " + $libJars.Count + " clases, " + $libRes.Count + " con recursos, " + $libManifests.Count + " manifest")
} else {
  Write-Host '   (sin anuncios: -NoAds)'
}

Write-Host '== 3/8 Fusionando manifest =='
$appManifest = Join-Path $scriptDir 'AndroidManifest.xml'
$merged = Get-Content -LiteralPath $appManifest -Raw
$merged = $merged -replace '<manifest ', "<manifest xmlns:tools=`"http://schemas.android.com/tools`" "
# aapt2 no sustituye ${applicationId} en este flujo: lo hacemos nosotros
$appId = [regex]::Match($merged, 'package="([^"]+)"').Groups[1].Value
if (-not $appId) { throw 'No se encontro el package en android/AndroidManifest.xml' }
$merged = $merged -replace '\$\{applicationId\}', $appId
$appPerms = @([regex]::Matches($merged, 'android:name="(android\.permission\.[^"]+|com\.google\.android\.gms\.permission\.[^"]+)"') | ForEach-Object { $_.Groups[1].Value })
$appComps = @([regex]::Matches($merged, '<(activity|service|provider|receiver)\s[^>]*android:name="([^"]+)"') | ForEach-Object { $_.Groups[2].Value })

# nodos de un manifest de libreria: auto-cerrados <x .../> y con cierre <x>...</x>
function Get-ManifestNodes([string]$txt, [string]$tag) {
  $out = @()
  foreach ($m in [regex]::Matches($txt, "(?s)<$tag\b[^>]*/>")) { $out += $m.Value }
  foreach ($m in [regex]::Matches($txt, "(?s)<$tag\b[^>]*?>.*?</$tag>")) { $out += $m.Value }
  return $out
}

$permBlock = ''; $compBlock = ''
# <queries> es un unico elemento: se acumulan los hijos de todas las librerias
$queryChildren = New-Object System.Collections.Generic.List[string]
$querySeen = New-Object System.Collections.Generic.HashSet[string]

foreach ($mf in $libManifests) {
  $txt = Get-Content -LiteralPath $mf -Raw
  # permisos (los que la libreria declara y nosotros no)
  foreach ($node in (Get-ManifestNodes $txt 'uses-permission')) {
    if ($node -match 'tools:node="remove"') { continue }
    if ($node -notmatch 'android:name="([^"]+)"') { continue }
    $pname = $Matches[1]
    if ($appPerms -contains $pname) { continue }
    $appPerms += $pname
    $permBlock += "`n    " + $node
  }
  # <permission> (las librerias declaren permisos con nombre de aplicacion)
  foreach ($node in (Get-ManifestNodes $txt 'permission')) {
    if ($node -match 'tools:node="remove"') { continue }
    if ($node -notmatch 'android:name="([^"]+)"') { continue }
    $pname = $Matches[1]
    if ($merged -match [regex]::Escape($pname)) { continue }
    $permBlock += "`n    " + $node
  }
  # <queries> (visibilidad de paquetes en Android 11+)
  foreach ($node in (Get-ManifestNodes $txt 'queries')) {
    $inner = [regex]::Match($node, '(?s)<queries[^>]*>(.*)</queries>').Groups[1].Value
    if (-not $inner) { continue }
    foreach ($cm in [regex]::Matches($inner, '(?s)<(package|intent)\b[^>]*?/>|<(package|intent)\b[^>]*?>.*?</(package|intent)>')) {
      $child = $cm.Value
      if ($querySeen.Add($child)) { $queryChildren.Add($child) }
    }
  }
  # componentes declarados por las librerias (AdActivity, providers, etc.)
  foreach ($tag in @('activity', 'activity-alias', 'service', 'provider', 'receiver')) {
    foreach ($node in (Get-ManifestNodes $txt $tag)) {
      if ($node -match 'tools:node="remove"') { continue }
      if ($node -notmatch 'android:name="([^"]+)"') { continue }
      $cname = $Matches[1]
      # androidX App Startup busca su clase R (androidx.startup.R$string), que
      # no existe en este build manual (las R de las librerías no entran al DEX).
      # La inicialización de ads es explícita en MainActivity, así que se puede omitir.
      if ($cname -eq 'androidx.startup.InitializationProvider') { continue }
      if ($appComps -contains $cname) { continue }
      $appComps += $cname
      $compBlock += "`n    " + $node
    }
  }
  # <meta-data> propio de la libreria
  foreach ($node in (Get-ManifestNodes $txt 'meta-data')) {
    if ($node -match 'tools:node="remove"') { continue }
    if ($node -notmatch 'android:name="([^"]+)"') { continue }
    $mname = $Matches[1]
    if ($merged -match [regex]::Escape($mname)) { continue }
    $compBlock += "`n    " + $node
  }
}
# los atributos tools: solo los usa el merger de Gradle, aapt2 no los necesita
$merged = $merged -replace '\s+tools:[a-zA-Z]+="[^"]*"', ''
$queryBlock = ''
if ($queryChildren.Count -gt 0) {
  $queryBlock = "`n    <queries>`n      " + ($queryChildren -join "`n      ") + "`n    </queries>"
}
$merged = $merged -replace '</manifest>', ($permBlock + $queryBlock + "`n</manifest>")
if ($compBlock) { $merged = $merged -replace '</application>', ($compBlock + "`n  </application>") }
$mergedManifest = Join-Path $work 'AndroidManifest.merged.xml'
# los manifests de las librerias tambien traen ${applicationId} en nombres de permisos
$merged = $merged -replace '\$\{applicationId\}', $appId
Set-Content -LiteralPath $mergedManifest -Value $merged -Encoding UTF8 -NoNewline
Write-Host ("   permisos: " + ($appPerms.Count) + " | componentes: " + ($appComps.Count))

Write-Host '== 4/8 Comprimiendo recursos (aapt2 compile) =='
$resZip = Join-Path $work 'res.zip'
Invoke-Tool "$buildTools\aapt2.exe" @('compile', '--dir', (Join-Path $scriptDir 'res'), '-o', $resZip) 'aapt2 compile'
$javaDir = Join-Path $work 'java'
New-Item -ItemType Directory -Path $javaDir -Force | Out-Null
$linkArgs = @('link', '-o', (Join-Path $work 'base.apk'), '-I', $androidJar, '--manifest', $mergedManifest, '--java', $javaDir, '-R', $resZip, '--auto-add-overlay')
$libResZips = @()
foreach ($r in $libRes) {
  $z = Join-Path $work ("libres-" + (Split-Path -Leaf (Split-Path -Parent $r)) + ".zip")
  Invoke-Tool "$buildTools\aapt2.exe" @('compile', '--dir', $r, '-o', $z) "aapt2 compile ($r)"
  $libResZips += $z
}
foreach ($z in $libResZips) { $linkArgs += @('-R', $z) }

Write-Host '== 5/8 Vinculando recursos (aapt2 link) =='
Invoke-Tool "$buildTools\aapt2.exe" $linkArgs 'aapt2 link'

Write-Host '== 6/8 Compilando Java a classes.dex =='
$genSrc = Join-Path $work 'src-gen'
New-Item -ItemType Directory -Path (Join-Path $genSrc 'com\piovuelo\game') -Force | Out-Null
Copy-Item (Join-Path $scriptDir 'src\com\piovuelo\game\MainActivity.java') (Join-Path $genSrc 'com\piovuelo\game')
$objDir = Join-Path $work 'obj'
New-Item -ItemType Directory -Path $objDir -Force | Out-Null
# fuentes: MainActivity + el R.java que genera aapt2 (con los ids de recursos ya asignados)
$sources = @((Join-Path $genSrc 'com\piovuelo\game\MainActivity.java'))
$sources += @(Get-ChildItem $javaDir -Filter *.java -Recurse | ForEach-Object { $_.FullName })
$cp = ''
if ($libJars.Count -gt 0) { $cp = ($libJars -join ';') }
$javacArgs = @('-source', '8', '-target', '8', '-encoding', 'UTF-8', '-bootclasspath', $androidJar, '-nowarn', '-Xlint:-options', '-d', $objDir)
if ($cp) { $javacArgs += @('-classpath', $cp) }
$javacArgs += $sources
Invoke-Tool "$jdk\bin\javac.exe" $javacArgs 'javac'
$classesJar = Join-Path $work 'classes.jar'
Invoke-Tool "$jdk\bin\jar.exe" @('cf', $classesJar, '-C', $objDir, '.') 'jar'
$dexDir = Join-Path $work 'dex'
New-Item -ItemType Directory -Path $dexDir -Force | Out-Null
# R8 moderno en vez del d8 de build-tools 34 (8.2.2), que peta con androidx.webkit 1.15.0
$r8Jar = Join-Path $scriptDir 'tools\r8.jar'
if (-not (Test-Path $r8Jar)) { throw 'Falta android\tools\r8.jar. Ejecuta: powershell -File fetch-libs.ps1' }
$d8Args = @('-cp', $r8Jar, 'com.android.tools.r8.D8', '--release', '--lib', $androidJar, '--min-api', '24', '--output', $dexDir, $classesJar) + $libJars
Invoke-Tool "$jdk\bin\java.exe" $d8Args 'd8 (R8)'
$dexFiles = @(Get-ChildItem $dexDir -Filter *.dex)
Write-Host ("   " + $dexFiles.Count + " dex (" + [math]::Round((($dexFiles | Measure-Object Length -Sum).Sum / 1MB), 1) + " MB)")

Write-Host '== 7/8 Empaquetando assets + dex =='
$zip = [System.IO.Compression.ZipFile]::Open((Join-Path $work 'base.apk'), [System.IO.Compression.ZipArchiveMode]::Update)
function Add-ZipEntry([string]$entryName, [string]$filePath) {
  $entry = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
  $es = $entry.Open()
  try {
    $fs = [System.IO.File]::OpenRead($filePath)
    try { $fs.CopyTo($es) } finally { $fs.Dispose() }
  } finally { $es.Dispose() }
}
foreach ($dex in $dexFiles) { Add-ZipEntry $dex.Name $dex.FullName }
Get-ChildItem $assets -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($assets.Length + 1).Replace('\', '/')
  Add-ZipEntry ("assets/" + $rel) $_.FullName
}
$zip.Dispose()

Write-Host '== 8/8 Alineando y firmando =='
$aligned = Join-Path $work 'aligned.apk'
Invoke-Tool "$buildTools\zipalign.exe" @('-f', '4', (Join-Path $work 'base.apk'), $aligned) 'zipalign'

$keystore = Join-Path $scriptDir 'debug.keystore'
if (-not (Test-Path $keystore)) {
  & "$jdk\bin\keytool.exe" -genkeypair -v -keystore $keystore -storepass android -alias piovuelo -keypass android -dname "CN=Pio Vuelo, O=PioVuelo, C=US" -keyalg RSA -keysize 2048 -validity 10000 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'keytool falló' }
}
$finalApk = Join-Path $outDir 'PioVuelo.apk'
Invoke-Tool "$buildTools\apksigner.bat" @('sign', '--ks', $keystore, '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', $finalApk, $aligned) 'apksigner'

Write-Host ''
Write-Host "APK generado: $finalApk ($([math]::Round((Get-Item $finalApk).Length / 1MB, 1)) MB)"
& "$buildTools\apksigner.bat" verify --print-certs $finalApk 2>$null
Write-Host 'Build completo.'
