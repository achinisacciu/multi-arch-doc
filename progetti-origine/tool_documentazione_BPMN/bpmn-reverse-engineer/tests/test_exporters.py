import pathlib, json, tempfile
from bpmn_reverse_engineer.parser import parse_bpmn
from bpmn_reverse_engineer.graph import build_graph
from bpmn_reverse_engineer.analyzers import compute_metrics, compute_warnings, compute_paths
from bpmn_reverse_engineer.exporters import export_json, export_markdown, export_graph_json, export_graphml

FIX = pathlib.Path(__file__).parent / "fixtures"

def _full_doc():
    doc = parse_bpmn(FIX / "02_exclusive_gateway.bpmn")
    g = build_graph(doc)
    doc.metrics = compute_metrics(doc)
    doc.structural_warnings = compute_warnings(doc, g)
    doc.paths = compute_paths(g)
    return doc, g

def test_json_export(tmp_path):
    doc, g = _full_doc()
    out = tmp_path / "out.json"
    export_json(doc, out)
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["tool_version"] == "0.1.0"
    assert "processes" in data
    assert "sequence_flows" in data
    assert "metrics" in data
    assert data["metrics"]["num_sequence_flows"] == 6

def test_markdown_export(tmp_path):
    doc, g = _full_doc()
    out = tmp_path / "out.md"
    export_markdown(doc, out)
    txt = out.read_text(encoding="utf-8")
    assert "# BPMN Reverse Engineering Report" in txt
    assert "## 1. Source" in txt
    assert "## 5. Activities" in txt
    assert "| ID | Name | Type | Lane |" in txt

def test_graph_json_export(tmp_path):
    doc, g = _full_doc()
    out = tmp_path / "graph.json"
    export_graph_json(g, out)
    data = json.loads(out.read_text(encoding="utf-8"))
    assert "nodes" in data
    assert "edges" in data
    assert any(n["id"] == "Gateway_1" for n in data["nodes"])

def test_graphml_export(tmp_path):
    doc, g = _full_doc()
    out = tmp_path / "graph.graphml"
    export_graphml(g, out)
    assert out.exists()
    txt = out.read_text(encoding="utf-8")
    assert "graphml" in txt.lower()

def test_cli_e2e(tmp_path):
    from click.testing import CliRunner
    from bpmn_reverse_engineer.cli import cli
    runner = CliRunner()
    outdir = tmp_path / "analysis"
    result = runner.invoke(cli, ["analyze", str(FIX / "01_linear.bpmn"), "--output", str(outdir), "--verbose"])
    assert result.exit_code == 0, result.output
    # nuovo layout Tool 1.5: sempre due cartelle anche per singolo file (default = entrambe)
    assert (outdir / "analisi" / "bpmn_analysis.json").exists()
    assert (outdir / "analisi" / "bpmn_analysis.md").exists()
    assert (outdir / "analisi" / "bpmn_graph.json").exists()
    assert (outdir / "analisi" / "bpmn_graph.graphml").exists()
    assert (outdir / "analisi anonimi" / "bpmn_analysis.json").exists()
    assert "Processes:" in result.output


def test_anonymized_json_wraps_values(tmp_path):
    doc, g = _full_doc()
    out = tmp_path / "out_an.json"
    export_json(doc, out, anonymize=True)
    data = json.loads(out.read_text(encoding="utf-8"))
    # extracted id must be wrapped
    assert data["processes"][0]["id"] == "`Process_Exclusive`"
    # type stays unwrapped (structural)
    assert data["elements"][0]["type"] == "startEvent"
    # but name wrapped
    svc = next(e for e in data["elements"] if e["id"] == "`Task_Service`")
    assert svc["name"] == "`Service Task`"
    # condition wrapped
    sf = next(f for f in data["sequence_flows"] if f["id"] == "`F3`")
    assert sf["condition"].startswith("`") and sf["condition"].endswith("`")
    # metrics not wrapped
    assert data["metrics"]["num_sequence_flows"] == 6


def test_anonymized_markdown_wraps(tmp_path):
    doc, g = _full_doc()
    out = tmp_path / "out_an.md"
    export_markdown(doc, out, anonymize=True)
    txt = out.read_text(encoding="utf-8")
    # process name should be wrapped
    assert "`Process_Exclusive`" in txt
    # service task name wrapped
    assert "`Service Task`" in txt
    # type not wrapped (structural) still present as plain
    assert "exclusiveGateway" in txt


def test_anonymized_graph_wraps(tmp_path):
    doc, g = _full_doc()
    out = tmp_path / "g_an.json"
    export_graph_json(g, out, anonymize=True)
    data = json.loads(out.read_text(encoding="utf-8"))
    # node id wrapped, type not wrapped
    gw = next(n for n in data["nodes"] if n["id"] == "`Gateway_1`")
    assert gw["type"] == "exclusiveGateway"
    assert gw["name"] == "`Decision`"


def test_cli_anonymize_and_both(tmp_path):
    from click.testing import CliRunner
    from bpmn_reverse_engineer.cli import cli

    runner = CliRunner()
    outdir = tmp_path / "a"

    # --anonymize only -> solo cartella anonimi (Tool 1.5: singolo file rispetta flag)
    result = runner.invoke(cli, ["analyze", str(FIX / "01_linear.bpmn"), "--output", str(outdir), "--anonymize"])
    assert result.exit_code == 0
    assert (outdir / "analisi anonimi" / "bpmn_analysis.json").exists()
    assert not (outdir / "analisi" / "bpmn_analysis.json").exists()

    outdir2 = tmp_path / "b"
    result = runner.invoke(cli, ["analyze", str(FIX / "01_linear.bpmn"), "--output", str(outdir2), "--both"])
    assert result.exit_code == 0
    assert (outdir2 / "analisi" / "bpmn_analysis.json").exists()
    assert (outdir2 / "analisi anonimi" / "bpmn_analysis.json").exists()
    assert (outdir2 / "analisi" / "bpmn_graph.json").exists()
    assert (outdir2 / "analisi anonimi" / "bpmn_graph.json").exists()
