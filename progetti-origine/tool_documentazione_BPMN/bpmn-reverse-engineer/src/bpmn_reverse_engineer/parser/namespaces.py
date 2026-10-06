"""Namespace-robust helpers for BPMN XML parsing."""

BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL"
BPMNDI_NS = "http://www.omg.org/spec/BPMN/20100524/DI"
DC_NS = "http://www.omg.org/spec/DD/20100524/DC"
DI_NS = "http://www.omg.org/spec/DD/20100524/DI"

KNOWN_BPMN_NAMESPACES = {
    BPMN_NS,
    "http://www.omg.org/spec/BPMN/20100524/MODEL",
}

# Known element local names by category (for metrics/classification)
EVENT_TYPES = {
    "startEvent",
    "endEvent",
    "intermediateCatchEvent",
    "intermediateThrowEvent",
    "boundaryEvent",
}

EVENT_DEFINITIONS = {
    "timerEventDefinition",
    "messageEventDefinition",
    "errorEventDefinition",
    "signalEventDefinition",
    "escalationEventDefinition",
    "conditionalEventDefinition",
    "terminateEventDefinition",
    "linkEventDefinition",
    "compensateEventDefinition",
    "cancelEventDefinition",
}

ACTIVITY_TYPES = {
    "task",
    "serviceTask",
    "userTask",
    "manualTask",
    "scriptTask",
    "sendTask",
    "receiveTask",
    "businessRuleTask",
    "callActivity",
    "subProcess",
    "adHocSubProcess",
    "transaction",
}

GATEWAY_TYPES = {
    "exclusiveGateway",
    "inclusiveGateway",
    "parallelGateway",
    "eventBasedGateway",
    "complexGateway",
}

# All known BPMN element local names that should NOT be treated as unknown
KNOWN_ELEMENTS = (
    EVENT_TYPES
    | EVENT_DEFINITIONS
    | ACTIVITY_TYPES
    | GATEWAY_TYPES
    | {
        "process",
        "collaboration",
        "participant",
        "laneSet",
        "lane",
        "sequenceFlow",
        "messageFlow",
        "association",
        "dataObject",
        "dataObjectReference",
        "dataStore",
        "dataStoreReference",
        "dataInput",
        "dataOutput",
        "message",
        "definitions",
        "documentation",
        "extensionElements",
        "incoming",
        "outgoing",
        "conditionExpression",
        "default",
        "ioSpecification",
        "property",
        "laneSet",
    }
)


def local_name(tag) -> str:
    """Extract local name from Clark notation or prefixed tag."""
    if not isinstance(tag, str):
        return ""
    if tag.startswith("{"):
        return tag.split("}", 1)[1]
    if ":" in tag:
        return tag.split(":", 1)[1]
    return tag


def namespace_uri(tag) -> str | None:
    if not isinstance(tag, str):
        return None
    if tag.startswith("{"):
        return tag[1:].split("}", 1)[0]
    return None


def is_bpmn_namespace(uri: str | None) -> bool:
    if uri is None:
        return False
    return uri == BPMN_NS or "BPMN" in uri


def split_qname(value: str) -> tuple[str | None, str]:
    """Split a QName string into (prefix/namespace, local). Returns (None, local) if no prefix."""
    if ":" in value:
        prefix, local = value.split(":", 1)
        return prefix, local
    return None, value
