# QA Framework — odi-mapping-documenter

## Stato attuale

*Ultimo aggiornamento: 2026-07-17 14:37*

| Categoria | Stato | Ultimo report |
|-----------|-------|---------------|
| Lint | ✅ PASS | [2026-07-17_14-37](lint/reports/2026-07-17_14-37_lint_python.md) |
| Unit Test | ✅ PASS (22/22) | [2026-07-17_14-35](unit/reports/2026-07-17_14-35_unit.md) |
| Coverage | ⚠️ 45% (soglia 70%) | [2026-07-17_14-35](coverage/reports/coverage.json) |
| Integration | ✅ PASS (3/3) | [2026-07-17_14-35](integration/reports/2026-07-17_14-35_integration.md) |
| Security | ⚠️ WARN | [2026-07-17_14-35](security/reports/2026-07-17_14-35_security.md) |
| E2E | ⏭️ non configurato | — |
| Performance | ⏭️ non eseguito | — |
| A11y | ⏭️ disabilitato (config) | — |

### Note di copertura
- `src/parser.py` 91%, `src/flow_builder.py` 99%, `src/csv_builder.py` 94%, `src/doc_builder.py` 81%
- `src/parse_odi_xml.py` 0% (modulo legacy duplicato, non usato da `main.py`)
- `src/main.py` 44% (rami CLI/batch non coperti)

### Note di sicurezza
- 0 vulnerabilità CRITICAL/HIGH nel codice del progetto.
- 28 vulnerabilità in dipendenze transitie/ambientali (non nei 4 requisiti dichiarati).
- 1 Medium + 1 Low in `src/parse_odi_xml.py` (XML parsing non sicuro, modulo legacy).

## Come eseguire

```bash
# Tutto insieme (lint, unit+coverage, integration, security)
bash .qa/scripts/run-all.sh

# Singola categoria
bash .qa/scripts/run-lint.sh
bash .qa/scripts/run-unit.sh
bash .qa/scripts/run-integration.sh
bash .qa/scripts/run-security.sh
```

Per i test (Windows PowerShell):
```powershell
pytest .qa/unit/tests/ .qa/integration/tests/ --cov=src --cov-report=term-missing
ruff check . --config .qa/lint/configs/ruff.toml
```

## Configurazione

Vedi `../qa.config.json` nella root del progetto.

## Struttura

```
.qa/
├── unit/         ← test unitari + report
├── integration/  ← test di integrazione + report
├── e2e/          ← test end-to-end (non ancora configurati)
├── lint/         ← configurazioni e report lint
├── security/     ← report audit sicurezza
├── performance/  ← script e report profiling (non ancora eseguito)
├── a11y/         ← script e report accessibilità (disabilitato)
├── coverage/     ← report copertura codice
└── scripts/      ← script orchestratori
```
