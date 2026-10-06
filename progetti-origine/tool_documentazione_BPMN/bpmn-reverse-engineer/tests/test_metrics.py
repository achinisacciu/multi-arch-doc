import pathlib
from bpmn_reverse_engineer.parser import parse_bpmn
from bpmn_reverse_engineer.graph import build_graph
from bpmn_reverse_engineer.analyzers import compute_metrics, compute_warnings

FIX = pathlib.Path(__file__).parent / "fixtures"

def test_metrics_linear():
    doc = parse_bpmn(FIX / "01_linear.bpmn")
    g = build_graph(doc)
    doc.metrics = compute_metrics(doc)
    assert doc.metrics.num_processes == 1
    assert doc.metrics.num_sequence_flows == 2
    assert doc.metrics.num_events == 2
    assert doc.metrics.num_start_events == 1
    assert doc.metrics.num_end_events == 1

def test_metrics_gateway():
    doc = parse_bpmn(FIX / "02_exclusive_gateway.bpmn")
    g = build_graph(doc)
    m = compute_metrics(doc)
    assert m.num_gateways == 1
    assert m.num_exclusive_gateways == 1
    assert m.num_service_tasks == 1

def test_warnings_broken_flow(tmp_path):
    xml = """<?xml version="1.0"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D">
      <process id="P1">
        <startEvent id="S1"><outgoing>F1</outgoing></startEvent>
        <endEvent id="E1"><incoming>F1</incoming></endEvent>
        <sequenceFlow id="F1" sourceRef="S1" targetRef="E1"/>
        <sequenceFlow id="F_BROKEN" sourceRef="S1" targetRef="MISSING"/>
      </process>
    </definitions>"""
    p = tmp_path / "broken.bpmn"
    p.write_text(xml, encoding="utf-8")
    doc = parse_bpmn(p)
    g = build_graph(doc)
    warnings = compute_warnings(doc, g)
    assert any(w.code == "broken_flow_target" for w in warnings)

def test_warnings_unreachable():
    # Create process with isolated node
    import pathlib
    doc = parse_bpmn(FIX / "01_linear.bpmn")
    # Add isolated element manually
    from bpmn_reverse_engineer.models.elements import BpmnElement
    doc.elements.append(BpmnElement(id="Isolated", name="Isolated", type="task", incoming=[], outgoing=[]))
    g = build_graph(doc)
    warnings = compute_warnings(doc, g)
    assert any(w.code == "unreachable_node" and w.element_id == "Isolated" for w in warnings)

def test_metrics_unknown():
    doc = parse_bpmn(FIX / "12_unknown_elements.bpmn")
    m = compute_metrics(doc)
    assert m.num_unknown_elements >= 1

def test_warnings_gateway_without_conditions():
    # exclusive gateway without conditions should warn
    xml = """<?xml version="1.0"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D">
      <process id="P1">
        <startEvent id="S1"><outgoing>F1</outgoing></startEvent>
        <exclusiveGateway id="GW"><incoming>F1</incoming><outgoing>F2</outgoing><outgoing>F3</outgoing></exclusiveGateway>
        <task id="A"><incoming>F2</incoming><outgoing>F4</outgoing></task>
        <task id="B"><incoming>F3</incoming><outgoing>F5</outgoing></task>
        <endEvent id="E1"><incoming>F4</incoming><incoming>F5</incoming></endEvent>
        <sequenceFlow id="F1" sourceRef="S1" targetRef="GW"/>
        <sequenceFlow id="F2" sourceRef="GW" targetRef="A"/>
        <sequenceFlow id="F3" sourceRef="GW" targetRef="B"/>
        <sequenceFlow id="F4" sourceRef="A" targetRef="E1"/>
        <sequenceFlow id="F5" sourceRef="B" targetRef="E1"/>
      </process>
    </definitions>"""
    import tempfile, pathlib
    tmp = pathlib.Path(tempfile.gettempdir()) / "gw_warn.bpmn"
    tmp.write_text(xml, encoding="utf-8")
    doc = parse_bpmn(tmp)
    g = build_graph(doc)
    warns = compute_warnings(doc, g)
    assert any(w.code == "gateway_without_conditions" for w in warns)
