#!/usr/bin/env bash
# Integration tests
set -e
cd "$(cd "$(dirname "$0")/../.." && pwd)"
DATE=$(date +%Y-%m-%d_%H-%M)
pytest .qa/integration/tests/ -v 2>&1 | tee ".qa/integration/reports/${DATE}_integration.md"
