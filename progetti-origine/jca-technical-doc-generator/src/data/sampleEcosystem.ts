import { OracleEcosystem } from '../types/jca';
import { buildOracleEcosystem } from '../services/ecosystemParser';

export function getSampleOracleEcosystem(): OracleEcosystem {
  const sampleFiles = [
    {
      name: 'composite.xml',
      relativePath: 'demo-orders/SOA/composite.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<composite name="OrderProcessingService" revision="2.1" mode="active" state="on"
           xmlns="http://xmlns.oracle.com/sca/1.0"
           xmlns:xs="http://www.w3.org/2001/XMLSchema"
           xmlns:ui="http://xmlns.oracle.com/soa/designer/"
           targetNamespace="http://xmlns.oracle.com/demo_orders/OrderProcessingService">
  <import namespace="http://xmlns.oracle.com/demo_orders/OrderService" location="WSDLs/OrderService.wsdl" importType="wsdl"/>
  <import namespace="http://xmlns.oracle.com/demo_orders/OrderCanonical" location="oramds:/apps/XSD/OrderCanonical.xsd" importType="xsd"/>
  <import namespace="http://xmlns.oracle.com/pcbpel/adapter/db/OrderDbAdapter" location="Adapters/OrderDbAdapter.wsdl" importType="wsdl"/>
  <import namespace="http://xmlns.oracle.com/pcbpel/adapter/jms/OrderJmsAdapter" location="Adapters/OrderJmsAdapter.wsdl" importType="wsdl"/>
  
  <!-- Inbound Services -->
  <service name="OrderService_ep" ui:wsdlLocation="WSDLs/OrderService.wsdl">
    <interface.wsdl interface="http://xmlns.oracle.com/demo_orders/OrderService#wsdl.portType(OrderService_ptt)"/>
    <binding.ws port="http://xmlns.oracle.com/demo_orders/OrderService#wsdl.endpoint(OrderService_ep/OrderService_pt)">
      <policy uri="oracle/wss_username_token_service_policy"/>
    </binding.ws>
  </service>

  <!-- Components -->
  <component name="OrderRouterMediator">
    <implementation.mediator src="Mediators/OrderRouterMediator.mplan"/>
    <service name="OrderRouterMediator" ui:wsdlLocation="WSDLs/OrderService.wsdl">
      <interface.wsdl interface="http://xmlns.oracle.com/demo_orders/OrderService#wsdl.portType(OrderService_ptt)"/>
    </service>
    <reference name="ProcessOrderBPEL.ProcessOrderBPEL" ui:wsdlLocation="WSDLs/ProcessOrder.wsdl">
      <interface.wsdl interface="http://xmlns.oracle.com/demo_orders/ProcessOrder#wsdl.portType(ProcessOrder_ptt)"/>
    </reference>
  </component>

  <component name="ProcessOrderBPEL">
    <implementation.bpel src="BPEL/ProcessOrderBPEL.bpel"/>
    <service name="ProcessOrderBPEL" ui:wsdlLocation="WSDLs/ProcessOrder.wsdl">
      <interface.wsdl interface="http://xmlns.oracle.com/demo_orders/ProcessOrder#wsdl.portType(ProcessOrder_ptt)"/>
    </service>
    <reference name="OrderDbAdapter" ui:wsdlLocation="Adapters/OrderDbAdapter.wsdl">
      <interface.wsdl interface="http://xmlns.oracle.com/pcbpel/adapter/db/OrderDbAdapter#wsdl.portType(OrderDbAdapter_ptt)"/>
    </reference>
    <reference name="OrderApprovalTask" ui:wsdlLocation="WSDLs/OrderApprovalTask.wsdl">
      <interface.wsdl interface="http://xmlns.oracle.com/bpel/workflow/taskService#wsdl.portType(TaskService)"/>
    </reference>
  </component>

  <component name="OrderApprovalWorkflow">
    <implementation.workflow src="HumanTasks/OrderApprovalTask.task"/>
  </component>

  <component name="OrderFulfillmentBPMN">
    <implementation.bpmn src="BPMN/OrderFulfillment.bpmn"/>
  </component>

  <!-- Outbound References -->
  <reference name="OrderDbAdapter" ui:wsdlLocation="Adapters/OrderDbAdapter.wsdl">
    <interface.wsdl interface="http://xmlns.oracle.com/pcbpel/adapter/db/OrderDbAdapter#wsdl.portType(OrderDbAdapter_ptt)"/>
    <binding.jca config="Adapters/OrderDbAdapter_db.jca"/>
  </reference>

  <reference name="OrderJmsAdapter" ui:wsdlLocation="Adapters/OrderJmsAdapter.wsdl">
    <interface.wsdl interface="http://xmlns.oracle.com/pcbpel/adapter/jms/OrderJmsAdapter#wsdl.portType(Produce_Message_ptt)"/>
    <binding.jca config="Adapters/OrderJmsAdapter_jms.jca"/>
  </reference>

  <!-- Wires -->
  <wire>
    <source.uri>OrderService_ep</source.uri>
    <target.uri>OrderRouterMediator/OrderRouterMediator</target.uri>
  </wire>
  <wire>
    <source.uri>OrderRouterMediator/ProcessOrderBPEL.ProcessOrderBPEL</source.uri>
    <target.uri>ProcessOrderBPEL/ProcessOrderBPEL</target.uri>
  </wire>
  <wire>
    <source.uri>ProcessOrderBPEL/OrderDbAdapter</source.uri>
    <target.uri>OrderDbAdapter</target.uri>
  </wire>
</composite>`,
    },
    {
      name: 'OrderDbAdapter_db.jca',
      relativePath: 'demo-orders/SOA/Adapters/OrderDbAdapter_db.jca',
      content: `<adapter-config name="OrderDbAdapter" adapter="db" wsdlLocation="OrderDbAdapter.wsdl" xmlns="http://platform.integration.oracle/blocks/adapter/fw/metadata">
  <connection-factory location="eis/DB/SOADataSource" UIConnectionName="DEV_ORCL_DB"/>
  <endpoint-interaction portType="OrderDbAdapter_ptt" operation="insertOrder">
    <interaction-spec className="oracle.tip.adapter.db.DBWriteInteractionSpec">
      <property name="DescriptorName" value="OrderDbAdapter.Orders"/>
      <property name="DmlType" value="insert"/>
      <property name="MappingsMetaDataURL" value="OrderDbAdapter-or-mappings.xml"/>
      <property name="GetActiveUnitOfWork" value="false"/>
      <property name="OptimizeMerge" value="true"/>
      <property name="DetectOmissions" value="true"/>
      <property name="UseBatchWriting" value="true"/>
    </interaction-spec>
  </endpoint-interaction>
  <endpoint-interaction portType="OrderDbAdapter_ptt" operation="selectPendingOrders">
    <interaction-spec className="oracle.tip.adapter.db.DBPureSQLInteractionSpec">
      <property name="SqlString" value="SELECT ORDER_ID, CUSTOMER_ID, TOTAL_AMOUNT, ORDER_STATUS, CREATION_DATE FROM ORDERS WHERE ORDER_STATUS = #status AND CREATION_DATE >= #minDate ORDER BY CREATION_DATE DESC"/>
      <property name="GetActiveUnitOfWork" value="false"/>
    </interaction-spec>
  </endpoint-interaction>
</adapter-config>`,
    },
    {
      name: 'OrderJmsAdapter_jms.jca',
      relativePath: 'demo-orders/SOA/Adapters/OrderJmsAdapter_jms.jca',
      content: `<adapter-config name="OrderJmsAdapter" adapter="jms" wsdlLocation="OrderJmsAdapter.wsdl" xmlns="http://platform.integration.oracle/blocks/adapter/fw/metadata">
  <connection-factory location="eis/wls/Queue" UIConnectionName="WLS_JMS_LOCAL"/>
  <endpoint-interaction portType="Produce_Message_ptt" operation="Produce_Message">
    <interaction-spec className="oracle.tip.adapter.jms.JmsProduceInteractionSpec">
      <property name="DestinationName" value="jms/orders/OrderProcessingQueue"/>
      <property name="DeliveryMode" value="Persistent"/>
      <property name="TimeToLive" value="86400000"/>
      <property name="PayloadType" value="TextMessage"/>
    </interaction-spec>
  </endpoint-interaction>
</adapter-config>`,
    },
    {
      name: 'ProcessOrderBPEL.bpel',
      relativePath: 'demo-orders/SOA/BPEL/ProcessOrderBPEL.bpel',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<process name="ProcessOrderBPEL" targetNamespace="http://xmlns.oracle.com/demo_orders/ProcessOrder"
         xmlns="http://docs.oasis-open.org/wsbpel/2.0/process/executable"
         xmlns:client="http://xmlns.oracle.com/demo_orders/ProcessOrder"
         xmlns:db="http://xmlns.oracle.com/pcbpel/adapter/db/OrderDbAdapter">
  <partnerLinks>
    <partnerLink name="ProcessOrderClient" partnerLinkType="client:ProcessOrder" myRole="ProcessOrderProvider"/>
    <partnerLink name="OrderDbAdapter" partnerLinkType="db:OrderDbAdapter_plt" partnerRole="OrderDbAdapter_role"/>
  </partnerLinks>
  <variables>
    <variable name="inputVariable" messageType="client:ProcessOrderRequestMessage"/>
    <variable name="outputVariable" messageType="client:ProcessOrderResponseMessage"/>
    <variable name="dbInsertInput" messageType="db:OrdersCollection"/>
  </variables>
  <sequence name="main">
    <receive name="receiveInput" partnerLink="ProcessOrderClient" portType="client:ProcessOrder_ptt" operation="process" variable="inputVariable" createInstance="yes"/>
    <assign name="InitVars">
      <copy>
        <from expression="string($inputVariable.payload/client:orderId)"/>
        <to variable="dbInsertInput" part="orderId"/>
      </copy>
    </assign>
    <invoke name="InvokeDbInsert" partnerLink="OrderDbAdapter" portType="db:OrderDbAdapter_ptt" operation="insertOrder" inputVariable="dbInsertInput"/>
    <if name="HighValueCheck">
      <condition>$outputVariable.payload/total &gt; 50000</condition>
      <invoke name="InvokeApproval" partnerLink="OrderApprovalTask" operation="initiate"/>
    </if>
    <reply name="replyOutput" partnerLink="ProcessOrderClient" portType="client:ProcessOrder_ptt" operation="process" variable="outputVariable"/>
  </sequence>
</process>`,
    },
    {
      name: 'OrderFulfillment.bpmn',
      relativePath: 'demo-orders/SOA/BPMN/OrderFulfillment.bpmn',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="OrderFulfillmentProcess" name="Gestione Evasione Ordine" isExecutable="true">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_Logistics" name="Logistica &amp; Magazzino"/>
      <bpmn:lane id="Lane_Finance" name="Amministrazione &amp; Controllo"/>
    </bpmn:laneSet>
    <bpmn:startEvent id="StartEvent_1" name="Ordine Ricevuto"/>
    <bpmn:userTask id="UserTask_VerifyStock" name="Verifica Disponibilità Magazzino"/>
    <bpmn:serviceTask id="ServiceTask_UpdateERP" name="Aggiornamento ERP SAP"/>
    <bpmn:exclusiveGateway id="Gateway_StockCheck" name="Disponibile?"/>
    <bpmn:endEvent id="EndEvent_1" name="Ordine Evaso"/>
  </bpmn:process>
</bpmn:definitions>`,
    },
    {
      name: 'OrderRouterMediator.mplan',
      relativePath: 'demo-orders/SOA/Mediators/OrderRouterMediator.mplan',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Mediator name="OrderRouterMediator" xmlns="http://xmlns.oracle.com/sca/1.0/mediator">
  <operation name="submitOrder">
    <switch>
      <case name="RouteToStandardOrder" executionType="direct">
        <condition expression="$in.payload/order/amount &lt; 50000"/>
        <action>
          <transform file="Transformations/OrderToBpelRequest.xsl"/>
          <invoke reference="ProcessOrderBPEL.ProcessOrderBPEL" operation="process"/>
        </action>
      </case>
      <case name="RouteToHighValueOrder" executionType="direct">
        <condition expression="$in.payload/order/amount >= 50000"/>
        <action>
          <transform file="Transformations/OrderToApprovalTask.xsl"/>
          <invoke reference="OrderApprovalWorkflow" operation="initiate"/>
        </action>
      </case>
    </switch>
  </operation>
</Mediator>`,
    },
    {
      name: 'OrderApprovalTask.task',
      relativePath: 'demo-orders/SOA/HumanTasks/OrderApprovalTask.task',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<taskDefinition name="OrderApprovalTask" xmlns="http://xmlns.oracle.com/bpel/workflow/taskDefinition">
  <title>Approvazione Ordine di Importo Elevato</title>
  <priority>2</priority>
  <outcomes>
    <outcome>APPROVE</outcome>
    <outcome>REJECT</outcome>
    <outcome>REQUEST_INFO</outcome>
  </outcomes>
  <participants>
    <participant name="DirezioneVendite"/>
    <participant name="ResponsabileFinanziario"/>
  </participants>
  <payload>
    <orderId>string</orderId>
    <totalAmount>decimal</totalAmount>
    <customerName>string</customerName>
  </payload>
</taskDefinition>`,
    },
    {
      name: 'OrderService.wsdl',
      relativePath: 'demo-orders/SOA/WSDLs/OrderService.wsdl',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<definitions name="OrderService" targetNamespace="http://xmlns.oracle.com/demo_orders/OrderService"
             xmlns="http://schemas.xmlsoap.org/wsdl/"
             xmlns:tns="http://xmlns.oracle.com/demo_orders/OrderService"
             xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <portType name="OrderService_ptt">
    <operation name="submitOrder">
      <input message="tns:SubmitOrderRequestMessage"/>
      <output message="tns:SubmitOrderResponseMessage"/>
      <fault name="OrderValidationFault" message="tns:OrderValidationFaultMessage"/>
    </operation>
    <operation name="getOrderStatus">
      <input message="tns:GetOrderStatusRequestMessage"/>
      <output message="tns:GetOrderStatusResponseMessage"/>
    </operation>
  </portType>
</definitions>`,
    },
    {
      name: 'OrderSchema.xsd',
      relativePath: 'demo-orders/SOA/Schemas/OrderSchema.xsd',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://xmlns.oracle.com/demo_orders/OrderSchema" elementFormDefault="qualified">
  <xsd:element name="OrderRequest" type="OrderRequestType"/>
  <xsd:element name="OrderResponse" type="OrderResponseType"/>
  <xsd:complexType name="OrderRequestType">
    <xsd:sequence>
      <xsd:element name="orderId" type="xsd:string"/>
      <xsd:element name="customerId" type="xsd:string"/>
      <xsd:element name="orderDate" type="xsd:dateTime"/>
      <xsd:element name="totalAmount" type="xsd:decimal"/>
    </xsd:sequence>
  </xsd:complexType>
  <xsd:complexType name="OrderResponseType">
    <xsd:sequence>
      <xsd:element name="orderId" type="xsd:string"/>
      <xsd:element name="status" type="xsd:string"/>
      <xsd:element name="trackingNumber" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`,
    },
    {
      name: 'OrderToBpelRequest.xsl',
      relativePath: 'demo-orders/SOA/Transformations/OrderToBpelRequest.xsl',
      content: `<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:ns0="http://xmlns.oracle.com/demo_orders/OrderSchema" xmlns:tns="http://xmlns.oracle.com/demo_orders/ProcessOrder">
  <xsl:template match="/">
    <tns:ProcessOrderRequest>
      <tns:id><xsl:value-of select="/ns0:OrderRequest/ns0:orderId"/></tns:id>
      <tns:client><xsl:value-of select="/ns0:OrderRequest/ns0:customerId"/></tns:client>
      <tns:amount><xsl:value-of select="/ns0:OrderRequest/ns0:totalAmount"/></tns:amount>
    </tns:ProcessOrderRequest>
  </xsl:template>
</xsl:stylesheet>`,
    },
    {
      name: 'deploy_soa_composite.py',
      relativePath: 'demo-orders/scripts/deploy_soa_composite.py',
      content: `# WLST Script per il Deploy del Composito SOA su WebLogic Server
import sys

adminUrl = sys.argv[1]
username = sys.argv[2]
password = sys.argv[3]
sarPath = sys.argv[4]

print "Connecting to WebLogic AdminServer at: " + adminUrl
connect(username, password, adminUrl)

print "Deploying SOA Composite from SAR: " + sarPath
sca_deployComposite(adminUrl, sarPath, overwrite=true, user=username, password=password)

print "Composite successfully deployed and activated."
disconnect()
exit()`,
    },
    {
      name: 'build_and_package.sh',
      relativePath: 'demo-orders/scripts/build_and_package.sh',
      content: `#!/bin/bash
# Script di build Ant & SAR packaging per Oracle SOA Suite
set -e
echo "Starting Oracle SOA Suite Compilation..."
export ORACLE_HOME=/opt/oracle/middleware
ant -f \${ORACLE_HOME}/soa/bin/ant-sca-package.xml -DcompositeDir=./SOA -DcompositeName=OrderProcessingService -Drevision=2.1
echo "SAR package created successfully in ./dist/sca_OrderProcessingService_rev2.1.jar"`,
    },
    {
      name: 'DataBindings.cpx',
      relativePath: 'demo-orders/UI/adfmsrc/view/DataBindings.cpx',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Application xmlns="http://xmlns.oracle.com/adfm/application" version="12.2.1" id="DataBindings" SeparateXMLFiles="false" Package="view">
  <pageMap>
    <page path="/ordersDashboard.jspx" usageId="view_ordersDashboardPageDef"/>
  </pageMap>
  <dataControlUsages>
    <dc id="OrderServiceDC" path="model.OrderServiceDC"/>
  </dataControlUsages>
</Application>`,
    },
    {
      name: 'DemoOrders.jws',
      relativePath: 'demo-orders/DemoOrders.jws',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<application n="DemoOrders" xmlns="http://xmlns.oracle.com/jdeveloper/1013/application">
  <workspace n="DemoOrders" url="DemoOrders.jws"/>
  <list n="listOfProjects">
    <hash>
      <value n="projectName" v="OrderProcessing"/>
      <value n="URL" v="SOA/OrderProcessing.jpr"/>
    </hash>
    <hash>
      <value n="projectName" v="OrderOSB"/>
      <value n="URL" v="OSB/OrderOSB.jpr"/>
    </hash>
  </list>
</application>`,
    },
    {
      name: 'OrderProcessing.jpr',
      relativePath: 'demo-orders/SOA/OrderProcessing.jpr',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<jpr:project n="OrderProcessing" xmlns:jpr="http://xmlns.oracle.com/jdeveloper/project">
  <list n="technologyScope">
    <value v="SOA"/>
    <value v="Java"/>
  </list>
  <hash n="classPath">
    <value n="url" v="../../lib/soa-runtime.jar"/>
    <value n="url" v="../../lib/oracle.soa.adapter.jar"/>
  </hash>
  <hash n="deploymentProfiles">
    <profile n="OrderProcessing_SAR" name="SAR"/>
  </hash>
</jpr:project>`,
    },
    {
      name: 'OrderProcessing_ConfigPlan_PROD.xml',
      relativePath: 'demo-orders/SOA/OrderProcessing_ConfigPlan_PROD.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<SOAConfigPlan xmlns="http://xmlns.oracle.com/soa/configplan">
  <composite name="OrderProcessingService">
    <service name="OrderService_ep">
      <binding type="ws">
        <attribute name="location">
          <searchReplace>
            <search>http://dev-host:8001/soa-infra/services/default/OrderProcessingService/OrderService_ep</search>
            <replace>http://prod-host:8001/soa-infra/services/default/OrderProcessingService/OrderService_ep</replace>
          </searchReplace>
        </attribute>
      </binding>
    </service>
    <reference name="OrderDbAdapter">
      <binding type="jca">
        <attribute name="location">
          <searchReplace>
            <search>eis/DB/SOADataSourceDEV</search>
            <replace>eis/DB/SOADataSourcePROD</replace>
          </searchReplace>
        </attribute>
      </binding>
    </reference>
  </composite>
</SOAConfigPlan>`,
    },
    {
      name: 'OrderEvents.edn',
      relativePath: 'demo-orders/SOA/EDN/OrderEvents.edn',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<EDN xmlns="http://xmlns.oracle.com/soa/edn">
  <event-definition name="OrderCreatedEvent" namespace="http://xmlns.oracle.com/demo_orders/events">
    <content>
      <businessEvent name="OrderCreatedEvent"/>
    </content>
  </event-definition>
  <subscription name="OrderAuditSubscriber" event="OrderCreatedEvent">
    <subscriber name="AuditComposite"/>
  </subscription>
</EDN>`,
    },
    {
      name: 'CustomerXref.xref',
      relativePath: 'demo-orders/SOA/XREF/CustomerXref.xref',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<xrefTable name="CustomerXref" tableName="XREF_CUSTOMER" xmlns="http://xmlns.oracle.com/soa/xref">
  <columns>
    <column name="ECOM_ID"/>
    <column name="ERP_ID"/>
    <column name="MDM_ID"/>
  </columns>
</xrefTable>`,
    },
    {
      name: 'fault-policies.xml',
      relativePath: 'demo-orders/SOA/fault-policies.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<faultPolicies xmlns="http://schemas.oracle.com/bpel/faultpolicy">
  <faultPolicy id="OrderRetryPolicy">
    <Conditions>
      <faultName name="remoteFault">
        <condition>
          <action ref="ora-retry"/>
        </condition>
      </faultName>
    </Conditions>
    <Actions>
      <Action id="ora-retry">
        <retry>
          <retryCount>3</retryCount>
        </retry>
      </Action>
    </Actions>
  </faultPolicy>
</faultPolicies>`,
    },
    {
      name: 'fault-bindings.xml',
      relativePath: 'demo-orders/SOA/fault-bindings.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<faultPolicyBindings xmlns="http://schemas.oracle.com/bpel/faultpolicy" version="2.0">
  <composite faultPolicy="OrderRetryPolicy"/>
  <component name="ProcessOrderBPEL" faultPolicy="OrderRetryPolicy"/>
</faultPolicyBindings>`,
    },
    {
      name: 'OrderRules.rules',
      relativePath: 'demo-orders/SOA/Rules/OrderRules.rules',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<RuleDictionary name="OrderRules" xmlns="http://xmlns.oracle.com/rules">
  <rulesetList>
    <Ruleset name="DiscountRuleset"/>
  </rulesetList>
  <decisionFunction name="ComputeDiscount"/>
</RuleDictionary>`,
    },
    {
      name: 'OrderProxy.proxy',
      relativePath: 'demo-orders/OSB/OrderProxy.proxy',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<proxy-service name="OrderProxy" type="SOAP" xmlns="http://www.bea.com/wli/sb/services">
  <endpointURI>/osb/orders/submit</endpointURI>
  <wsdl ref="WSDLs/OrderService.wsdl"/>
</proxy-service>`,
    },
  ];

  return buildOracleEcosystem(sampleFiles);
}
