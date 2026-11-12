# One-time setup of a headset for Cast, on a PC with the headset connected over USB (developer mode).
# It registers the headset with the cast website (setting it up again renews its credentials), copies the credentials
# to the headset and allows the app to capture without the share dialog. Opening the app then starts casting.
#
#   .\setup.ps1 -Server https://cast.example.org                 # the website of the Cast instance; asks for the name
#   .\setup.ps1 -Server https://cast.example.org -Name Empfang   # shown as "Quest 3 - Empfang"
#   .\setup.ps1 -Server http://localhost:4321                    # local dev stack
#
# Cast has to be installed already (from the store, or with adb install for development).
param([Parameter(Mandatory = $true)][string]$Server, [string]$Name)
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 # Windows PowerShell 5.1 defaults to older TLS
$package = "dev.jonasludorf.cast"
$Server = $Server.TrimEnd("/")

$adbPath = (Get-Command adb -ErrorAction SilentlyContinue).Source
if (-not $adbPath) {
    $adbPath = Get-ChildItem "C:\Program Files\Unity\Hub\Editor\*\Editor\Data\PlaybackEngines\AndroidPlayer\SDK\platform-tools\adb.exe" -ErrorAction SilentlyContinue |
        Select-Object -Last 1 -ExpandProperty FullName
}
if (-not $adbPath) { throw "adb not found. Install the Android platform-tools." }
function Adb { $out = & $adbPath @args; if ($LASTEXITCODE -ne 0) { throw "adb $args failed" }; $out }

$devices = @(& $adbPath devices | Select-String "\tdevice$")
if ($devices.Count -ne 1) { throw "Connect exactly one headset over USB (found $($devices.Count))." }
$serial = (Adb get-serialno).Trim()
$model = (Adb shell getprop ro.product.model).Trim()
if (-not (& $adbPath shell pm path $package)) { throw "Install Cast on the headset first." }
if (-not $Name) { $Name = Read-Host "Name of this headset (shown as '$model - <name>')" }
if (-not $Name.Trim()) { throw "The headset needs a name." }

# Register with the website (the password can also come from $env:CAST_PASSWORD, e.g. for setting up many headsets)
$password = $env:CAST_PASSWORD
if (-not $password) {
    $secure = Read-Host "Password of $Server" -AsSecureString
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
try {
    $session = Invoke-RestMethod -Method Post -Uri "$Server/api/token/viewer" -ContentType "application/json" -Body (@{ password = $password } | ConvertTo-Json)
    # As UTF-8 bytes: Windows PowerShell 5.1 would send a string body as Latin-1 and break umlauts in the name
    $body = [Text.Encoding]::UTF8.GetBytes((@{ serial = $serial; model = $model; name = $Name } | ConvertTo-Json))
    $device = Invoke-RestMethod -Method Post -Uri "$Server/api/devices" -ContentType "application/json; charset=utf-8" `
        -Headers @{ Authorization = "Bearer $($session.token)" } -Body $body
} catch {
    throw "Registering with $Server failed: $($_.Exception.Message)"
}

# Credentials for the app; it moves them into its private storage and deletes the file
$file = Join-Path $env:TEMP "cast.json"
$config = [ordered]@{ server = $Server; deviceId = $device.deviceId; deviceSecret = $device.deviceSecret; name = $device.name }
[IO.File]::WriteAllText($file, ($config | ConvertTo-Json)) # UTF-8 without BOM
try {
    Adb shell mkdir -p /sdcard/Android/data/$package/files | Out-Null
    Adb push $file /sdcard/Android/data/$package/files/cast.json | Out-Null
} finally {
    Remove-Item $file
}

Adb shell pm grant $package android.permission.RECORD_AUDIO
Adb shell pm grant $package android.permission.POST_NOTIFICATIONS
Adb shell appops set $package PROJECT_MEDIA allow # screen capture without the share dialog

$uri = [Uri]$Server
if ($uri.Host -eq "localhost") {
    Adb reverse "tcp:$($uri.Port)" "tcp:$($uri.Port)" | Out-Null # website on the PC
    Adb reverse tcp:7880 tcp:7880 | Out-Null                       # local LiveKit signalling
}

Adb shell am force-stop $package # a running cast ends; the next start uses the new credentials
Write-Host "Set up as '$($device.name)'. Opening Cast on the headset starts casting."
