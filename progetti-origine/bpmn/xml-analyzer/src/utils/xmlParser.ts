import {
  XMLNodeSummary,
  XMLValidationResult,
  XMLAnalysisStats,
  XMLTreeVisualNode,
  XMLAttributeSummary,
} from "../types";

/**
 * Validates XML string and returns details of any error
 */
export function validateXML(xmlString: string): XMLValidationResult {
  if (!xmlString || xmlString.trim() === "") {
    return { isValid: false, error: { message: "XML content is empty." } };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");
  const parserError = doc.querySelector("parsererror");

  if (parserError) {
    const errorText = parserError.textContent || "";
    // Try to extract line and column
    const lineMatch = errorText.match(/line\s+(\d+)/i) || errorText.match(/:(\d+):\d+/);
    const colMatch = errorText.match(/column\s+(\d+)/i) || errorText.match(/:\d+:(\d+)/);

    return {
      isValid: false,
      error: {
        line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
        column: colMatch ? parseInt(colMatch[1], 10) : undefined,
        message: errorText.replace(/Below is a rendering of the page.*/g, "").trim(),
      },
    };
  }

  return { isValid: true };
}

/**
 * Detect value data type
 */
function detectDataType(val: string): "string" | "number" | "boolean" | "date" | "empty" {
  if (!val || val.trim() === "") return "empty";
  const trimmed = val.trim();
  
  // Boolean check
  if (["true", "false", "yes", "no"].includes(trimmed.toLowerCase())) {
    return "boolean";
  }
  
  // Number check
  if (!isNaN(Number(trimmed)) && !trimmed.includes(" ")) {
    return "number";
  }
  
  // Date check
  const dateNum = Date.parse(trimmed);
  if (!isNaN(dateNum) && trimmed.length >= 8 && (trimmed.includes("-") || trimmed.includes("/") || trimmed.includes("T"))) {
    return "date";
  }
  
  return "string";
}

/**
 * Beautifies XML string
 */
export function formatXML(xmlString: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");
    
    // Check if valid first
    if (doc.querySelector("parsererror")) {
      return xmlString; // Return as-is if invalid
    }

    let result = "";
    let indent = "";
    const transition = {
      "element->element": 0,
      "element->text": 0,
      "text->element": 1,
      "text->text": 0,
    };

    const serializer = new XMLSerializer();
    const serialized = serializer.serializeToString(doc);
    const tokens = serialized.split(/(<\/?[^>]+>)/g);

    let depth = 0;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i].trim();
      if (!token) continue;

      if (token.startsWith("<?")) {
        result += token + "\n";
      } else if (token.startsWith("</")) {
        depth--;
        indent = "  ".repeat(depth);
        result = result.trimEnd();
        if (result.endsWith("\n") || result === "") {
          result += indent + token + "\n";
        } else {
          result += token + "\n";
        }
      } else if (token.startsWith("<") && token.endsWith("/>")) {
        indent = "  ".repeat(depth);
        result += indent + token + "\n";
      } else if (token.startsWith("<")) {
        indent = "  ".repeat(depth);
        result += indent + token + "\n";
        depth++;
      } else {
        // Text node
        result = result.trimEnd();
        result += token;
      }
    }
    return result.trim();
  } catch (e) {
    return xmlString;
  }
}

/**
 * Analyzes the XML document and returns:
 * - A flattened list of nodes with full metadata
 * - Statistics
 * - A visual tree structure
 */
