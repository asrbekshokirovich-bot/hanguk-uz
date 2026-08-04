<#
.SYNOPSIS
    Builds the Play Store bundle (.aab) for the Hanguk student app.

.DESCRIPTION
    Does every step of docs/RELEASE.md steps 0-3 in one go, and refuses to hand you
    a bundle Play will reject:

      * finds the upload keystore and checks its SHA-1 against the certificate
        Play has on file, so "wrong keystore" fails here instead of at upload
      * reads the key alias out of the keystore rather than asking for it
      * writes android/key.properties (gitignored) from what it found
      * builds with --dart-define=STORE_BUILD=true, which is not optional:
        without it the app keeps its APK self-updater active and Play blocks
        the release (this is what happened to 2041)
      * verifies the finished bundle carries the upload certificate - Gradle
        falls back to *debug* signing when key.properties is missing and only
        whispers about it in the log, and Play rejects the result

.PARAMETER Keystore
    Path to the .jks. Omit and the script searches your user folder for one.

.PARAMETER PrintSecrets
    Also print the four values to paste into GitHub -> Settings -> Secrets, so
    future releases can be built by the Actions workflow instead of by hand.

.EXAMPLE
    .\scripts\build-aab.ps1

.EXAMPLE
    .\scripts\build-aab.ps1 -Keystore C:\keys\hanguk-upload.jks -PrintSecrets
#>
[CmdletBinding()]
param(
    [string] $Keystore,
    [switch] $PrintSecrets
)

$ErrorActionPreference = 'Stop'

# The upload certificate shown in Play Console -> App signing. Public
# information, not a secret. Pinned so a wrong keystore is caught in seconds.
$ExpectedSha1 = '8B:BE:B0:6C:B5:A3:A5:DD:E0:B2:8C:F6:30:56:FD:0A:E9:F4:88:0B'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$AppDir   = Join-Path $RepoRoot 'hanguk_app'

# Native commands with `2>&1` are a trap under `$ErrorActionPreference = 'Stop'`:
# PowerShell turns any stderr line into a terminating NativeCommandError, and
# keytool writes routine notices there ("the JKS keystore uses a proprietary
# format..."). Run those through here so a notice cannot abort the release.
function Invoke-Native([scriptblock] $block) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $block } finally { $ErrorActionPreference = $previous }
}

function Step($n, $text) { Write-Host "`n[$n] $text" -ForegroundColor Cyan }
function Ok($text)       { Write-Host "    OK  $text" -ForegroundColor Green }
function Warn($text)     { Write-Host "    !   $text" -ForegroundColor Yellow }
function Die($text)      { Write-Host "`nXATO: $text`n" -ForegroundColor Red; exit 1 }

if (-not (Test-Path $AppDir)) {
    Die "hanguk_app topilmadi. Skriptni repo ichidan ishga tushiring: .\scripts\build-aab.ps1"
}

# ---------------------------------------------------------------- keytool ---
Step 1 'keytool qidirilmoqda'

$KeytoolCandidates = @()
$onPath = Get-Command keytool -ErrorAction SilentlyContinue
if ($onPath) { $KeytoolCandidates += $onPath.Source }
if ($env:JAVA_HOME) { $KeytoolCandidates += (Join-Path $env:JAVA_HOME 'bin\keytool.exe') }
$KeytoolCandidates += @(
    "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe"
    "$env:ProgramFiles\Android\Android Studio\jre\bin\keytool.exe"
    "${env:ProgramFiles(x86)}\Android\Android Studio\jbr\bin\keytool.exe"
)

$Keytool = $KeytoolCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $Keytool) {
    Die @"
keytool topilmadi. U Java bilan keladi (Android Studio ichida ham bor).
Android Studio o'rnatilgan bo'lsa, odatda shu yerda:
  $env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe
Topib, JAVA_HOME ni o'rnating yoki PATH ga qo'shing.
"@
}
Ok $Keytool

# --------------------------------------------------------------- keystore ---
Step 2 'Keystore qidirilmoqda'

