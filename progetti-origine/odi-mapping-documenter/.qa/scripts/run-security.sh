#!/usr/bin/env bash
# Security audit — pip-audit (deps) + bandit (code)
set -e
cd "$(cd "$(dirname "$0")/../.." && pwd)"
DATE=$(date +%Y-%m-%d_%H-%M)
OUT=".qa/security/reports/${DATE}_security.md"
{
  echo "# Security Audit — $DATE"
  echo ""
  echo "## pip-audit (dipendenze vulnerabili)"
  echo ""
  pip-audit --progress-spinner=off || true
  echo ""
  echo "## bandit (vulnerabilità nel codice)"
  echo ""
  bandit -r src/ -c .qa/lint/configs/ruff.toml -f txt || true
} 2>&1 | tee "$OUT"
