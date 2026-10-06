import { describe, it, expect } from 'vitest';
import { buildOracleEcosystem } from '../ecosystemParser';
import { buildBpmnGraph, bpmnGraphToMermaid, buildProjectTree, validateMermaidFlowchart } from '../bpmnFlowGraph';
import { buildDocsPackage } from '../docsPackageGenerator';

const bpmnWithFlows = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D1">
  <bpmn:process id="P1" name="ApproveOrder" isExecutable="true">
    <bpmn:laneSet id="LS1">
      <bpmn:lane id="Lane_Sales" name="Vendite">
        <bpmn:flowNodeRef>Start_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Approve</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_Sys" name="Sistema">
        <bpmn:flowNodeRef>Task_Book</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>End_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="Start_1" name="Richiesta"/>
    <bpmn:userTask id="Task_Approve" name="Approva ordine">
      <bpmn:documentation>Il supervisore approva entro 48h</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="Gw_1" name="Approvato?"/>
    <bpmn:serviceTask id="Task_Book" name="Prenota stock" implementation="StockService"/>
    <bpmn:endEvent id="End_1" name="Chiuso"/>
    <bpmn:sequenceFlow id="F1" sourceRef="Start_1" targetRef="Task_Approve"/>
    <bpmn:sequenceFlow id="F2" sourceRef="Task_Approve" targetRef="Gw_1"/>
    <bpmn:sequenceFlow id="F3" name="si" sourceRef="Gw_1" targetRef="Task_Book">
      <bpmn:conditionExpression>approved == true</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="F4" name="no" sourceRef="Gw_1" targetRef="End_1"/>
    <bpmn:sequenceFlow id="F5" sourceRef="Task_Book" targetRef="End_1"/>
  </bpmn:process>
</bpmn:definitions>`;

const bpmnNoFlows = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D2">
  <bpmn:process id="P2" name="Simple">
    <bpmn:startEvent id="S1" name="Via"/>
    <bpmn:userTask id="U1" name="Controlla"/>
    <bpmn:endEvent id="E1" name="Fine"/>
  </bpmn:process>
</bpmn:definitions>`;

describe('fase I - flussi BPMN interni', () => {
  it('estrae archi, lane e condizioni', () => {
    const eco = buildOracleEcosystem([
      { name: 'approve.bpmn', relativePath: 'proj/BPMN/approve.bpmn', content: bpmnWithFlows },
    ]);
    expect(eco.bpmnProcesses).toHaveLength(1);
    const p = eco.bpmnProcesses[0];
    expect(p.flows).toHaveLength(5);
    expect(p.syntheticOrder).toBe(false);
    expect(p.userTasks[0].lane).toBe('Vendite');
    expect(p.serviceTasks[0].lane).toBe('Sistema');
    const f3 = p.flows.find((f) => f.id === 'F3');
    expect(f3?.condition).toContain('approved');
  });

  it('grafo con rami condizionati e mermaid', () => {
    const eco = buildOracleEcosystem([
      { name: 'approve.bpmn', relativePath: 'proj/BPMN/approve.bpmn', content: bpmnWithFlows },
    ]);
    const g = buildBpmnGraph(eco.bpmnProcesses[0], eco);
    expect(g.nodes.length).toBeGreaterThanOrEqual(5);
    expect(g.edges).toHaveLength(5);
    expect(g.syntheticOrder).toBe(false);
    const mmd = bpmnGraphToMermaid('ApproveOrder', g);
    expect(mmd).toContain('flowchart LR');
    expect(mmd).toContain('approved');
  });

  it('senza sequenceFlow dichiara ordine sintetico', () => {
    const eco = buildOracleEcosystem([
      { name: 'simple.bpmn', relativePath: 'proj/BPMN/simple.bpmn', content: bpmnNoFlows },
    ]);
    const p = eco.bpmnProcesses[0];
    expect(p.flows).toHaveLength(0);
    expect(p.syntheticOrder).toBe(true);
    const g = buildBpmnGraph(p, eco);
    expect(g.syntheticOrder).toBe(true);
    expect(g.warnings.length).toBeGreaterThan(0);
    expect(g.edges.length).toBe(g.nodes.length - 1);
  });

  it('ZIP con per-file BPMN + mmd flussi, nomi unici', () => {
    const eco = buildOracleEcosystem([
      { name: 'approve.bpmn', relativePath: 'projA/BPMN/approve.bpmn', content: bpmnWithFlows },
      { name: 'approve.bpmn', relativePath: 'projB/BPMN/approve.bpmn', content: bpmnWithFlows },
    ]);
    const pkg = buildDocsPackage(eco, { language: 'it' });
    const docs = Object.keys(pkg).filter((k) => k.startsWith('docs/technical/bpmn/') && k !== 'docs/technical/bpmn/INDEX.md');
    const mmds = Object.keys(pkg).filter((k) => k.startsWith('docs/diagrams/flows/'));
    expect(docs).toHaveLength(2);
    expect(new Set(docs).size).toBe(2);
    expect(mmds).toHaveLength(2);
    expect(pkg['docs/00-INDEX.md']).toContain('technical/bpmn/INDEX.md');
  });

  it('tutti i mermaid dello ZIP sono sintatticamente validi', () => {
    const eco = buildOracleEcosystem([
      { name: 'composite.xml', relativePath: 'ProjX/SOA/Order composite.xml', content: '<composite name="Order (special): Hawaii" revision="1.0"><service name="Svc (in)"><interface.wsdl interface="x"/><binding.ws port="p"/></service><component name="C1"><implementation.bpmn src="a.bpmn"/></component><reference name="Out [test]"><interface.wsdl interface="y"/><binding.jca config="a.jca"/></reference></composite>' },
      { name: 'approve.bpmn', relativePath: 'ProjX/SOA/BPMN/approve (v2).bpmn', content: bpmnWithFlows },
      { name: 'a.jca', relativePath: 'ProjX/SOA/a.jca', content: '<adapter-config name="Adap(Mock)" adapter="DB Adapter" wsdlLocation="x.wsdl"><connection-factory location="eis/DB/x"/><endpoint-interaction portType="P" operation="op (1)"><interaction-spec className="C"><property name="SqlString" value="SELECT 1"/></interaction-spec></endpoint-interaction></adapter-config>' },
    ]);
    const pkg = buildDocsPackage(eco, { language: 'it' });
    const mmdFiles = Object.entries(pkg).filter(([k]) => k.endsWith('.mmd'));
    expect(mmdFiles.length).toBeGreaterThan(0);
    mmdFiles.forEach(([k, v]) => {
      expect(validateMermaidFlowchart(v), `errori in ${k}`).toEqual([]);
    });
    // Blocchi mermaid dentro i .md (con nomi pieni di spazi/parentesi/pipe)
    const blocks: string[] = [];
    Object.values(pkg).forEach((content) => {
      const re = /```mermaid\n([\s\S]*?)```/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) blocks.push(m[1]);
    });
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach((b, i) => {
      expect(validateMermaidFlowchart(b), `errori nel blocco mermaid #${i}`).toEqual([]);
    });
  });

  it('albero progetti jpr->composite', () => {
    const eco = buildOracleEcosystem([
      { name: 'composite.xml', relativePath: 'ProjX/SOA/composite.xml', content: '<composite name="Cx" revision="1.0"><component name="C1"><implementation.bpmn src="a.bpmn"/></component></composite>' },
      { name: 'approve.bpmn', relativePath: 'ProjX/SOA/BPMN/approve.bpmn', content: bpmnWithFlows },
    ]);
    const tree = buildProjectTree(eco);
    expect(Array.isArray(tree)).toBe(true);
  });
});
