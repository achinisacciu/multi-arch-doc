#!/usr/bin/env bash
# Unit tests + coverage
set -e
cd "$(cd "$(dirname "$0")/../.." && pwd)"
DATE=$(date +%Y-%m-%d_%H-%M)
pytest .qa/unit/tests/ \
  --cov=src \
  --cov-report=term-missing \
  --cov-report=json:.qa/coverage/reports/coverage.json \
  -v 2>&1 | tee ".qa/unit/reports/${DATE}_unit.md"
