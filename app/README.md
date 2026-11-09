# Cast (headset app)

Android app for Meta Quest 3 / 3S. It casts what the wearer sees, with microphone and app sound, to the website of a Cast instance; the setup script decides which. Other apps need no integration.

The panel has the website's look: the headset's name with a status circle (red off, yellow standby, green live) and icon buttons: ▶ start casting, ■ stop casting, power: quit, cast icon: start standby.

## How it works

- **Standby:** opening the app starts a local screen capture (nothing is sent) and looks for QR codes in it, also while another app is in front. After a reboot the app returns to standby by itself.
- **Casting:** holding the start code from the website's `/codes` in front of the headset, or pressing ▶, publishes the capture to the website. The stop code, ■ or "End cast" on the website go back to standby.
- **Quit** (power) stops everything, also after reboots, until the app is opened again.

## Setup (once per headset)

The headset needs developer mode and a USB connection to a Windows PC with adb. Install Cast (store, or `adb install` for development), then:

```powershell
.\setup.ps1 -Server https://cast.example.org                 # asks for the name
.\setup.ps1 -Server https://cast.example.org -Name Empfang   # shown as "Quest 3 - Empfang"
.\setup.ps1 -Server http://localhost:4321                    # local dev stack
```

The script asks for the headset's name and the website password (or reads `$env:CAST_PASSWORD`) and:

- registers the headset with the website as "<model> - <name>", e.g. "Quest 3 - Empfang". The serial number identifies it, so running the script again renames it and replaces the credentials.
- copies the credentials to the headset; the app moves them into its private storage
- grants microphone and notification permission
- allows screen capture without the share dialog (`PROJECT_MEDIA`)

Release builds accept any `https://` instance, debug builds also `http://`. Setting a headset up for another instance replaces its credentials. Without the setup, the app shows a notice instead of the casting buttons.

## Build

The font Space Grotesk (`res/font`) is under the SIL Open Font License, see `assets/licenses`.

Needs JDK 17 and an Android SDK with platform 36 and build-tools 36.0.0. Unity's Android module ships both:

```sh
# local.properties (not committed)
sdk.dir=C:/Program Files/Unity/Hub/Editor/6000.3.10f1/Editor/Data/PlaybackEngines/AndroidPlayer/SDK
```

```sh
JAVA_HOME="C:/Program Files/Unity/Hub/Editor/6000.3.10f1/Editor/Data/PlaybackEngines/AndroidPlayer/OpenJDK" ./gradlew assembleDebug
adb install -r build/outputs/apk/debug/cast-debug.apk
```

### Release build (Meta Horizon Store)

```sh
JAVA_HOME=".../OpenJDK" ./gradlew assembleRelease   # build/outputs/apk/release/cast-release.apk
```

It is signed with the release key from `keystore.properties` (not committed):

```properties
storeFile=C:/Users/jludo/.android/cast-release.jks
storePassword=...
keyAlias=cast
keyPassword=...
```

Every store update must be signed with this same key, so keep the `.jks` file and its password backed up (e.g. in a password manager). Without `keystore.properties` the release APK stays unsigned. Raise `versionCode` in `build.gradle.kts` before each upload. A store build replaces a debug build only after `adb uninstall dev.jonasludorf.cast`, because the signatures differ.

## Local testing over USB

Start the local stack (`server/livekit-dev.ps1`, `npm run dev` in `web/`) and run `.\setup.ps1 -Server http://localhost:4321`. It forwards the website and LiveKit signalling to the headset with `adb reverse`; media goes directly over the network, so the headset must be in the same network as the PC. The forwarding is lost when the headset reconnects; run the script again or `adb reverse tcp:4321 tcp:4321` and `adb reverse tcp:7880 tcp:7880`.