export function analyzeXML(xmlString: string): {
  nodes: XMLNodeSummary[];
  stats: XMLAnalysisStats;
  visualTree: XMLTreeVisualNode | null;
} {
  const nodesMap: Map<string, XMLNodeSummary> = new Map();
  const elementCountsByDepth: Record<number, number> = {};
  const tagCounts: Record<string, number> = {};
  let totalAttributesCount = 0;
  let maxDepth = 0;
  let deepestPath = "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");
  const rootElement = doc.documentElement;

  if (!rootElement || doc.querySelector("parsererror")) {
    return { nodes: [], stats: { totalElements: 0, uniqueElements: 0, totalAttributes: 0, maxDepth: 0, deepestPath: "", elementCountsByDepth: {}, topTags: [] }, visualTree: null };
  }

  // Recursive parser to build tree and gather schemas
  function traverse(
    el: Element,
    parentPath: string,
    depth: number
  ): XMLTreeVisualNode {
    const tagName = el.tagName;
    const currentPath = parentPath === "" ? `/${tagName}` : `${parentPath}/${tagName}`;
    
    // Track depth statistics
    if (depth > maxDepth) {
      maxDepth = depth;
      deepestPath = currentPath;
    }
    elementCountsByDepth[depth] = (elementCountsByDepth[depth] || 0) + 1;
    tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;

    // Attributes
    const attrs: { name: string; value: string }[] = [];
    const attrSummaries: XMLAttributeSummary[] = [];
    
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      totalAttributesCount++;
      attrs.push({ name: attr.name, value: attr.value });
      attrSummaries.push({
        name: attr.name,
        valueSample: attr.value,
        count: 1,
        type: detectDataType(attr.value),
      });
    }

    // Children and text content
    const childrenNodes: XMLTreeVisualNode[] = [];
    const childrenPaths: string[] = [];
    let textVal = "";

    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i];
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childTree = traverse(child as Element, currentPath, depth + 1);
        childrenNodes.push(childTree);
        const childPath = `${currentPath}/${(child as Element).tagName}`;
        if (!childrenPaths.includes(childPath)) {
          childrenPaths.push(childPath);
        }
      } else if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) {
        textVal += child.nodeValue || "";
      }
    }

    textVal = textVal.trim();
    const hasChildren = childrenNodes.length > 0;
    const dataType = hasChildren
      ? "complex"
      : textVal === ""
      ? "empty"
      : detectDataType(textVal);

    // Update node schema entry in the map
    const existingNode = nodesMap.get(currentPath);
    if (!existingNode) {
      nodesMap.set(currentPath, {
        id: currentPath,
        name: tagName,
        path: currentPath,
        parentPath: parentPath,
        type: "element",
        dataType: dataType,
        depth: depth,
        occurrenceCount: 1,
        attributes: attrSummaries,
        childrenPaths: childrenPaths,
        sampleValues: textVal !== "" ? [textVal.substring(0, 100)] : [],
      });
    } else {
      existingNode.occurrenceCount++;
      // If it has children but sometimes is empty, keep type "complex"
      if (existingNode.dataType !== "complex" && dataType === "complex") {
        existingNode.dataType = "complex";
      }
      // Accumulate unique child paths
      childrenPaths.forEach((cp) => {
        if (!existingNode.childrenPaths.includes(cp)) {
          existingNode.childrenPaths.push(cp);
        }
      });
      // Accumulate attributes
      attrSummaries.forEach((as) => {
        const extAttr = existingNode.attributes.find((a) => a.name === as.name);
        if (!extAttr) {
          existingNode.attributes.push(as);
        } else {
          extAttr.count++;
        }
      });
      // Store value samples (limit to 3 unique samples)
      if (textVal !== "" && !existingNode.sampleValues.includes(textVal.substring(0, 100))) {
        if (existingNode.sampleValues.length < 3) {
          existingNode.sampleValues.push(textVal.substring(0, 100));
        }
      }
    }

    // Return visual node representation
    return {
      id: `${currentPath}-${Math.random().toString(36).substr(2, 9)}`,
      name: tagName,
      type: "element",
      dataType: hasChildren ? "complex" : dataType,
      path: currentPath,
      depth: depth,
      attributes: attrs,
      children: childrenNodes,
      value: textVal !== "" ? textVal : undefined,
      occurrenceCount: 1,
    };
  }

  // Run traversals starting from root
  const visualTree = traverse(rootElement, "", 1);

  // Mark optional elements
  // An element is likely optional if its parent occurs N times, but this child node occurs M times (M < N)
  nodesMap.forEach((node, path) => {
    if (node.parentPath) {
      const parentNode = nodesMap.get(node.parentPath);
      if (parentNode && node.occurrenceCount < parentNode.occurrenceCount) {
        node.isOptional = true;
      }
    }
  });

  const nodesList = Array.from(nodesMap.values()).sort((a, b) =>
    a.path.localeCompare(b.path)
  );

  const topTags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const totalElements = Object.values(tagCounts).reduce((acc, c) => acc + c, 0);

  const stats: XMLAnalysisStats = {
    totalElements,
    uniqueElements: nodesList.length,
    totalAttributes: totalAttributesCount,
    maxDepth,
    deepestPath,
    elementCountsByDepth,
    topTags,
  };

  return {
    nodes: nodesList,
    stats,
    visualTree,
  };
}

/**
 * Builds a simple ASCII structural tree string (fallback for MD file generation)
 */
export function buildSchemaSummaryText(nodes: XMLNodeSummary[]): string {
  let output = "";
  // Sort nodes by depth then path
  const sorted = [...nodes].sort((a, b) => a.path.localeCompare(b.path));
  
  sorted.forEach((n) => {
    const indent = "  ".repeat(n.depth - 1);
    const attrStr = n.attributes.length > 0 
      ? ` [Attrs: ${n.attributes.map(a => `@${a.name} (${a.type})`).join(", ")}]`
      : "";
    const sampleVal = n.sampleValues.length > 0 ? ` (Sample: "${n.sampleValues[0]}")` : "";
    const optionalStr = n.isOptional ? " [Optional]" : "";
    
    output += `${indent}├── ${n.name} [Type: ${n.dataType}]${attrStr}${optionalStr}${sampleVal} (Path: ${n.path}, Occurs: ${n.occurrenceCount}x)\n`;
  });
  
  return output;
}
