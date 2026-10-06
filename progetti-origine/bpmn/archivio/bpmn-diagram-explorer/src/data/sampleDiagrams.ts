import { BpmnFileItem } from '../types';

export const SAMPLE_DIAGRAMS: BpmnFileItem[] = [
  {
    id: 'sample-ordine-acquisto',
    name: 'Gestione_Ordine_Acquisto.bpmn',
    relativePath: 'Ordini_e_Vendite/Gestione_Ordine_Acquisto.bpmn',
    folderPath: 'Ordini_e_Vendite',
    isSample: true,
    isValid: true,
    size: 4200,
    stats: { tasksCount: 6, gatewaysCount: 2, eventsCount: 3, subprocessesCount: 0 },
    content: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_GestioneOrdine" name="Gestione Ordine Acquisto" isExecutable="true">
    <bpmn:documentation>Processo end-to-end per la ricezione, verifica di magazzino, pagamento e spedizione di un ordine cliente.</bpmn:documentation>
    <bpmn:startEvent id="Start_1" name="Ordine Ricevuto">
      <bpmn:outgoing">Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Task_VerificaDisponibilita" name="Verifica Disponibilità Magazzino">
      <bpmn:documentation>Controllo giacenze prodotti a sistema ERP.</bpmn:documentation>
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="Gateway_Disponibile" name="Articoli Disponibili?">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_Si</bpmn:outgoing>
      <bpmn:outgoing>Flow_No</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:serviceTask id="Task_ElaboraPagamento" name="Elaborazione Pagamento Carta">
      <bpmn:incoming>Flow_Si</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sendTask id="Task_NotificaRifornimento" name="Invia Notifica Rifornimento">
      <bpmn:incoming>Flow_No</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:sendTask>
    <bpmn:manualTask id="Task_PreparazionePacco" name="Imballaggio e Preparazione Spedizione">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_5</bpmn:outgoing>
    </bpmn:manualTask>
    <bpmn:sendTask id="Task_InviaConferma" name="Invia Email di Conferma e Tracking">
      <bpmn:incoming>Flow_5</bpmn:incoming>
      <bpmn:outgoing>Flow_6</bpmn:outgoing>
    </bpmn:sendTask>
    <bpmn:endEvent id="End_Concluso" name="Ordine Spedito">
      <bpmn:incoming>Flow_6</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="End_Annullato" name="Ordine In Attesa Rifornimento">
      <bpmn:incoming>Flow_4</bpmn:incoming>
    </bpmn:endEvent>

    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_VerificaDisponibilita" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_VerificaDisponibilita" targetRef="Gateway_Disponibile" />
    <bpmn:sequenceFlow id="Flow_Si" name="Sì" sourceRef="Gateway_Disponibile" targetRef="Task_ElaboraPagamento" />
    <bpmn:sequenceFlow id="Flow_No" name="No" sourceRef="Gateway_Disponibile" targetRef="Task_NotificaRifornimento" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_ElaboraPagamento" targetRef="Task_PreparazionePacco" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Task_NotificaRifornimento" targetRef="End_Annullato" />
    <bpmn:sequenceFlow id="Flow_5" sourceRef="Task_PreparazionePacco" targetRef="Task_InviaConferma" />
    <bpmn:sequenceFlow id="Flow_6" sourceRef="Task_InviaConferma" targetRef="End_Concluso" />
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_GestioneOrdine">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="160" y="142" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="139" y="185" width="79" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_VerificaDisponibilita_di" bpmnElement="Task_VerificaDisponibilita">
        <dc:Bounds x="250" y="120" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Disponibile_di" bpmnElement="Gateway_Disponibile" isMarkerVisible="true">
        <dc:Bounds x="425" y="135" width="50" height="50" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="418" y="98" width="63" height="27" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_ElaboraPagamento_di" bpmnElement="Task_ElaboraPagamento">
        <dc:Bounds x="530" y="120" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_NotificaRifornimento_di" bpmnElement="Task_NotificaRifornimento">
        <dc:Bounds x="530" y="240" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_PreparazionePacco_di" bpmnElement="Task_PreparazionePacco">
        <dc:Bounds x="700" y="120" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_InviaConferma_di" bpmnElement="Task_InviaConferma">
        <dc:Bounds x="880" y="120" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Concluso_di" bpmnElement="End_Concluso">
        <dc:Bounds x="1050" y="142" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="1031" y="185" width="74" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Annullato_di" bpmnElement="End_Annullato">
        <dc:Bounds x="700" y="262" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="677" y="305" width="82" height="27" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>

      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="196" y="160" />
        <di:waypoint x="250" y="160" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="370" y="160" />
        <di:waypoint x="425" y="160" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Si_di" bpmnElement="Flow_Si">
        <di:waypoint x="475" y="160" />
        <di:waypoint x="530" y="160" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="496" y="142" width="13" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_No_di" bpmnElement="Flow_No">
        <di:waypoint x="450" y="185" />
        <di:waypoint x="450" y="280" />
        <di:waypoint x="530" y="280" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="458" y="230" width="15" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="650" y="160" />
        <di:waypoint x="700" y="160" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="650" y="280" />
        <di:waypoint x="700" y="280" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5">
        <di:waypoint x="830" y="160" />
        <di:waypoint x="880" y="160" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_6_di" bpmnElement="Flow_6">
        <di:waypoint x="1000" y="160" />
        <di:waypoint x="1050" y="160" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
  },
  {
    id: 'sample-assunzione-personale',
    name: 'Onboarding_Nuovo_Dipendente.bpmn',
    relativePath: 'Risorse_Umane/Onboarding_Nuovo_Dipendente.bpmn',
    folderPath: 'Risorse_Umane',
    isSample: true,
    isValid: true,
    size: 4800,
    stats: { tasksCount: 5, gatewaysCount: 2, eventsCount: 2, subprocessesCount: 0 },
    content: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_HR"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_Onboarding" name="Onboarding Dipendente" isExecutable="true">
    <bpmn:startEvent id="Start_HR" name="Contratto Firmato">
      <bpmn:outgoing>Flow_HR1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Task_CreazioneAccount" name="Creazione Account IT e Credenziali">
      <bpmn:incoming>Flow_HR1</bpmn:incoming>
      <bpmn:outgoing>Flow_HR2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:parallelGateway id="Gateway_Fork" name="Avvio Attività Parallele">
      <bpmn:incoming>Flow_HR2</bpmn:incoming>
      <bpmn:outgoing>Flow_BranchIT</bpmn:outgoing>
      <bpmn:outgoing>Flow_BranchFormazione</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:userTask id="Task_Hardware" name="Configurazione Laptop e Badge">
      <bpmn:incoming>Flow_BranchIT</bpmn:incoming>
      <bpmn:outgoing>Flow_Join1</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="Task_Formazione" name="Pianificazione Corso Sicurezza">
      <bpmn:incoming>Flow_BranchFormazione</bpmn:incoming>
      <bpmn:outgoing>Flow_Join2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:parallelGateway id="Gateway_Join" name="Sincronizzazione Completa">
      <bpmn:incoming>Flow_Join1</bpmn:incoming>
      <bpmn:incoming>Flow_Join2</bpmn:incoming>
      <bpmn:outgoing>Flow_FinalTask</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:userTask id="Task_WelcomeSession" name="Sessione Benvenuto con il Manager">
      <bpmn:incoming>Flow_FinalTask</bpmn:incoming>
      <bpmn:outgoing>Flow_EndHR</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="End_HR" name="Onboarding Completato">
      <bpmn:incoming>Flow_EndHR</bpmn:incoming>
    </bpmn:endEvent>

    <bpmn:sequenceFlow id="Flow_HR1" sourceRef="Start_HR" targetRef="Task_CreazioneAccount" />
    <bpmn:sequenceFlow id="Flow_HR2" sourceRef="Task_CreazioneAccount" targetRef="Gateway_Fork" />
    <bpmn:sequenceFlow id="Flow_BranchIT" sourceRef="Gateway_Fork" targetRef="Task_Hardware" />
    <bpmn:sequenceFlow id="Flow_BranchFormazione" sourceRef="Gateway_Fork" targetRef="Task_Formazione" />
    <bpmn:sequenceFlow id="Flow_Join1" sourceRef="Task_Hardware" targetRef="Gateway_Join" />
    <bpmn:sequenceFlow id="Flow_Join2" sourceRef="Task_Formazione" targetRef="Gateway_Join" />
    <bpmn:sequenceFlow id="Flow_FinalTask" sourceRef="Gateway_Join" targetRef="Task_WelcomeSession" />
    <bpmn:sequenceFlow id="Flow_EndHR" sourceRef="Task_WelcomeSession" targetRef="End_HR" />
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_HR">
    <bpmndi:BPMNPlane id="BPMNPlane_HR" bpmnElement="Process_Onboarding">
      <bpmndi:BPMNShape id="Start_HR_di" bpmnElement="Start_HR">
        <dc:Bounds x="152" y="172" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="127" y="215" width="87" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_CreazioneAccount_di" bpmnElement="Task_CreazioneAccount">
        <dc:Bounds x="240" y="150" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Fork_di" bpmnElement="Gateway_Fork" isMarkerVisible="true">
        <dc:Bounds x="425" y="165" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Hardware_di" bpmnElement="Task_Hardware">
        <dc:Bounds x="530" y="80" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Formazione_di" bpmnElement="Task_Formazione">
        <dc:Bounds x="530" y="240" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Join_di" bpmnElement="Gateway_Join" isMarkerVisible="true">
        <dc:Bounds x="715" y="165" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_WelcomeSession_di" bpmnElement="Task_WelcomeSession">
        <dc:Bounds x="820" y="150" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_HR_di" bpmnElement="End_HR">
        <dc:Bounds x="1002" y="172" width="36" height="36" />
      </bpmndi:BPMNShape>

      <bpmndi:BPMNEdge id="Flow_HR1_di" bpmnElement="Flow_HR1">
        <di:waypoint x="188" y="190" /><di:waypoint x="240" y="190" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_HR2_di" bpmnElement="Flow_HR2">
        <di:waypoint x="370" y="190" /><di:waypoint x="425" y="190" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_BranchIT_di" bpmnElement="Flow_BranchIT">
        <di:waypoint x="450" y="165" /><di:waypoint x="450" y="120" /><di:waypoint x="530" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_BranchFormazione_di" bpmnElement="Flow_BranchFormazione">
        <di:waypoint x="450" y="215" /><di:waypoint x="450" y="280" /><di:waypoint x="530" y="280" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Join1_di" bpmnElement="Flow_Join1">
        <di:waypoint x="660" y="120" /><di:waypoint x="740" y="120" /><di:waypoint x="740" y="165" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Join2_di" bpmnElement="Flow_Join2">
        <di:waypoint x="660" y="280" /><di:waypoint x="740" y="280" /><di:waypoint x="740" y="215" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_FinalTask_di" bpmnElement="Flow_FinalTask">
        <di:waypoint x="765" y="190" /><di:waypoint x="820" y="190" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_EndHR_di" bpmnElement="Flow_EndHR">
        <di:waypoint x="950" y="190" /><di:waypoint x="1002" y="190" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
  },
  {
    id: 'sample-gestione-incidenti',
    name: 'Gestione_Incidenti_IT.bpmn',
    relativePath: 'Sistemi_IT/Gestione_Incidenti_IT.bpmn',
    folderPath: 'Sistemi_IT',
    isSample: true,
    isValid: true,
    size: 3900,
    stats: { tasksCount: 4, gatewaysCount: 1, eventsCount: 3, subprocessesCount: 0 },
    content: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_Incident"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_Incident" name="Gestione Incidenti ITIL" isExecutable="true">
    <bpmn:startEvent id="Start_Incident" name="Ticket Incidente Segnalato">
      <bpmn:outgoing>Flow_Inc1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Task_Triage" name="Triage e Categorizzazione L1">
      <bpmn:incoming>Flow_Inc1</bpmn:incoming>
      <bpmn:outgoing>Flow_Inc2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="Gateway_L2" name="Richiede Supporto L2?">
      <bpmn:incoming>Flow_Inc2</bpmn:incoming>
      <bpmn:outgoing>Flow_L1Sol</bpmn:outgoing>
      <bpmn:outgoing>Flow_L2Escalation</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:userTask id="Task_RisoluzioneL1" name="Applica Workaround L1">
      <bpmn:incoming>Flow_L1Sol</bpmn:incoming>
      <bpmn:outgoing>Flow_IncEnd1</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="Task_RisoluzioneL2" name="Analisi Tecnica Avanzata L2">
      <bpmn:incoming>Flow_L2Escalation</bpmn:incoming>
      <bpmn:outgoing>Flow_IncEnd2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="End_Resolved1" name="Incidente Chiuso L1">
      <bpmn:incoming>Flow_IncEnd1</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="End_Resolved2" name="Incidente Risolto L2">
      <bpmn:incoming>Flow_IncEnd2</bpmn:incoming>
    </bpmn:endEvent>

    <bpmn:sequenceFlow id="Flow_Inc1" sourceRef="Start_Incident" targetRef="Task_Triage" />
    <bpmn:sequenceFlow id="Flow_Inc2" sourceRef="Task_Triage" targetRef="Gateway_L2" />
    <bpmn:sequenceFlow id="Flow_L1Sol" name="No" sourceRef="Gateway_L2" targetRef="Task_RisoluzioneL1" />
    <bpmn:sequenceFlow id="Flow_L2Escalation" name="Sì" sourceRef="Gateway_L2" targetRef="Task_RisoluzioneL2" />
    <bpmn:sequenceFlow id="Flow_IncEnd1" sourceRef="Task_RisoluzioneL1" targetRef="End_Resolved1" />
    <bpmn:sequenceFlow id="Flow_IncEnd2" sourceRef="Task_RisoluzioneL2" targetRef="End_Resolved2" />
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_Inc">
    <bpmndi:BPMNPlane id="BPMNPlane_Inc" bpmnElement="Process_Incident">
      <bpmndi:BPMNShape id="Start_Incident_di" bpmnElement="Start_Incident">
        <dc:Bounds x="160" y="142" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Triage_di" bpmnElement="Task_Triage">
        <dc:Bounds x="250" y="120" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_L2_di" bpmnElement="Gateway_L2" isMarkerVisible="true">
        <dc:Bounds x="435" y="135" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_RisoluzioneL1_di" bpmnElement="Task_RisoluzioneL1">
        <dc:Bounds x="540" y="70" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_RisoluzioneL2_di" bpmnElement="Task_RisoluzioneL2">
        <dc:Bounds x="540" y="200" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Resolved1_di" bpmnElement="End_Resolved1">
        <dc:Bounds x="730" y="92" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Resolved2_di" bpmnElement="End_Resolved2">
        <dc:Bounds x="730" y="222" width="36" height="36" />
      </bpmndi:BPMNShape>

      <bpmndi:BPMNEdge id="Flow_Inc1_di" bpmnElement="Flow_Inc1">
        <di:waypoint x="196" y="160" /><di:waypoint x="250" y="160" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Inc2_di" bpmnElement="Flow_Inc2">
        <di:waypoint x="380" y="160" /><di:waypoint x="435" y="160" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_L1Sol_di" bpmnElement="Flow_L1Sol">
        <di:waypoint x="460" y="135" /><di:waypoint x="460" y="110" /><di:waypoint x="540" y="110" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_L2Escalation_di" bpmnElement="Flow_L2Escalation">
        <di:waypoint x="460" y="185" /><di:waypoint x="460" y="240" /><di:waypoint x="540" y="240" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_IncEnd1_di" bpmnElement="Flow_IncEnd1">
        <di:waypoint x="670" y="110" /><di:waypoint x="730" y="110" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_IncEnd2_di" bpmnElement="Flow_IncEnd2">
        <di:waypoint x="670" y="240" /><di:waypoint x="730" y="240" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
  },
  {
    id: 'sample-approvazione-spese',
    name: 'Approvazione_Note_Spese.bpmn',
    relativePath: 'Amministrazione/Approvazione_Note_Spese.bpmn',
    folderPath: 'Amministrazione',
    isSample: true,
    isValid: true,
    size: 4100,
    stats: { tasksCount: 5, gatewaysCount: 2, eventsCount: 3, subprocessesCount: 0 },
    content: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_Expense"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_NoteSpese" name="Approvazione Nota Spese" isExecutable="true">
    <bpmn:startEvent id="Start_Expense" name="Nota Spese Inviata">
      <bpmn:outgoing>Flow_Ex1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Task_VerificaImporto" name="Controllo Tetti di Spesa e Scontrini">
      <bpmn:incoming>Flow_Ex1</bpmn:incoming>
      <bpmn:outgoing>Flow_Ex2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="Gateway_Manager" name="Importo > 1000€?">
      <bpmn:incoming>Flow_Ex2</bpmn:incoming>
      <bpmn:outgoing>Flow_Sotto1000</bpmn:outgoing>
      <bpmn:outgoing>Flow_Sopra1000</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:userTask id="Task_ApprovazioneDirettore" name="Approvazione Straordinaria Direzione">
      <bpmn:incoming>Flow_Sopra1000</bpmn:incoming>
      <bpmn:outgoing>Flow_ApprDir</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="Task_ApprovazioneManager" name="Approvazione Responsabile Diretto">
      <bpmn:incoming>Flow_Sotto1000</bpmn:incoming>
      <bpmn:outgoing>Flow_ApprMan</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="Gateway_JoinSpese" name="Merge Approvazioni">
      <bpmn:incoming>Flow_ApprDir</bpmn:incoming>
      <bpmn:incoming>Flow_ApprMan</bpmn:incoming>
      <bpmn:outgoing>Flow_ToPay</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:serviceTask id="Task_Bonifico" name="Esecuzione Bonifico di Rimborso">
      <bpmn:incoming>Flow_ToPay</bpmn:incoming>
      <bpmn:outgoing>Flow_ExEnd</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="End_RimborsoAccreditato" name="Rimborso Effettuato">
      <bpmn:incoming>Flow_ExEnd</bpmn:incoming>
    </bpmn:endEvent>

    <bpmn:sequenceFlow id="Flow_Ex1" sourceRef="Start_Expense" targetRef="Task_VerificaImporto" />
    <bpmn:sequenceFlow id="Flow_Ex2" sourceRef="Task_VerificaImporto" targetRef="Gateway_Manager" />
    <bpmn:sequenceFlow id="Flow_Sotto1000" name="No (&lt;= 1000€)" sourceRef="Gateway_Manager" targetRef="Task_ApprovazioneManager" />
    <bpmn:sequenceFlow id="Flow_Sopra1000" name="Sì (&gt; 1000€)" sourceRef="Gateway_Manager" targetRef="Task_ApprovazioneDirettore" />
    <bpmn:sequenceFlow id="Flow_ApprDir" sourceRef="Task_ApprovazioneDirettore" targetRef="Gateway_JoinSpese" />
    <bpmn:sequenceFlow id="Flow_ApprMan" sourceRef="Task_ApprovazioneManager" targetRef="Gateway_JoinSpese" />
    <bpmn:sequenceFlow id="Flow_ToPay" sourceRef="Gateway_JoinSpese" targetRef="Task_Bonifico" />
    <bpmn:sequenceFlow id="Flow_ExEnd" sourceRef="Task_Bonifico" targetRef="End_RimborsoAccreditato" />
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_Expense">
    <bpmndi:BPMNPlane id="BPMNPlane_Expense" bpmnElement="Process_NoteSpese">
      <bpmndi:BPMNShape id="Start_Expense_di" bpmnElement="Start_Expense">
        <dc:Bounds x="160" y="152" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_VerificaImporto_di" bpmnElement="Task_VerificaImporto">
        <dc:Bounds x="250" y="130" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Manager_di" bpmnElement="Gateway_Manager" isMarkerVisible="true">
        <dc:Bounds x="435" y="145" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_ApprovazioneManager_di" bpmnElement="Task_ApprovazioneManager">
        <dc:Bounds x="540" y="70" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_ApprovazioneDirettore_di" bpmnElement="Task_ApprovazioneDirettore">
        <dc:Bounds x="540" y="220" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_JoinSpese_di" bpmnElement="Gateway_JoinSpese" isMarkerVisible="true">
        <dc:Bounds x="725" y="145" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Bonifico_di" bpmnElement="Task_Bonifico">
        <dc:Bounds x="830" y="130" width="130" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_RimborsoAccreditato_di" bpmnElement="End_RimborsoAccreditato">
        <dc:Bounds x="1012" y="152" width="36" height="36" />
      </bpmndi:BPMNShape>

      <bpmndi:BPMNEdge id="Flow_Ex1_di" bpmnElement="Flow_Ex1">
        <di:waypoint x="196" y="170" /><di:waypoint x="250" y="170" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Ex2_di" bpmnElement="Flow_Ex2">
        <di:waypoint x="380" y="170" /><di:waypoint x="435" y="170" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Sotto1000_di" bpmnElement="Flow_Sotto1000">
        <di:waypoint x="460" y="145" /><di:waypoint x="460" y="110" /><di:waypoint x="540" y="110" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Sopra1000_di" bpmnElement="Flow_Sopra1000">
        <di:waypoint x="460" y="195" /><di:waypoint x="460" y="260" /><di:waypoint x="540" y="260" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ApprMan_di" bpmnElement="Flow_ApprMan">
        <di:waypoint x="670" y="110" /><di:waypoint x="750" y="110" /><di:waypoint x="750" y="145" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ApprDir_di" bpmnElement="Flow_ApprDir">
        <di:waypoint x="670" y="260" /><di:waypoint x="750" y="260" /><di:waypoint x="750" y="195" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ToPay_di" bpmnElement="Flow_ToPay">
        <di:waypoint x="775" y="170" /><di:waypoint x="830" y="170" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ExEnd_di" bpmnElement="Flow_ExEnd">
        <di:waypoint x="960" y="170" /><di:waypoint x="1012" y="170" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
  }
];
