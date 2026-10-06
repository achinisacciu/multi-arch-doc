#!/usr/bin/env bash
# Lint — Python (ruff)
set -e
cd "$(cd "$(dirname "$0")/../.." && pwd)"
DATE=$(date +%Y-%m-%d_%H-%M)
ruff check . --config .qa/lint/configs/ruff.toml --output-format=github \
  2>&1 | tee ".qa/lint/reports/${DATE}_lint_python.md"
