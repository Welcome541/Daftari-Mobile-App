# Daftari Next 2.23 — standalone signed release

## Approved identity

The owner does not possess the original app's signing key and explicitly selected a **separate application**:

- Display name: **دفتري الجديد — Daftari Next**.
- Application ID: `ai.arena.dafter.next` (old app: `ai.arena.dafter.enhanced`).
- Version: `2.23-daftari-next`, versionCode `223`.
- The Android namespace and Activity class names remain unchanged; these are not the installation identity.
- The old application and its private data remain installed separately. Export a normal JSON backup from the old app, import it in Next, and check balances before removing anything. Models and device settings are not transferred by a ledger backup. Do not uninstall the old app as a workaround for signatures.

## Create an owner-controlled production key

A new production key must be kept for all future Next updates. It cannot be recovered from the APK. Never generate the only copy on an ephemeral CI runner or publish it as a GitHub artifact.

On your trusted computer with **JDK 17+**, Python 3 and bash:

```sh
./tools/create-signing-key.sh
```

`keytool` asks for a password locally. The helper creates an encrypted PKCS12 keystore and a base64 encoding in `signing-private/`, which is excluded from Git. Keep an offline backup and store its password securely. The helper refuses to overwrite an existing keystore.

Open repository **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Entire content of your local `signing-private/keystore-base64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | Password entered into keytool |
| `ANDROID_KEY_ALIAS` | `daftari-next` |
| `ANDROID_KEY_PASSWORD` | Same password for the PKCS12 key |

Do not send these values in chat, issues, source files, or release notes. Do not attach the keystore to a public release. An authorized repository owner must configure these secrets; the session's GitHub integration could not list/manage Actions secrets.

## Build and publication gates

Workflow: `.github/workflows/android-release.yml`, on the Arena branch, Ubuntu 24.04, JDK 17, SDK/build-tools 35.

1. Node tests and JVM safety/lifecycle tests.
2. `assembleRelease lintRelease` using Gradle 8.9/AGP 8.7.3.
3. Upload unsigned verification artifact with lint reports. **Not an installable release.**
4. Require all four signing secrets, sign the APK, verify signature, reject Android Debug certificates, verify standalone package ID, generate SHA-256 checksums.
5. Upload `Daftari-Next-2.23-signed` candidate; the keystore is deleted from the runner and never uploaded.
6. Only after successful verification publish the signed APK/checksum/report as the final GitHub Release. The workflow itself does not silently publish unsigned or debug builds.

GitHub Run [39528672611](https://github.com/Welcome541/Daftari-Mobile-App/actions/runs/39528672611), for commit `6982f26`, successfully ran the JavaScript/JVM checks and built/linted the **standalone** APK. The unsigned artifact was uploaded. The run then stopped at the explicit signing gate because production signing secrets were absent. No signed APK or final release has been published. Earlier run 39527826805 verified the pre-identity-change candidate.

## Important fixes and remaining validation

PRF enrollment now persists its per-credential input and sends the same input via `evalByCredential`, requires user verification, and rejects unknown credentials and stale responses. Older fingerprint entries lacking PRF inputs need deletion/re-enrollment after PIN unlock. Local tests: **104/104**, including four new PRF protocol regressions. Actual platform authenticator/WebView support must still be tested on devices; PIN remains the fallback.

A successful APK build/lint does not prove Android 5/14 runtime behavior, real speech models, microphone permissions, process death, biometric hardware support, or OCR language-data availability. Release notes must retain these limitations; the selected name does not imply zero bugs or a security certification.
