#!/usr/bin/env bash
# QA Framework orchestrator — ODI Mapping Documenter
set -e
DATE=$(date +%Y-%m-%d_%H-%M)
PROJ_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJ_ROOT"

echo "# QA Run — $DATE" > .qa/last-run-summary.md

run_step() {
  local name="$1"; local cmd="$2"
  echo "## $name"
  echo "### $name" >> .qa/last-run-summary.md
  if bash -c "$cmd"; then
    echo "✅ $name" >> .qa/last-run-summary.md
  else
    echo "❌ $name (exit $?)" >> .qa/last-run-summary.md
    echo "[$name] FAILED — see report"
  fi
}

run_step "1. Lint"            "bash .qa/scripts/run-lint.sh"
run_step "2. Unit + Coverage" "bash .qa/scripts/run-unit.sh"
run_step "3. Integration"     "bash .qa/scripts/run-integration.sh"
run_step "4. Security"        "bash .qa/scripts/run-security.sh"

echo ""
echo "QA completato. Riepilogo in .qa/last-run-summary.md"
