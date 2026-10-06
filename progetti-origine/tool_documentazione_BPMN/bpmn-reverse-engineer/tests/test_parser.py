import pathlib
from bpmn_reverse_engineer.parser import parse_bpmn

FIX = pathlib.Path(__file__).parent / "fixtures"

def test_linear():
    doc = parse_bpmn(FIX / "01_linear.bpmn")
    assert len(doc.processes) == 1
    assert doc.processes[0].id == "Process_Linear"
    assert len(doc.sequence_flows) == 2
    ids = {e.id for e in doc.elements}
    assert "StartEvent_1" in ids
    assert "Task_A" in ids
    assert "EndEvent_1" in ids
    # metrics via parser raw
    assert len(doc.lanes) == 0

def test_exclusive_gateway():
    doc = parse_bpmn(FIX / "02_exclusive_gateway.bpmn")
    gw = [e for e in doc.elements if e.type == "exclusiveGateway"]
    assert len(gw) == 1
    assert gw[0].default_flow == "F4"
    flows = {sf.id: sf for sf in doc.sequence_flows}
    assert flows["F3"].condition is not None
    assert "${amount" in flows["F3"].condition
    # default detection
    assert flows["F4"].is_default is True
    assert flows["F3"].is_default is False

def test_parallel_gateway():
    doc = parse_bpmn(FIX / "03_parallel_gateway.bpmn")
    assert len([e for e in doc.elements if e.type == "parallelGateway"]) == 2
    assert len([e for e in doc.elements if e.type == "serviceTask"]) == 1
    assert len([e for e in doc.elements if e.type == "userTask"]) == 1

def test_lanes():
    doc = parse_bpmn(FIX / "04_lanes.bpmn")
    assert len(doc.lanes) == 2
    assert len(doc.participants) == 1
    lane_ids = {l.id for l in doc.lanes}
    assert "Lane_1" in lane_ids
    # lane assignment
    elem = next(e for e in doc.elements if e.id == "Task_A")
    assert elem.lane_id == "Lane_1"
    elem2 = next(e for e in doc.elements if e.id == "Task_B")
    assert elem2.lane_id == "Lane_2"

def test_message_flow():
    doc = parse_bpmn(FIX / "05_message_flow.bpmn")
    assert len(doc.message_flows) == 2
    assert len(doc.participants) == 2
    ids = {mf.id for mf in doc.message_flows}
    assert "MsgFlow_1" in ids

def test_timer_event():
    doc = parse_bpmn(FIX / "06_timer_event.bpmn")
    start = next(e for e in doc.elements if e.id == "Start_1")
    assert "timerEventDefinition" in start.event_definitions
    catch = next(e for e in doc.elements if e.id == "Catch_Timer")
    assert "timerEventDefinition" in catch.event_definitions

def test_boundary_event():
    doc = parse_bpmn(FIX / "07_boundary_event.bpmn")
    b = next(e for e in doc.elements if e.id == "Boundary_Timer")
    assert b.type == "boundaryEvent"
    assert "timerEventDefinition" in b.event_definitions
    assert b.raw_attributes.get("attachedToRef") == "UserTask_1"

def test_subprocess():
    doc = parse_bpmn(FIX / "08_subprocess.bpmn")
    assert any(e.type == "subProcess" for e in doc.elements)
    assert any(e.id == "Script_1" for e in doc.elements)
    # subprocess children should be present
    assert len(doc.sequence_flows) == 4  # 2 outer + 2 inner

def test_call_activity():
    doc = parse_bpmn(FIX / "09_callActivity.bpmn")
    call = next(e for e in doc.elements if e.type == "callActivity")
    assert call.raw_attributes.get("calledElement") == "SubProcess_External"
    assert len(doc.references) >= 1
    assert any(r.attribute == "calledElement" and r.value == "SubProcess_External" for r in doc.references)

def test_extension_elements():
    doc = parse_bpmn(FIX / "10_extensionElements.bpmn")
    assert len(doc.extensions) >= 2
    # global extension + task extension
    tags = {e.tag for e in doc.extensions}
    assert "customProperty" in tags or "adapter" in tags or "binding" in tags

def test_condition_expression():
    doc = parse_bpmn(FIX / "11_conditionExpression.bpmn")
    f2 = next(sf for sf in doc.sequence_flows if sf.id == "F2")
    assert f2.condition is not None
    assert "count($input)" in f2.condition
    f3 = next(sf for sf in doc.sequence_flows if sf.id == "F3")
    assert "${low" in f3.condition

def test_unknown_elements():
    doc = parse_bpmn(FIX / "12_unknown_elements.bpmn")
    unknowns = [e for e in doc.elements if e.is_unknown]
    assert len(unknowns) >= 1
    # custom:myCustomTask should be unknown
    assert any(e.id == "Custom_1" and e.is_unknown for e in doc.elements)
    assert len(doc.unknown_elements) == len(unknowns)

def test_namespace_prefix_robustness(tmp_path):
    # Write BPMN with different prefix bpmn2
    xml = """<?xml version="1.0"?>
    <bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D1" targetNamespace="http://example.com/prefix">
      <bpmn2:process id="P1" name="PrefixTest">
        <bpmn2:startEvent id="S1"><bpmn2:outgoing>F1</bpmn2:outgoing></bpmn2:startEvent>
        <bpmn2:task id="T1"><bpmn2:incoming>F1</bpmn2:incoming><bpmn2:outgoing>F2</bpmn2:outgoing></bpmn2:task>
        <bpmn2:endEvent id="E1"><bpmn2:incoming>F2</bpmn2:incoming></bpmn2:endEvent>
        <bpmn2:sequenceFlow id="F1" sourceRef="S1" targetRef="T1"/>
        <bpmn2:sequenceFlow id="F2" sourceRef="T1" targetRef="E1"/>
      </bpmn2:process>
    </bpmn2:definitions>"""
    p = tmp_path / "pref.bpmn"
    p.write_text(xml, encoding="utf-8")
    doc = parse_bpmn(p)
    assert len(doc.elements) == 3
    assert len(doc.sequence_flows) == 2

def test_documentation_extraction():
    doc = parse_bpmn(FIX / "01_linear.bpmn")
    # Task_A has no doc, process has? Check element documentation preserved as None when absent
    task = next(e for e in doc.elements if e.id == "Task_A")
    assert task.documentation is None
    # extensionElements preserves structure
    doc2 = parse_bpmn(FIX / "10_extensionElements.bpmn")
    svc = next(e for e in doc2.elements if e.id == "Service_1")
    assert svc.documentation == "Calls JCA adapter"
