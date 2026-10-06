import {
  XMLNodeSummary,
  XMLAnalysisStats,
  XMLAttributeSummary,
} from "../types";

function escapeMd(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function formatAttributeList(attrs: XMLAttributeSummary[]): string {
  if (!attrs || attrs.length === 0) return "—";
  return attrs
    .map((a) => `\`@${a.name}\` (${a.type})`)
    .join(", ");
}

function buildTreeLines(nodes: XMLNodeSummary[]): string[] {
  const sorted = [...nodes].sort((a, b) => a.path.localeCompare(b.path));
  const lines: string[] = [];

  sorted.forEach((n, idx) => {
    const isLast = idx === sorted.length - 1;
    const prefix = n.depth === 1 ? "" : `${"  ".repeat(n.depth - 1)}${isLast ? "└── " : "├── "}`;
    const attrStr =
      n.attributes.length > 0
        ? ` [${n.attributes.map((a) => `@${a.name}`).join(", ")}]`
        : "";
    const sample =
      n.sampleValues.length > 0 ? ` — es. "${n.sampleValues[0].substring(0, 60)}"` : "";
    const optional = n.isOptional ? " *(opzionale)*" : "";
    lines.push(`${prefix}${n.name}${attrStr}${sample}${optional}`);
  });

  return lines;
}

/**
 * Generates a complete Markdown documentation (rule-based, no AI) for a
 * parsed XML document, starting from the analysis results.
 */
export function generateXmlReport(
  sourceName: string,
  nodes: XMLNodeSummary[],
  stats: XMLAnalysisStats,
  options?: { language?: "it" | "en"; originalXml?: string }
): string {
  const lang = options?.language ?? "it";
  const isIt = lang === "it";

  const title = isIt
    ? `# Documentazione Tecnica XML — ${sourceName}`
    : `# XML Technical Documentation — ${sourceName}`;
  const generated = `${isIt ? "Generato il" : "Generated on"}: ${new Date().toLocaleString()}`;

  const headerIntro = isIt
    ? "Questo documento descrive la struttura, la gerarchia e i vincoli dello schema XML analizzato."
    : "This document describes the structure, hierarchy and constraints of the analyzed XML schema.";

  const typeLabel = (t: string) =>
    isIt
      ? { string: "stringa", number: "numero", boolean: "booleano", date: "data", complex: "complesso", empty: "vuoto" }[t] || t
      : t;

  // Stats summary block
  const statsSection = [
    `### ${isIt ? "Statistiche" : "Statistics"}`,
    "",
    `| ${isIt ? "Metrica" : "Metric"} | ${isIt ? "Valore" : "Value"} |`,
    "| :--- | ---: |",
    `| ${isIt ? "Elementi totali" : "Total elements"} | ${stats.totalElements} |`,
    `| ${isIt ? "Percorsi unici" : "Unique paths"} | ${stats.uniqueElements} |`,
    `| ${isIt ? "Attributi totali" : "Total attributes"} | ${stats.totalAttributes} |`,
    `| ${isIt ? "Profondità massima" : "Max depth"} | ${stats.maxDepth} |`,
    `| ${isIt ? "Percorso più profondo" : "Deepest path"} | \`${escapeMd(stats.deepestPath || "—")}\` |`,
  ];

  // Tree section
  const treeSection = [
    `### ${isIt ? "Albero gerarchico" : "Hierarchy tree"}`,
    "",
    "```text",
    ...buildTreeLines(nodes),
    "```",
  ];

  // Elements & attributes table
  const rows = nodes
    .map((n) => {
      const sample = n.sampleValues[0] ? `\`${escapeMd(n.sampleValues[0])}\`` : "—";
      const children = n.childrenPaths.length > 0
        ? n.childrenPaths.map((c) => `\`${c.substring(c.lastIndexOf("/") + 1)}\``).join(", ")
        : "—";
      return `| **${n.name}** | \`${escapeMd(n.path)}\` | ${typeLabel(n.dataType)} | ${n.occurrenceCount} | ${n.isOptional ? "Sì" : "No"} | ${formatAttributeList(n.attributes)} | ${sample} | ${children} |`;
    })
    .join("\n");

  const tableSection = [
    `### ${isIt ? "Elementi e attributi" : "Elements and attributes"}`,
    "",
    `| ${isIt ? "Elemento" : "Element"} | XPath | ${isIt ? "Tipo" : "Type"} | ${isIt ? "Ricorrenze" : "Occurrences"} | ${isIt ? "Opz." : "Opt."} | ${isIt ? "Attributi" : "Attributes"} | ${isIt ? "Valore di esempio" : "Sample value"} | ${isIt ? "Figli" : "Children"} |`,
    "| :--- | :--- | :--- | ---: | :---: | :--- | :--- | :--- |",
    rows,
  ];

  // Top tags
  const topTags = stats.topTags.length > 0
    ? stats.topTags.map((t) => `1. \`${t.tag}\` — ${t.count} ${isIt ? "occorrenze" : "occurrences"}`).join("\n")
    : "—";
  const topTagsSection = [
    `### ${isIt ? "Tag più frequenti" : "Most frequent tags"}`,
    "",
    topTags,
  ];

  const report = [
    title,
    "",
    generated,
    "",
    headerIntro,
    "",
    ...statsSection,
    "",
    ...treeSection,
    "",
    ...tableSection,
    "",
    ...topTagsSection,
  ].join("\n");

  return report;
}
