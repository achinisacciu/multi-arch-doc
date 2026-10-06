#!/usr/bin/env python3
"""
ODI 12c Flow Builder Module
Generates a visual flow diagram (Mermaid.js) from parsed mapping data.
"""

from pathlib import Path


def generate_flow_diagram(data, output_path):
    """Generate a Mermaid.js flow diagram in Markdown."""
    m = data['mapping']
    flow = data.get('mapping_flow', {'nodes': {}, 'edges': []})

    lines = []
    lines.append(f"# Flusso del Mapping: {m.get('name', 'N/A')}")
    lines.append("")
    lines.append("> Diagramma di flusso dei componenti generato automaticamente. ")
    lines.append("> Se stai usando un visualizzatore Markdown compatibile (es. GitHub, VS Code, Obsidian), ")
    lines.append("> vedrai il diagramma qui sotto.")
    lines.append("")
    lines.append("```mermaid")
    lines.append("graph LR")

    # Mermaid node styling definitions
    lines.append("    classDef source fill:#d4edda,stroke:#28a745,stroke-width:2px;")
    lines.append("    classDef target fill:#f8d7da,stroke:#dc3545,stroke-width:2px;")
    lines.append("    classDef lookup fill:#cce5ff,stroke:#007bff,stroke-width:2px;")
    lines.append("    classDef filter fill:#fff3cd,stroke:#ffc107,stroke-width:2px;")
    lines.append("    classDef join fill:#ffe6ff,stroke:#cc00cc,stroke-width:2px;")
    lines.append("    classDef aggregate fill:#e2e3e5,stroke:#6c757d,stroke-width:2px;")
    lines.append("    classDef expression fill:#d1ecf1,stroke:#17a2b8,stroke-width:2px;")
    lines.append("")

    nodes = flow.get('nodes', {})
    edges = flow.get('edges', [])

    # Create safe node IDs for Mermaid (remove special chars)
    safe_ids = {}
    for i, comp_id in enumerate(nodes.keys()):
        safe_ids[comp_id] = f"N{i}"

    # Add nodes to graph with correct shapes based on type
    for comp_id, node in nodes.items():
        safe_id = safe_ids[comp_id]
        name = node['name'].replace('"', "'") # Escape quotes
        node_type = node['type']
        role = node['role']

        shape_start = "["
        shape_end = "]"
        class_name = ""

        if node_type == 'DATASTORE':
            if role == 'SOURCE':
                shape_start, shape_end = "[(", ")]"
                class_name = "source"
            elif role == 'TARGET':
                shape_start, shape_end = "[(", ")]"
                class_name = "target"
            elif role == 'LOOKUP':
                shape_start, shape_end = "[[", "]]"
                class_name = "lookup"
            else:
                class_name = "datastore"
        elif node_type == 'FILTER':
            shape_start, shape_end = "{", "}"
            class_name = "filter"
        elif node_type == 'JOIN':
            shape_start, shape_end = "((", "))"
            class_name = "join"
        elif node_type == 'AGGREGATE':
            shape_start, shape_end = "[", "]"
            class_name = "aggregate"
        elif node_type == 'EXPRESSION':
            shape_start, shape_end = "(", ")"
            class_name = "expression"

        lines.append(f"    {safe_id}{shape_start}\"{name}\"{shape_end}:::{class_name}")

    lines.append("")

    # Add edges
    for source_id, target_id in edges:
        safe_source = safe_ids.get(source_id)
        safe_target = safe_ids.get(target_id)
        if safe_source and safe_target:
            lines.append(f"    {safe_source} --> {safe_target}")

    lines.append("```")
    lines.append("")

    # Add Legend
    lines.append("## Legenda")
    lines.append("- `[()]` Verde: Sorgente (Source)")
    lines.append("- `[()]` Rosso: Target")
    lines.append("- `[[ ]]` Blu: Lookup")
    lines.append("- `{ }` Giallo: Filtro")
    lines.append("- `(( ))` Viola: Join")
    lines.append("- `[ ]` Grigio: Aggregazione")
    lines.append("- `( )` Azzurro: Espressione")

    content = "\n".join(lines)
    Path(output_path).write_text(content, encoding='utf-8')
    return content
