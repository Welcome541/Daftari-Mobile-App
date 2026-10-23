#!/usr/bin/env bash
# Type-check only. This does not produce an APK, run lint, dex, or test an Android device.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ANDROID_JAR:?Set ANDROID_JAR to the API 35 android.jar file}"
classes=$(mktemp -d)
trap 'rm -rf "$classes"' EXIT
mapfile -t sources < <(find app/src/main/java -name '*.java' | sort)
if command -v javac >/dev/null; then
  javac -encoding UTF-8 -proc:none -classpath "$ANDROID_JAR" -d "$classes" "${sources[@]}"
elif [[ -n "${ECJ_JAR:-}" ]]; then
  "${JAVA:-java}" -cp "$ECJ_JAR" org.eclipse.jdt.internal.compiler.batch.Main \
    -encoding UTF-8 -proc:none -source 11 -target 11 -classpath "$ANDROID_JAR" -d "$classes" "${sources[@]}"
else
  echo 'JDK required, or set JAVA and ECJ_JAR for an existing Eclipse compiler.' >&2
  exit 1
fi