if (-not $Keystore) {
    Write-Host '    (kompyuterdan .jks fayl qidirilyapti, biroz kuting...)'
    $found = @(
        Get-ChildItem -Path $HOME -Filter *.jks -Recurse -Depth 5 -File -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty FullName
    )
    if ($found.Count -eq 0) {
        Die @"
Kompyuteringizda .jks fayl topilmadi.
Keystore qayerdaligini bilsangiz, yo'lini o'zingiz bering:
  .\scripts\build-aab.ps1 -Keystore C:\yo'l\hanguk-upload.jks
"@
    }
    if ($found.Count -eq 1) {
        $Keystore = $found[0]
    } else {
        Write-Host "`n    Bir nechta keystore topildi. Qaysi biri?" -ForegroundColor Yellow
        for ($i = 0; $i -lt $found.Count; $i++) { Write-Host "      [$i] $($found[$i])" }
        $pick = Read-Host '    Raqamini yozing'
        $Keystore = $found[[int]$pick]
    }
}
if (-not (Test-Path $Keystore)) { Die "Keystore topilmadi: $Keystore" }
$Keystore = (Resolve-Path $Keystore).Path
Ok $Keystore

# --------------------------------------------------------------- password ---
Step 3 'Keystore paroli'

$sec = Read-Host '    Keystore paroli' -AsSecureString
$StorePassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
if (-not $StorePassword) { Die 'Parol kiritilmadi.' }

$listing = Invoke-Native { & $Keytool -list -v -keystore $Keystore -storepass $StorePassword 2>&1 } | Out-String
if ($LASTEXITCODE -ne 0) {
    Die "Parol noto'g'ri yoki fayl keystore emas.`n`n$listing"
}
Ok "Parol to'g'ri"

# ------------------------------------------------------- fingerprint check ---
Step 4 'Keystore Play kutayotgani ekanligini tekshirish'

$m = [regex]::Match($listing, 'SHA1:\s*([0-9A-Fa-f:]{40,})')
if (-not $m.Success) {
    Warn 'SHA-1 o''qib bo''lmadi - tekshiruv o''tkazib yuborildi.'
} else {
    $actual = $m.Groups[1].Value.Trim().ToUpper()
    if ($actual -ne $ExpectedSha1.ToUpper()) {
        Die @"
Bu keystore Play'dagi ilovaniki EMAS.

  kutilgan: $ExpectedSha1
  topilgan: $actual

Bu fayl bilan qurilgan bundle'ni Play qabul qilmaydi. To'g'ri keystore'ni
toping va -Keystore bilan ko'rsating. Yo'qolgan bo'lsa, Play Console'dan
"Request upload key reset" qilish kerak.
"@
    }
    Ok "SHA-1 mos: $actual"
}

# ------------------------------------------------------------------ alias ---
Step 5 'Kalit alias aniqlanmoqda'

$aliases = @([regex]::Matches($listing, '(?m)^Alias name:\s*(.+)$') |
    ForEach-Object { $_.Groups[1].Value.Trim() })
if ($aliases.Count -eq 0) { Die "Keystore ichida kalit topilmadi.`n`n$listing" }
if ($aliases.Count -eq 1) {
    $KeyAlias = $aliases[0]
} else {
    Write-Host "`n    Bir nechta alias bor. Qaysi biri?" -ForegroundColor Yellow
    for ($i = 0; $i -lt $aliases.Count; $i++) { Write-Host "      [$i] $($aliases[$i])" }
    $pick = Read-Host '    Raqamini yozing'
    $KeyAlias = $aliases[[int]$pick]
}
Ok $KeyAlias

Write-Host ''
$sec2 = Read-Host "    Kalit paroli (keystore paroli bilan bir xil bo'lsa Enter bosing)" -AsSecureString
$KeyPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec2))
if (-not $KeyPassword) { $KeyPassword = $StorePassword }

# --------------------------------------------------------- key.properties ---
Step 6 'android/key.properties yozilmoqda'

