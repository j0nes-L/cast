# Cast (headset app)

Android app for Meta Quest 3 / 3S. It casts what the wearer sees, with microphone and app sound, to the website of a Cast instance; the setup script decides which. Other apps need no integration.

The panel has the website's look: the headset's name with a status circle (red off, yellow starting, green live) and one button: ▶ start casting, ■ stop casting. It lifts when pointed at and sinks in when pressed.

## How it works

- **▶ starts casting**, nothing else does: opening Cast only shows the panel. For the shortest way, pin Cast in the Navigator: App library, point at Cast, Options, pin (up to 10 pinned apps). Horizon OS has no quick settings for apps.
- The screen is captured only while casting, so the headset shows "Sharing entire view" only then. ■, "End cast" on the website or the end of the system's capture stop it.
- Casting goes on while other apps are in front; the panel can be closed.

## Setup (once per headset)

The headset needs developer mode and a USB connection. Install Cast (store, or `adb install` for development), then set it up in one of two ways.

**On the website** (Chrome or Edge, any computer): sign in, open `/headsets`, connect the headset and press the USB button. The first time per headset, "Allow USB access" lets the browser see it, and the headset asks to allow USB debugging (put it on). The browser cannot use the headset while an adb server runs on the same computer: close Android Studio or Unity, or run `adb kill-server`. The website does the same as the script below.

**With the script** (Windows PC with adb):

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
