export interface SampleBpmn {
  id: string;
  name: string;
  description: string;
  xml: string;
}

export const SAMPLE_BPMN_FILES: SampleBpmn[] = [
  {
    id: 'order-fulfillment',
    name: 'E-commerce & Evasione Ordini (Order Fulfillment)',
    description: 'Processo completo di ricezione ordine, verifica magazzino, pagamento Stripe/Carta, spedizione e fatturazione.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant_Azienda" name="Azienda E-Commerce Corp" processRef="Process_OrderFulfillment" />
  </bpmn:collaboration>

  <bpmn:process id="Process_OrderFulfillment" name="Evasione Ordini e Fatturazione" isExecutable="true">
    <bpmn:documentation>Processo aziendale per la gestione end-to-end degli ordini dei clienti e relativo saldo contabile.</bpmn:documentation>
    
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_Vendite" name="Reparto Vendite &amp; Front-Office">
        <bpmn:flowNodeRef>Start_OrderReceived</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_CheckInventory</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_StockCheck</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_NotifyCustomerOutStock</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>End_OrderCancelled</bpmn:flowNodeRef>
      </bpmn:lane>

      <bpmn:lane id="Lane_Amministrazione" name="Amministrazione &amp; Contabilità">
        <bpmn:flowNodeRef>Task_ProcessPayment</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_PaymentSuccess</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_GenerateInvoice</bpmn:flowNodeRef>
      </bpmn:lane>

      <bpmn:lane id="Lane_Logistica" name="Magazzino &amp; Logistica">
        <bpmn:flowNodeRef>Task_PreparePackage</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_ShipOrder</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>End_OrderCompleted</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>

    <!-- Flow Nodes -->
    <bpmn:startEvent id="Start_OrderReceived" name="Ordine Ricevuto dal Web">
      <bpmn:documentation>Il cliente completa il checkout sul sito e-commerce inviando il carrello.</bpmn:documentation>
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>

    <bpmn:serviceTask id="Task_CheckInventory" name="Verifica Disponibilità Articoli" camunda:topic="inventory-service">
      <bpmn:documentation>Interrogazione automatica al database ERP/WMS per confermare la giacenza in magazzino.</bpmn:documentation>
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:serviceTask>

    <bpmn:exclusiveGateway id="Gateway_StockCheck" name="Articoli Disponibili?">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_StockYes</bpmn:outgoing>
      <bpmn:outgoing>Flow_StockNo</bpmn:outgoing>
    </bpmn:exclusiveGateway>

    <bpmn:userTask id="Task_NotifyCustomerOutStock" name="Comunicazione Esaurimento Scorte" camunda:candidateGroups="sales_team">
      <bpmn:documentation>L'operatore di vendite invia una notifica email proponendo una data stimata di riassortimento o annullamento.</bpmn:documentation>
      <bpmn:incoming>Flow_StockNo</bpmn:incoming>
      <bpmn:incoming>Flow_PayNo</bpmn:incoming>
      <bpmn:outgoing>Flow_Cancel</bpmn:outgoing>
    </bpmn:userTask>

    <bpmn:endEvent id="End_OrderCancelled" name="Ordine Annullato">
      <bpmn:incoming>Flow_Cancel</bpmn:incoming>
    </bpmn:endEvent>

    <bpmn:serviceTask id="Task_ProcessPayment" name="Addebito Pagamento (Gateway Stripe)" camunda:topic="payment-gateway">
      <bpmn:documentation>Invocazione delle API di pagamento. Supporta carte di credito e bonifici bancari diretti.</bpmn:documentation>
      <bpmn:incoming>Flow_StockYes</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:serviceTask>

    <bpmn:exclusiveGateway id="Gateway_PaymentSuccess" name="Pagamento Approvato?">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_PayYes</bpmn:outgoing>
      <bpmn:outgoing>Flow_PayNo</bpmn:outgoing>
    </bpmn:exclusiveGateway>

    <bpmn:serviceTask id="Task_GenerateInvoice" name="Emissione Fattura Elettronica (SDI)" camunda:topic="invoicing-service">
      <bpmn:documentation>Creazione file XML per l'Agenzia delle Entrate e invio copia di cortesia in PDF al cliente via email.</bpmn:documentation>
      <bpmn:incoming>Flow_PayYes</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:serviceTask>

    <bpmn:userTask id="Task_PreparePackage" name="Imballaggio Merce in Magazzino" camunda:candidateGroups="warehouse">
      <bpmn:documentation>Il magazziniere stampa la lista di prelievo (picking list), preleva gli articoli e impacchetta la scatola con etichetta barcode.</bpmn:documentation>
      <bpmn:incoming>Flow_4</bpmn:incoming>
      <bpmn:outgoing>Flow_5</bpmn:outgoing>
    </bpmn:userTask>

    <bpmn:serviceTask id="Task_ShipOrder" name="Affidamento a Corriere Express (DHL/UPS)" camunda:topic="shipping-api">
      <bpmn:documentation>Chiamata alle API del corriere per prenotare il ritiro e generare il codice di tracciamento (Tracking ID).</bpmn:documentation>
      <bpmn:incoming>Flow_5</bpmn:incoming>
      <bpmn:outgoing>Flow_6</bpmn:outgoing>
    </bpmn:serviceTask>

    <bpmn:endEvent id="End_OrderCompleted" name="Ordine Spedito &amp; Completato">
      <bpmn:incoming>Flow_6</bpmn:incoming>
    </bpmn:endEvent>

    <!-- Sequence Flows -->
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_OrderReceived" targetRef="Task_CheckInventory" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_CheckInventory" targetRef="Gateway_StockCheck" />
    <bpmn:sequenceFlow id="Flow_StockYes" name="Sì (Disponibile)" sourceRef="Gateway_StockCheck" targetRef="Task_ProcessPayment" />
    <bpmn:sequenceFlow id="Flow_StockNo" name="No (Esaurito)" sourceRef="Gateway_StockCheck" targetRef="Task_NotifyCustomerOutStock" />
    <bpmn:sequenceFlow id="Flow_Cancel" sourceRef="Task_NotifyCustomerOutStock" targetRef="End_OrderCancelled" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_ProcessPayment" targetRef="Gateway_PaymentSuccess" />
    <bpmn:sequenceFlow id="Flow_PayYes" name="Sì (Autorizzato)" sourceRef="Gateway_PaymentSuccess" targetRef="Task_GenerateInvoice" />
    <bpmn:sequenceFlow id="Flow_PayNo" name="No (Rifiutato)" sourceRef="Gateway_PaymentSuccess" targetRef="Task_NotifyCustomerOutStock" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Task_GenerateInvoice" targetRef="Task_PreparePackage" />
    <bpmn:sequenceFlow id="Flow_5" sourceRef="Task_PreparePackage" targetRef="Task_ShipOrder" />
    <bpmn:sequenceFlow id="Flow_6" sourceRef="Task_ShipOrder" targetRef="End_OrderCompleted" />
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_Azienda_di" bpmnElement="Participant_Azienda" isHorizontal="true">
        <dc:Bounds x="120" y="80" width="1150" height="420" />
      </bpmndi:BPMNShape>

      <!-- Lanes -->
      <bpmndi:BPMNShape id="Lane_Vendite_di" bpmnElement="Lane_Vendite" isHorizontal="true">
        <dc:Bounds x="150" y="80" width="1120" height="140" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Amministrazione_di" bpmnElement="Lane_Amministrazione" isHorizontal="true">
        <dc:Bounds x="150" y="220" width="1120" height="140" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Logistica_di" bpmnElement="Lane_Logistica" isHorizontal="true">
        <dc:Bounds x="150" y="360" width="1120" height="140" />
      </bpmndi:BPMNShape>

      <!-- Nodes -->
      <bpmndi:BPMNShape id="Start_OrderReceived_di" bpmnElement="Start_OrderReceived">
        <dc:Bounds x="180" y="132" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_CheckInventory_di" bpmnElement="Task_CheckInventory">
        <dc:Bounds x="260" y="110" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_StockCheck_di" bpmnElement="Gateway_StockCheck" isMarkerVisible="true">
        <dc:Bounds x="400" y="125" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_NotifyCustomerOutStock_di" bpmnElement="Task_NotifyCustomerOutStock">
        <dc:Bounds x="500" y="110" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_OrderCancelled_di" bpmnElement="End_OrderCancelled">
        <dc:Bounds x="640" y="132" width="36" height="36" />
      </bpmndi:BPMNShape>

      <!-- Amministrazione -->
      <bpmndi:BPMNShape id="Task_ProcessPayment_di" bpmnElement="Task_ProcessPayment">
        <dc:Bounds x="400" y="250" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_PaymentSuccess_di" bpmnElement="Gateway_PaymentSuccess" isMarkerVisible="true">
        <dc:Bounds x="540" y="265" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_GenerateInvoice_di" bpmnElement="Task_GenerateInvoice">
        <dc:Bounds x="640" y="250" width="100" height="80" />
      </bpmndi:BPMNShape>

      <!-- Logistica -->
      <bpmndi:BPMNShape id="Task_PreparePackage_di" bpmnElement="Task_PreparePackage">
        <dc:Bounds x="780" y="390" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_ShipOrder_di" bpmnElement="Task_ShipOrder">
        <dc:Bounds x="920" y="390" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_OrderCompleted_di" bpmnElement="End_OrderCompleted">
        <dc:Bounds x="1060" y="412" width="36" height="36" />
      </bpmndi:BPMNShape>

      <!-- Edges -->
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="216" y="150" />
        <di:waypoint x="260" y="150" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="360" y="150" />
        <di:waypoint x="400" y="150" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_StockYes_di" bpmnElement="Flow_StockYes">
        <di:waypoint x="425" y="175" />
        <di:waypoint x="425" y="250" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_StockNo_di" bpmnElement="Flow_StockNo">
        <di:waypoint x="450" y="150" />
        <di:waypoint x="500" y="150" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Cancel_di" bpmnElement="Flow_Cancel">
        <di:waypoint x="600" y="150" />
        <di:waypoint x="640" y="150" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="500" y="290" />
        <di:waypoint x="540" y="290" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_PayYes_di" bpmnElement="Flow_PayYes">
        <di:waypoint x="590" y="290" />
        <di:waypoint x="640" y="290" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_PayNo_di" bpmnElement="Flow_PayNo">
        <di:waypoint x="565" y="265" />
        <di:waypoint x="565" y="190" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="740" y="290" />
        <di:waypoint x="760" y="290" />
        <di:waypoint x="760" y="430" />
        <di:waypoint x="780" y="430" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5">
        <di:waypoint x="880" y="430" />
        <di:waypoint x="920" y="430" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_6_di" bpmnElement="Flow_6">
        <di:waypoint x="1020" y="430" />
        <di:waypoint x="1060" y="430" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
  },
  {
    id: 'expense-approval',
    name: 'Approvazione Rimborso Spese Dipendenti',
    description: 'Flusso di lavoro interno per l\'inserimento nota spese, approvazione del Manager e bonifico amministrativo.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                  id="Definitions_Expense"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_ExpenseApproval" name="Richiesta Rimborso Spese" isExecutable="true">
    <bpmn:documentation>Procedura aziendale per il controllo delle ricevute e liquidazione delle spese sostenute durante trasferte.</bpmn:documentation>

    <bpmn:startEvent id="Start_ExpenseSubmitted" name="Nota Spese Inviata">
      <bpmn:documentation>Il dipendente carica le ricevute (scontrini, fatture hotel, biglietti treno) tramite il portale dipendenti.</bpmn:documentation>
      <bpmn:outgoing>Flow_E1</bpmn:outgoing>
    </bpmn:startEvent>

    <bpmn:userTask id="Task_ManagerReview" name="Revisione e Approvazione Manager" camunda:assignee="\${managerId}">
      <bpmn:documentation>Il responsabile diretto verifica la pertinenza aziendale delle spese e il rispetto dei tetti massimi fissati dalla policy.</bpmn:documentation>
      <bpmn:incoming>Flow_E1</bpmn:incoming>
      <bpmn:outgoing>Flow_E2</bpmn:outgoing>
    </bpmn:userTask>

    <bpmn:exclusiveGateway id="Gateway_Approved" name="Spese Approvate?">
      <bpmn:incoming>Flow_E2</bpmn:incoming>
      <bpmn:outgoing>Flow_ApproveYes</bpmn:outgoing>
      <bpmn:outgoing>Flow_ApproveNo</bpmn:outgoing>
    </bpmn:exclusiveGateway>

    <bpmn:userTask id="Task_RequestClarification" name="Richiesta Integrazione/Chiarimenti" camunda:assignee="\${employeeId}">
      <bpmn:documentation>Il dipendente viene invitato ad allegare giustificativi mancanti o correggere gli importi contestati.</bpmn:documentation>
      <bpmn:incoming>Flow_ApproveNo</bpmn:incoming>
      <bpmn:outgoing>Flow_Resubmit</bpmn:outgoing>
    </bpmn:userTask>

    <bpmn:serviceTask id="Task_FinancialAudit" name="Audit e Controlli Fiscali" camunda:topic="accounting-audit">
      <bpmn:documentation>Validazione dei codici IVA, centri di costo e conformità fiscale da parte dell'ufficio tesoreria.</bpmn:documentation>
      <bpmn:incoming>Flow_ApproveYes</bpmn:incoming>
      <bpmn:incoming>Flow_Resubmit</bpmn:incoming>
      <bpmn:outgoing>Flow_E3</bpmn:outgoing>
    </bpmn:serviceTask>

    <bpmn:serviceTask id="Task_BankTransfer" name="Esecuzione Bonifico SEPA" camunda:topic="bank-payout">
      <bpmn:documentation>Creazione automatica del flusso dispositivo bancario per l'accredito in conto corrente al dipendente.</bpmn:documentation>
      <bpmn:incoming>Flow_E3</bpmn:incoming>
      <bpmn:outgoing>Flow_E4</bpmn:outgoing>
    </bpmn:serviceTask>

    <bpmn:endEvent id="End_ExpensePaid" name="Rimborso Liquidato">
      <bpmn:incoming>Flow_E4</bpmn:incoming>
    </bpmn:endEvent>

    <bpmn:sequenceFlow id="Flow_E1" sourceRef="Start_ExpenseSubmitted" targetRef="Task_ManagerReview" />
    <bpmn:sequenceFlow id="Flow_E2" sourceRef="Task_ManagerReview" targetRef="Gateway_Approved" />
    <bpmn:sequenceFlow id="Flow_ApproveYes" name="Approvato" sourceRef="Gateway_Approved" targetRef="Task_FinancialAudit" />
    <bpmn:sequenceFlow id="Flow_ApproveNo" name="Respinto / Incompleto" sourceRef="Gateway_Approved" targetRef="Task_RequestClarification" />
    <bpmn:sequenceFlow id="Flow_Resubmit" sourceRef="Task_RequestClarification" targetRef="Task_FinancialAudit" />
    <bpmn:sequenceFlow id="Flow_E3" sourceRef="Task_FinancialAudit" targetRef="Task_BankTransfer" />
    <bpmn:sequenceFlow id="Flow_E4" sourceRef="Task_BankTransfer" targetRef="End_ExpensePaid" />
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_Expense">
    <bpmndi:BPMNPlane id="BPMNPlane_Expense" bpmnElement="Process_ExpenseApproval">
      <bpmndi:BPMNShape id="Start_ExpenseSubmitted_di" bpmnElement="Start_ExpenseSubmitted">
        <dc:Bounds x="160" y="142" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_ManagerReview_di" bpmnElement="Task_ManagerReview">
        <dc:Bounds x="240" y="120" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Approved_di" bpmnElement="Gateway_Approved" isMarkerVisible="true">
        <dc:Bounds x="380" y="135" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_RequestClarification_di" bpmnElement="Task_RequestClarification">
        <dc:Bounds x="355" y="240" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_FinancialAudit_di" bpmnElement="Task_FinancialAudit">
        <dc:Bounds x="500" y="120" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_BankTransfer_di" bpmnElement="Task_BankTransfer">
        <dc:Bounds x="640" y="120" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_ExpensePaid_di" bpmnElement="End_ExpensePaid">
        <dc:Bounds x="780" y="142" width="36" height="36" />
      </bpmndi:BPMNShape>

      <bpmndi:BPMNEdge id="Flow_E1_di" bpmnElement="Flow_E1">
        <di:waypoint x="196" y="160" />
        <di:waypoint x="240" y="160" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_E2_di" bpmnElement="Flow_E2">
        <di:waypoint x="340" y="160" />
        <di:waypoint x="380" y="160" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ApproveYes_di" bpmnElement="Flow_ApproveYes">
        <di:waypoint x="430" y="160" />
        <di:waypoint x="500" y="160" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ApproveNo_di" bpmnElement="Flow_ApproveNo">
        <di:waypoint x="405" y="185" />
        <di:waypoint x="405" y="240" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Resubmit_di" bpmnElement="Flow_Resubmit">
        <di:waypoint x="455" y="280" />
        <di:waypoint x="550" y="280" />
        <di:waypoint x="550" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_E3_di" bpmnElement="Flow_E3">
        <di:waypoint x="600" y="160" />
        <di:waypoint x="640" y="160" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_E4_di" bpmnElement="Flow_E4">
        <di:waypoint x="740" y="160" />
        <di:waypoint x="780" y="160" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
  },
  {
    id: 'customer-support',
    name: 'Gestione Ticket Assistenza & Escalation Ordini',
    description: 'Processo di supporto post-vendita che gestisce le segnalazioni dei clienti e invoca il sotto-processo di evasione sostitutiva.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                  id="Definitions_Support"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_CustomerSupport" name="Gestione Ticket e Restituzioni" isExecutable="true">
    <bpmn:documentation>Gestione dei reclami clienti, resi merce e reclami contabili con integrazione verso l'evasione ordini.</bpmn:documentation>

    <bpmn:laneSet id="LaneSet_Support">
      <bpmn:lane id="Lane_Vendite" name="Reparto Vendite &amp; Front-Office">
        <bpmn:flowNodeRef>Start_TicketCreated</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_TriageTicket</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_SupportType</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_ResolveStandardInfo</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_Amministrazione" name="Amministrazione &amp; Contabilità">
        <bpmn:flowNodeRef>CallActivity_ReorderFulfillment</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>End_SupportResolved</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>

    <bpmn:startEvent id="Start_TicketCreated" name="Ticket Assistenza Aperto">
      <bpmn:documentation>Il cliente invia una richiesta di assistenza o contestazione via helpdesk.</bpmn:documentation>
      <bpmn:outgoing>Flow_S1</bpmn:outgoing>
    </bpmn:startEvent>

    <bpmn:userTask id="Task_TriageTicket" name="Analisi e Triage della Segnalazione" camunda:candidateGroups="support_tier1">
      <bpmn:documentation>Operatore del helpdesk classifica l'urgenza e la tipologia del ticket.</bpmn:documentation>
      <bpmn:incoming>Flow_S1</bpmn:incoming>
      <bpmn:outgoing>Flow_S2</bpmn:outgoing>
    </bpmn:userTask>

    <bpmn:exclusiveGateway id="Gateway_SupportType" name="Necessaria Sostituzione Merce?">
      <bpmn:incoming>Flow_S2</bpmn:incoming>
      <bpmn:outgoing>Flow_ReorderYes</bpmn:outgoing>
      <bpmn:outgoing>Flow_InfoOnly</bpmn:outgoing>
    </bpmn:exclusiveGateway>

    <bpmn:userTask id="Task_ResolveStandardInfo" name="Risposta e Chiusura Informativa">
      <bpmn:documentation>L'operatore fornisce le informazioni richieste al cliente e chiude il ticket.</bpmn:documentation>
      <bpmn:incoming>Flow_InfoOnly</bpmn:incoming>
      <bpmn:outgoing>Flow_S3</bpmn:outgoing>
    </bpmn:userTask>

    <bpmn:callActivity id="CallActivity_ReorderFulfillment" name="Invocazione Processo Evasione Ordini e Fatturazione" calledElement="Process_OrderFulfillment">
      <bpmn:documentation>Call Activity BPMN 2.0: invoca il sottoprocesso di evasione per spedire l'articolo in sostituzione.</bpmn:documentation>
      <bpmn:incoming>Flow_ReorderYes</bpmn:incoming>
      <bpmn:outgoing>Flow_S4</bpmn:outgoing>
    </bpmn:callActivity>

    <bpmn:endEvent id="End_SupportResolved" name="Ticket Chiuso con Successo">
      <bpmn:incoming>Flow_S3</bpmn:incoming>
      <bpmn:incoming>Flow_S4</bpmn:incoming>
    </bpmn:endEvent>

    <bpmn:sequenceFlow id="Flow_S1" sourceRef="Start_TicketCreated" targetRef="Task_TriageTicket" />
    <bpmn:sequenceFlow id="Flow_S2" sourceRef="Task_TriageTicket" targetRef="Gateway_SupportType" />
    <bpmn:sequenceFlow id="Flow_ReorderYes" name="Sì (Sostituzione)" sourceRef="Gateway_SupportType" targetRef="CallActivity_ReorderFulfillment" />
    <bpmn:sequenceFlow id="Flow_InfoOnly" name="No (Solo Info)" sourceRef="Gateway_SupportType" targetRef="Task_ResolveStandardInfo" />
    <bpmn:sequenceFlow id="Flow_S3" sourceRef="Task_ResolveStandardInfo" targetRef="End_SupportResolved" />
    <bpmn:sequenceFlow id="Flow_S4" sourceRef="CallActivity_ReorderFulfillment" targetRef="End_SupportResolved" />
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_Support">
    <bpmndi:BPMNPlane id="BPMNPlane_Support" bpmnElement="Process_CustomerSupport">
      <bpmndi:BPMNShape id="Start_TicketCreated_di" bpmnElement="Start_TicketCreated">
        <dc:Bounds x="160" y="142" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_TriageTicket_di" bpmnElement="Task_TriageTicket">
        <dc:Bounds x="240" y="120" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_SupportType_di" bpmnElement="Gateway_SupportType" isMarkerVisible="true">
        <dc:Bounds x="380" y="135" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_ResolveStandardInfo_di" bpmnElement="Task_ResolveStandardInfo">
        <dc:Bounds x="480" y="120" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="CallActivity_ReorderFulfillment_di" bpmnElement="CallActivity_ReorderFulfillment">
        <dc:Bounds x="480" y="240" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_SupportResolved_di" bpmnElement="End_SupportResolved">
        <dc:Bounds x="640" y="182" width="36" height="36" />
      </bpmndi:BPMNShape>

      <bpmndi:BPMNEdge id="Flow_S1_di" bpmnElement="Flow_S1">
        <di:waypoint x="196" y="160" />
        <di:waypoint x="240" y="160" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_S2_di" bpmnElement="Flow_S2">
        <di:waypoint x="340" y="160" />
        <di:waypoint x="380" y="160" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ReorderYes_di" bpmnElement="Flow_ReorderYes">
        <di:waypoint x="405" y="185" />
        <di:waypoint x="405" y="280" />
        <di:waypoint x="480" y="280" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_InfoOnly_di" bpmnElement="Flow_InfoOnly">
        <di:waypoint x="430" y="160" />
        <di:waypoint x="480" y="160" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_S3_di" bpmnElement="Flow_S3">
        <di:waypoint x="580" y="160" />
        <di:waypoint x="640" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_S4_di" bpmnElement="Flow_S4">
        <di:waypoint x="580" y="280" />
        <di:waypoint x="640" y="200" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
  }
];
