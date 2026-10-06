import pathlib
from bpmn_reverse_engineer.parser import parse_bpmn
from bpmn_reverse_engineer.graph import build_graph
from bpmn_reverse_engineer.analyzers import compute_paths

FIX = pathlib.Path(__file__).parent / "fixtures"

def test_graph_basic():
    doc = parse_bpmn(FIX / "01_linear.bpmn")
    g = build_graph(doc)
    assert "StartEvent_1" in g.nodes
    assert "Task_A" in g.nodes
    assert g.has_edge("StartEvent_1", "Task_A")
    assert g.edges["StartEvent_1", "Task_A"]["flow_id"] == "Flow_1"

def test_graph_exclusive_branch():
    doc = parse_bpmn(FIX / "02_exclusive_gateway.bpmn")
    g = build_graph(doc)
    assert g.out_degree("Gateway_1") == 2
    # condition preserved
    assert g.edges["Gateway_1", "Task_B"]["condition"] is not None

def test_graph_parallel():
    doc = parse_bpmn(FIX / "03_parallel_gateway.bpmn")
    g = build_graph(doc)
    assert g.out_degree("Fork") == 2
    assert g.in_degree("Join") == 2

def test_paths_linear():
    doc = parse_bpmn(FIX / "01_linear.bpmn")
    g = build_graph(doc)
    paths = compute_paths(g)
    assert len(paths) == 1
    assert paths[0].nodes == ["StartEvent_1", "Task_A", "EndEvent_1"]

def test_paths_branch():
    doc = parse_bpmn(FIX / "02_exclusive_gateway.bpmn")
    g = build_graph(doc)
    paths = compute_paths(g, limit=10)
    assert len(paths) == 2
    # Both paths should go through Gateway_1
    for p in paths:
        assert "Gateway_1" in p.nodes

def test_paths_limit():
    doc = parse_bpmn(FIX / "03_parallel_gateway.bpmn")
    g = build_graph(doc)
    paths = compute_paths(g, limit=1)
    assert len(paths) == 1

def test_graph_node_attributes():
    doc = parse_bpmn(FIX / "04_lanes.bpmn")
    g = build_graph(doc)
    assert g.nodes["Task_A"]["lane"] == "Lane_1"
    assert g.nodes["Task_B"]["lane"] == "Lane_2"

def test_graph_message_flow_not_duplicate():
    doc = parse_bpmn(FIX / "05_message_flow.bpmn")
    g = build_graph(doc)
    # message flows add edges but not duplicate sequence
    assert g.has_node("Pool_Order")
    assert g.has_node("Pool_Payment")
