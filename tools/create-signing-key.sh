#!/usr/bin/env bash
# Run on the owner's trusted computer, not inside a public CI job.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
command -v keytool >/dev/null || { echo 'Install JDK 17+ first (keytool required).'; exit 1; }
command -v python3 >/dev/null || { echo 'Python 3 is required to encode the keystore locally.'; exit 1; }
mkdir -p signing-private
keyfile=signing-private/daftari-next.p12
if [[ -e "$keyfile" ]]; then
  echo 'Refusing to overwrite the existing signing key. Keep it for all future updates.' >&2
  exit 1
fi
# keytool prompts locally for the password. It is not placed in arguments or logs.
keytool -genkeypair -keystore "$keyfile" -alias daftari-next \
  -storetype PKCS12 -keyalg RSA -keysize 3072 -validity 10000 \
  -dname 'CN=Daftari Next'
python3 - <<'PY'
import base64
from pathlib import Path
source=Path('signing-private/daftari-next.p12')
Path('signing-private/keystore-base64.txt').write_text(base64.b64encode(source.read_bytes()).decode('ascii'))
PY
printf '%s\n' 'Created signing-private/daftari-next.p12 and keystore-base64.txt.' \
  'Back up the keystore and password privately. Do NOT attach them to a public issue/release.' \
  'Configure the four Actions secrets described in docs/DAFTARI_NEXT_RELEASE.md.'
