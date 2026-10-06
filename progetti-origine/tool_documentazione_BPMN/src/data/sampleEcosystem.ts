import { OracleEcosystem } from '../types/jca';
import { buildOracleEcosystem } from '../services/ecosystemParser';

/**
 * Agnostic synthetic sample — no reference to any real customer project.
 * Domain: fictional "Helios Financial — Personal Loan Approval".
 * Purpose: demonstrate composite → mediator → BPEL → BPMN → HumanTask → JCA (DB/JMS) → WSDL/XSD/XSLT chain.
 * All names, namespaces and paths are invented for demo/testing only.
 */
export function getSampleOracleEcosystem(): OracleEcosystem {
  const sampleFiles = [
    {
      name: 'composite.xml',
      relativePath: 'helios-loan/SOA/composite.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<composite name="LoanApprovalService" revision="1.0" mode="active" state="on"
           xmlns="http://xmlns.oracle.com/sca/1.0"
           xmlns:xs="http://www.w3.org/2001/XMLSchema"
           xmlns:ui="http://xmlns.oracle.com/soa/designer/"
           targetNamespace="http://acme.example.com/helios/loan">
  <import namespace="http://acme.example.com/helios/loan/service" location="WSDLs/LoanService.wsdl" importType="wsdl"/>
  <import namespace="http://acme.example.com/helios/adapter/db" location="Adapters/CreditDbAdapter.wsdl" importType="wsdl"/>
  <import namespace="http://acme.example.com/helios/adapter/jms" location="Adapters/NotificationJmsAdapter.wsdl" importType="wsdl"/>

  <!-- Inbound Service -->
  <service name="LoanService_ep" ui:wsdlLocation="WSDLs/LoanService.wsdl">
    <interface.wsdl interface="http://acme.example.com/helios/loan/service#wsdl.portType(LoanService_ptt)"/>
    <binding.ws port="http://acme.example.com/helios/loan/service#wsdl.endpoint(LoanService_ep/LoanService_pt)"/>
  </service>

  <!-- Components -->
  <component name="LoanValidationMediator">
    <implementation.mediator src="Mediators/LoanValidationMediator.mplan"/>
    <service name="LoanValidationMediator" ui:wsdlLocation="WSDLs/LoanService.wsdl">
      <interface.wsdl interface="http://acme.example.com/helios/loan/service#wsdl.portType(LoanService_ptt)"/>
    </service>
    <reference name="ProcessLoanBPEL.ProcessLoan" ui:wsdlLocation="WSDLs/ProcessLoan.wsdl">
      <interface.wsdl interface="http://acme.example.com/helios/loan/bpel#wsdl.portType(ProcessLoan_ptt)"/>
    </reference>
  </component>

  <component name="ProcessLoanBPEL">
    <implementation.bpel src="BPEL/ProcessLoanBPEL.bpel"/>
    <service name="ProcessLoanBPEL" ui:wsdlLocation="WSDLs/ProcessLoan.wsdl">
      <interface.wsdl interface="http://acme.example.com/helios/loan/bpel#wsdl.portType(ProcessLoan_ptt)"/>
    </service>
    <reference name="CreditDbAdapter" ui:wsdlLocation="Adapters/CreditDbAdapter.wsdl">
      <interface.wsdl interface="http://acme.example.com/helios/adapter/db#wsdl.portType(CreditDbAdapter_ptt)"/>
    </reference>
    <reference name="CreditApprovalTask" ui:wsdlLocation="WSDLs/CreditApprovalTask.wsdl">
      <interface.wsdl interface="http://xmlns.oracle.com/bpel/workflow/taskService#wsdl.portType(TaskService)"/>
    </reference>
  </component>

  <component name="CreditApprovalWorkflow">
    <implementation.workflow src="HumanTasks/CreditApprovalTask.task"/>
  </component>

  <component name="LoanFulfillmentBPMN">
    <implementation.bpmn src="BPMN/LoanFulfillment.bpmn"/>
  </component>

  <!-- Outbound References -->
  <reference name="CreditDbAdapter" ui:wsdlLocation="Adapters/CreditDbAdapter.wsdl">
    <interface.wsdl interface="http://acme.example.com/helios/adapter/db#wsdl.portType(CreditDbAdapter_ptt)"/>
    <binding.jca config="Adapters/CreditDbAdapter_db.jca"/>
  </reference>

  <reference name="NotificationJmsAdapter" ui:wsdlLocation="Adapters/NotificationJmsAdapter.wsdl">
    <interface.wsdl interface="http://acme.example.com/helios/adapter/jms#wsdl.portType(NotifyMessage_ptt)"/>
    <binding.jca config="Adapters/NotificationJmsAdapter_jms.jca"/>
  </reference>

  <!-- Wires -->
  <wire>
    <source.uri>LoanService_ep</source.uri>
    <target.uri>LoanValidationMediator/LoanValidationMediator</target.uri>
  </wire>
  <wire>
    <source.uri>LoanValidationMediator/ProcessLoanBPEL.ProcessLoan</source.uri>
    <target.uri>ProcessLoanBPEL/ProcessLoanBPEL</target.uri>
  </wire>
  <wire>
    <source.uri>ProcessLoanBPEL/CreditDbAdapter</source.uri>
    <target.uri>CreditDbAdapter</target.uri>
  </wire>
</composite>`,
    },
    {
      name: 'CreditDbAdapter_db.jca',
      relativePath: 'helios-loan/SOA/Adapters/CreditDbAdapter_db.jca',
      content: `<adapter-config name="CreditDbAdapter" adapter="db" wsdlLocation="CreditDbAdapter.wsdl" xmlns="http://platform.integration.oracle/blocks/adapter/fw/metadata">
  <connection-factory location="eis/DB/LoanDataSource" UIConnectionName="ACME_DB"/>
  <endpoint-interaction portType="CreditDbAdapter_ptt" operation="insertCreditRequest">
    <interaction-spec className="oracle.tip.adapter.db.DBWriteInteractionSpec">
      <property name="DescriptorName" value="CreditDbAdapter.CreditRequests"/>
      <property name="DmlType" value="insert"/>
      <property name="MappingsMetaDataURL" value="CreditDbAdapter-or-mappings.xml"/>
      <property name="GetActiveUnitOfWork" value="false"/>
    </interaction-spec>
  </endpoint-interaction>
  <endpoint-interaction portType="CreditDbAdapter_ptt" operation="selectPendingRequests">
    <interaction-spec className="oracle.tip.adapter.db.DBPureSQLInteractionSpec">
      <property name="SqlString" value="SELECT REQUEST_ID, CUSTOMER_ID, AMOUNT, STATUS, CREATED_AT FROM CREDIT_REQUESTS WHERE STATUS = #status AND CREATED_AT >= #minDate ORDER BY CREATED_AT DESC"/>
      <property name="GetActiveUnitOfWork" value="false"/>
    </interaction-spec>
  </endpoint-interaction>
</adapter-config>`,
    },
    {
      name: 'NotificationJmsAdapter_jms.jca',
      relativePath: 'helios-loan/SOA/Adapters/NotificationJmsAdapter_jms.jca',
      content: `<adapter-config name="NotificationJmsAdapter" adapter="jms" wsdlLocation="NotificationJmsAdapter.wsdl" xmlns="http://platform.integration.oracle/blocks/adapter/fw/metadata">
  <connection-factory location="eis/wls/Queue" UIConnectionName="ACME_JMS"/>
  <endpoint-interaction portType="NotifyMessage_ptt" operation="NotifyMessage">
    <interaction-spec className="oracle.tip.adapter.jms.JmsProduceInteractionSpec">
      <property name="DestinationName" value="jms/helios/LoanNotificationQueue"/>
      <property name="DeliveryMode" value="Persistent"/>
      <property name="TimeToLive" value="86400000"/>
      <property name="PayloadType" value="TextMessage"/>
    </interaction-spec>
  </endpoint-interaction>
</adapter-config>`,
    },
    {
      name: 'ProcessLoanBPEL.bpel',
      relativePath: 'helios-loan/SOA/BPEL/ProcessLoanBPEL.bpel',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<process name="ProcessLoanBPEL" targetNamespace="http://acme.example.com/helios/loan/bpel"
         xmlns="http://docs.oasis-open.org/wsbpel/2.0/process/executable"
         xmlns:client="http://acme.example.com/helios/loan/bpel"
         xmlns:db="http://acme.example.com/helios/adapter/db">
  <partnerLinks>
    <partnerLink name="ProcessLoanClient" partnerLinkType="client:ProcessLoan" myRole="ProcessLoanProvider"/>
    <partnerLink name="CreditDbAdapter" partnerLinkType="db:CreditDbAdapter_plt" partnerRole="CreditDbAdapter_role"/>
  </partnerLinks>
  <variables>
    <variable name="inputVariable" messageType="client:ProcessLoanRequestMessage"/>
    <variable name="outputVariable" messageType="client:ProcessLoanResponseMessage"/>
    <variable name="dbInsertInput" messageType="db:CreditRequestCollection"/>
  </variables>
  <sequence name="main">
    <receive name="receiveInput" partnerLink="ProcessLoanClient" portType="client:ProcessLoan_ptt" operation="process" variable="inputVariable" createInstance="yes"/>
    <invoke name="InvokeDbInsert" partnerLink="CreditDbAdapter" portType="db:CreditDbAdapter_ptt" operation="insertCreditRequest" inputVariable="dbInsertInput"/>
    <reply name="replyOutput" partnerLink="ProcessLoanClient" portType="client:ProcessLoan_ptt" operation="process" variable="outputVariable"/>
  </sequence>
</process>`,
    },
    {
      name: 'LoanFulfillment.bpmn',
      relativePath: 'helios-loan/SOA/BPMN/LoanFulfillment.bpmn',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="LoanFulfillmentProcess" name="Personal Loan Fulfillment" isExecutable="true">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_Risk" name="Risk &amp; Credit"/>
      <bpmn:lane id="Lane_Operations" name="Operations"/>
    </bpmn:laneSet>
    <bpmn:startEvent id="StartEvent_1" name="Application Received"/>
    <bpmn:userTask id="UserTask_AssessRisk" name="Assess Credit Risk"/>
    <bpmn:serviceTask id="ServiceTask_Score" name="Compute Credit Score"/>
    <bpmn:exclusiveGateway id="Gateway_Approval" name="Approved?"/>
    <bpmn:endEvent id="EndEvent_1" name="Loan Disbursed"/>
  </bpmn:process>
</bpmn:definitions>`,
    },
    {
      name: 'LoanValidationMediator.mplan',
      relativePath: 'helios-loan/SOA/Mediators/LoanValidationMediator.mplan',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Mediator name="LoanValidationMediator" xmlns="http://xmlns.oracle.com/sca/1.0/mediator">
  <operation name="submitApplication">
    <switch>
      <case name="RouteStandard" executionType="direct">
        <condition expression="$in.payload/loan/amount &lt; 50000"/>
        <action>
          <transform file="Transformations/LoanToBpelRequest.xsl"/>
          <invoke reference="ProcessLoanBPEL.ProcessLoan" operation="process"/>
        </action>
      </case>
      <case name="RouteHighValue" executionType="direct">
        <condition expression="$in.payload/loan/amount >= 50000"/>
        <action>
          <transform file="Transformations/LoanToApproval.xsl"/>
          <invoke reference="CreditApprovalWorkflow" operation="initiate"/>
        </action>
      </case>
    </switch>
  </operation>
</Mediator>`,
    },
    {
      name: 'CreditApprovalTask.task',
      relativePath: 'helios-loan/SOA/HumanTasks/CreditApprovalTask.task',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<taskDefinition name="CreditApprovalTask" xmlns="http://xmlns.oracle.com/bpel/workflow/taskDefinition">
  <title>High-Value Credit Approval</title>
  <priority>2</priority>
  <outcomes>
    <outcome>APPROVE</outcome>
    <outcome>REJECT</outcome>
    <outcome>REQUEST_INFO</outcome>
  </outcomes>
  <participants>
    <participant name="RiskCommittee"/>
    <participant name="BranchManager"/>
  </participants>
  <payload>
    <applicationId>string</applicationId>
    <amount>decimal</amount>
    <applicantName>string</applicantName>
  </payload>
</taskDefinition>`,
    },
    {
      name: 'LoanService.wsdl',
      relativePath: 'helios-loan/SOA/WSDLs/LoanService.wsdl',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<definitions name="LoanService" targetNamespace="http://acme.example.com/helios/loan/service"
             xmlns="http://schemas.xmlsoap.org/wsdl/"
             xmlns:tns="http://acme.example.com/helios/loan/service"
             xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <portType name="LoanService_ptt">
    <operation name="submitApplication">
      <input message="tns:SubmitApplicationRequestMessage"/>
      <output message="tns:SubmitApplicationResponseMessage"/>
      <fault name="ValidationFault" message="tns:ValidationFaultMessage"/>
    </operation>
    <operation name="getApplicationStatus">
      <input message="tns:GetStatusRequestMessage"/>
      <output message="tns:GetStatusResponseMessage"/>
    </operation>
  </portType>
</definitions>`,
    },
    {
      name: 'LoanSchema.xsd',
      relativePath: 'helios-loan/SOA/Schemas/LoanSchema.xsd',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://acme.example.com/helios/loan/schema" elementFormDefault="qualified">
  <xsd:element name="LoanApplication" type="LoanApplicationType"/>
  <xsd:element name="LoanDecision" type="LoanDecisionType"/>
  <xsd:complexType name="LoanApplicationType">
    <xsd:sequence>
      <xsd:element name="applicationId" type="xsd:string"/>
      <xsd:element name="customerId" type="xsd:string"/>
      <xsd:element name="requestDate" type="xsd:dateTime"/>
      <xsd:element name="amount" type="xsd:decimal"/>
    </xsd:sequence>
  </xsd:complexType>
  <xsd:complexType name="LoanDecisionType">
    <xsd:sequence>
      <xsd:element name="applicationId" type="xsd:string"/>
      <xsd:element name="decision" type="xsd:string"/>
      <xsd:element name="reference" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`,
    },
    {
      name: 'LoanToBpelRequest.xsl',
      relativePath: 'helios-loan/SOA/Transformations/LoanToBpelRequest.xsl',
      content: `<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:ns0="http://acme.example.com/helios/loan/schema" xmlns:tns="http://acme.example.com/helios/loan/bpel">
  <xsl:template match="/">
    <tns:ProcessLoanRequest>
      <tns:id><xsl:value-of select="/ns0:LoanApplication/ns0:applicationId"/></tns:id>
      <tns:customer><xsl:value-of select="/ns0:LoanApplication/ns0:customerId"/></tns:customer>
      <tns:amount><xsl:value-of select="/ns0:LoanApplication/ns0:amount"/></tns:amount>
    </tns:ProcessLoanRequest>
  </xsl:template>
</xsl:stylesheet>`,
    },
    {
      name: 'deploy_soa_composite.py',
      relativePath: 'helios-loan/scripts/deploy_soa_composite.py',
      content: `# WLST script for Helios SOA composite deployment (agnostic sample)
import sys

adminUrl = sys.argv[1]
username = sys.argv[2]
password = sys.argv[3]
sarPath = sys.argv[4]

print("Connecting to WebLogic at: " + adminUrl)
connect(username, password, adminUrl)

print("Deploying composite from SAR: " + sarPath)
sca_deployComposite(adminUrl, sarPath, overwrite=True, user=username, password=password)

print("Composite deployed.")
disconnect()
exit()`,
    },
    {
      name: 'build_and_package.sh',
      relativePath: 'helios-loan/scripts/build_and_package.sh',
      content: `#!/bin/bash
# Generic build & packaging for Helios SOA sample (agnostic)
set -e
echo "Starting build..."
export ORACLE_HOME=/opt/oracle/middleware
ant -f \${ORACLE_HOME}/soa/bin/ant-sca-package.xml -DcompositeDir=./SOA -DcompositeName=LoanApprovalService -Drevision=1.0
echo "SAR package created in ./dist/"`,
    },
    {
      name: 'DataBindings.cpx',
      relativePath: 'helios-loan/UI/adfmsrc/view/DataBindings.cpx',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Application xmlns="http://xmlns.oracle.com/adfm/application" version="12.2.1" id="DataBindings" SeparateXMLFiles="false" Package="view">
  <pageMap>
    <page path="/loanDashboard.jspx" usageId="view_loanDashboardPageDef"/>
  </pageMap>
  <dataControlUsages>
    <dc id="LoanServiceDC" path="model.LoanServiceDC"/>
  </dataControlUsages>
</Application>`,
    },
  ];

  return buildOracleEcosystem(sampleFiles);
}
