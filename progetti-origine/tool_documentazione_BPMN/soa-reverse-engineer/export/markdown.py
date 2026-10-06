"""
Export Markdown — technical + functional docs merged
"""
from pathlib import Path
from typing import Dict, Any

def export_markdown_report(canonical: Dict[str, Any], graph: Dict[str, Any], output: Path, title: str = "SOA Reverse Engineering Report"):
    from documentation.technical import generate_technical_doc
    from documentation.functional import generate_functional_doc
    from analysis.coverage import build_coverage_report, coverage_text

    tech = generate_technical_doc(canonical, graph)
    func = generate_functional_doc(canonical, graph)
    coverage = build_coverage_report(canonical, graph)

    md = f"# {title}\n\n"
    md += f"Generated: {__import__('datetime').datetime.utcnow().isoformat()}Z\n\n"
    md += "## Coverage\n\n" + coverage_text(coverage) + "\n\n"
    md += tech + "\n\n"
    md += func + "\n\n"
    md += f"## Graph Stats\n\nNodes: {graph.get('stats',{}).get('nodes',0)}, Edges: {len(graph.get('edges',[]))}\n"

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(md, encoding="utf-8")
    return output
