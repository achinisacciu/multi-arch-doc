"""
Export HTML — interactive report (future)
"""
from pathlib import Path
from typing import Dict, Any
import json

def export_html_report(canonical: Dict[str, Any], graph: Dict[str, Any], output: Path):
    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>SOA Report</title>
<style>body{{font-family:system-ui;padding:24px;max-width:900px;margin:auto}} pre{{background:#f5f5f5;padding:12px;overflow:auto}}</style>
</head><body>
<h1>SOA Reverse Engineering Report</h1>
<p>Generated {__import__('datetime').datetime.utcnow().isoformat()}Z</p>
<h2>Registry</h2><pre>{json.dumps(canonical.get('registry',{}), indent=2, ensure_ascii=False)[:3000]}</pre>
<h2>Graph</h2><pre>{json.dumps(graph.get('stats',{}), indent=2, ensure_ascii=False)}</pre>
</body></html>"""
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding="utf-8")
    return output