$KeyProps = Join-Path $AppDir 'android\key.properties'
@(
    "storeFile=$($Keystore -replace '\\', '/')"
    "storePassword=$StorePassword"
    "keyAlias=$KeyAlias"
    "keyPassword=$KeyPassword"
) | Set-Content -Path $KeyProps -Encoding ASCII
Ok "$KeyProps  (gitignored - hech qachon commit bo'lmaydi)"

# ------------------------------------------------------------------ build ---
Step 7 'Bundle qurilmoqda (10-20 daqiqa)'

Push-Location $AppDir
try {
    & flutter pub get
    if ($LASTEXITCODE -ne 0) { Die 'flutter pub get muvaffaqiyatsiz.' }

    # STORE_BUILD=true is mandatory - see the .DESCRIPTION above.
    & flutter build appbundle --release --dart-define=STORE_BUILD=true
    if ($LASTEXITCODE -ne 0) { Die 'flutter build appbundle muvaffaqiyatsiz.' }
} finally {
    Pop-Location
}

$Aab = Join-Path $AppDir 'build\app\outputs\bundle\release\app-release.aab'
if (-not (Test-Path $Aab)) { Die "Bundle yaratilmadi: $Aab" }
Ok "$Aab  ($([math]::Round((Get-Item $Aab).Length / 1MB, 1)) MB)"

# ------------------------------------------------------- signature verify ---
Step 8 'Bundle imzosi tekshirilmoqda'

$certOut = Invoke-Native { & $Keytool -printcert -jarfile $Aab 2>&1 } | Out-String
$cm = [regex]::Match($certOut, 'SHA1:\s*([0-9A-Fa-f:]{40,})')
if (-not $cm.Success) {
    Warn 'Imzo o''qib bo''lmadi - Play yuklashda o''zi aytadi.'
} elseif ($cm.Groups[1].Value.Trim().ToUpper() -ne $ExpectedSha1.ToUpper()) {
    Die @"
Bundle NOTO'G'RI kalit bilan imzolangan - Play uni rad etadi.

  kutilgan: $ExpectedSha1
  topilgan: $($cm.Groups[1].Value.Trim().ToUpper())

Odatda bu key.properties o'qilmaganini bildiradi (Gradle bunda ovoz chiqarmay
debug kalitga o'tadi). build papkasini o'chirib qayta urinib ko'ring.
"@
} else {
    Ok 'Play kutayotgan kalit bilan imzolangan'
}

# ---------------------------------------------------------------- secrets ---
if ($PrintSecrets) {
    Step 9 'GitHub Actions uchun secret qiymatlari'
    Write-Host ''
    Write-Host '    GitHub -> repo -> Settings -> Secrets and variables -> Actions'
    Write-Host '    "New repository secret" bilan to''rttasini qo''shing:'
    Write-Host ''
    Write-Host "      ANDROID_KEYSTORE_PASSWORD  = $StorePassword"
    Write-Host "      ANDROID_KEY_ALIAS          = $KeyAlias"
    Write-Host "      ANDROID_KEY_PASSWORD       = $KeyPassword"
    Write-Host '      ANDROID_KEYSTORE_BASE64    = (clipboard''ga nusxalandi)'
    [Convert]::ToBase64String([IO.File]::ReadAllBytes($Keystore)) | Set-Clipboard
    Write-Host ''
    Write-Host '    Shundan keyin har bir reliz: Actions -> Android release bundle -> Run workflow.'
}

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host ' TAYYOR' -ForegroundColor Green
Write-Host '========================================================' -ForegroundColor Green
Write-Host ''
Write-Host " Fayl:  $Aab"
Write-Host ''
Write-Host ' Keyingi qadamlar (docs/RELEASE.md step 4):'
Write-Host '   1. Play Console -> Hanguk -> Testing -> Internal testing'
Write-Host '   2. Create new release -> shu .aab faylni tashlang'
Write-Host '   3. Eski version code''larni HAMMA trekda deactivate qiling'
Write-Host '   4. Sinab ko''ring -> Promote release -> Production'
Write-Host ''
