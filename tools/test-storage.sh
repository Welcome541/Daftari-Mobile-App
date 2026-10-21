#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
classes=$(mktemp -d)
trap 'rm -rf "$classes"' EXIT
base=app/src/main/java/ai/arena/dafter/offline
sources=("$base/util/SecurityUtils.java")
for file in "$base"/storage/*.java; do
  [[ "$file" == */FileStorageManager.java ]] || sources+=("$file")
done
sources+=("$base/bridge/RequestRegistry.java" "$base/ui/OperationGate.java" tests/java/*.java)
# Standard path: JDK 17+. Optional ECJ + Java runtime supports constrained CI.
if command -v javac >/dev/null; then
  javac -encoding UTF-8 -d "$classes" "${sources[@]}"
elif [[ -n "${ECJ_JAR:-}" ]]; then
  "${JAVA:-java}" -cp "$ECJ_JAR" org.eclipse.jdt.internal.compiler.batch.Main \
    -proc:none -source 11 -target 11 -encoding UTF-8 -d "$classes" "${sources[@]}"
else
  echo 'JDK 17+ required, or set JAVA and ECJ_JAR for an existing Eclipse compiler.' >&2
  exit 1
fi
"${JAVA:-java}" -cp "$classes" StorageSafetyTest
"${JAVA:-java}" -cp "$classes" ImportLifecycleTest

"${JAVA:-java}" -cp "$classes" BridgeLifecycleTest
