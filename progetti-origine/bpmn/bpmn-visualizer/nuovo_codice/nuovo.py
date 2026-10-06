import os
import re
import xml.etree.ElementTree as ET
 
# XML Namespaces standard across Oracle SOA Suite
NAMESPACES = {
    'sca': 'http://xmlns.oracle.com/sca/1.0',
    'bpel': 'http://schemas.xmlsoap.org/ws/2003/03/business-process/',
    'bpel2': 'http://docs.oasis-open.org/wsbpel/2.0/process/executable',
    'wsdl': 'http://schemas.xmlsoap.org/wsdl/'
}
 
class LineageExtractor:
    def __init__(self, repo_path):
        self.repo_path = repo_path
        self.edges = set()  # Set of tuples: (source, target, relationship_type)
        self.nodes = set()
 
    def add_relationship(self, source, target, rel_type="calls"):
        """Clean node names and record directed edge."""
        if not source or not target:
            return me
        src_clean = re.sub(r'[^a-zA-Z0-9_\-]', '_', source)
        tgt_clean = re.sub(r'[^a-zA-Z0-9_\-]', '_', target)
        if src_clean != tgt_clean:
            self.nodes.add(src_clean)
            self.nodes.add(tgt_clean)
            self.edges.add((src_clean, tgt_clean, rel_type))
 
    def parse_composite(self, file_path, project_name):
        """Extract wire connections between internal components and external references."""
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
 
            # Parse components
            for component in root.findall('.//sca:component', NAMESPACES):
                comp_name = component.attrib.get('name')
                if comp_name:
                    self.add_relationship(project_name, comp_name, "contains")
 
            # Parse wires (Component -> Reference / Component -> Component)
            for wire in root.findall('.//sca:wire', NAMESPACES):
                source = wire.find('sca:source', NAMESPACES)
                target = wire.find('sca:target', NAMESPACES)
                if source is not None and target is not None:
                    src_text = source.text.split('/')[0] if source.text else None
                    tgt_text = target.text.split('/')[0] if target.text else None
                    if src_text and tgt_text:
                        self.add_relationship(src_text, tgt_text, "invokes")
        except Exception:
            pass
 
    def parse_bpel(self, file_path, current_component):
        """Parse BPEL files for <invoke> activities and partnerLink invocations."""
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
 
            # Find all invoke activities
            for invoke in root.findall('.//bpel:invoke', NAMESPACES) + root.findall('.//bpel2:invoke', NAMESPACES):
                partner_link = invoke.attrib.get('partnerLink')
                operation = invoke.attrib.get('operation', '')
                if partner_link:
                    target_name = f"{partner_link}" if not operation else f"{partner_link}.{operation}"
                    self.add_relationship(current_component, target_name, "invokes")
        except Exception:
            pass
 
    def parse_sql_tables(self, file_path, process_name):
        """Scan SQL, PL/SQL, or mapping files for CRUD operation target tables."""
        table_regex = re.compile(
            r'\b(?:FROM|JOIN|INSERT\s+INTO|UPDATE|MERGE\s+INTO)\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)',
            re.IGNORECASE
        )
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                matches = table_regex.findall(content)
                for table in matches:
                    tbl_upper = table.upper()
                    # Exclude common SQL keywords misidentified as tables
                    if tbl_upper not in {'SELECT', 'WHERE', 'SET', 'DUAL', 'TABLE', 'VALUES', 'AND', 'OR'}:
                        self.add_relationship(process_name, f"TABLE_{tbl_upper}", "reads_writes")
        except Exception:
            pass
 
    def scan_repository(self):
        """Traverse directory tree and extract process dependencies."""
        for root_dir, _, files in os.walk(self.repo_path):
            folder_name = os.path.basename(root_dir)
 
            for file in files:
                file_path = os.path.join(root_dir, file)
                ext = os.path.splitext(file)[1].lower()
 
                # Parse Composites
                if file.lower() == 'composite.xml':
                    project_name = os.path.basename(os.path.dirname(file_path))
                    self.parse_composite(file_path, project_name)
 
                # Parse BPEL Files
                elif ext == '.bpel':
                    comp_name = os.path.splitext(file)[0]
                    self.parse_bpel(file_path, comp_name)
 
                # Parse SQL / PLSQL / Mapping scripts for database interactions
                elif ext in ['.sql', '.pls', '.pkb']:
                    process_name = os.path.splitext(file)[0]
                    self.parse_sql_tables(file_path, process_name)
 
    def generate_mermaid(self, output_file="process_lineage.mmd"):
        """Render extracted graph nodes and edges into Mermaid syntax."""
        mermaid_lines = [
            "%% Auto-generated Process Lineage Diagram",
            "graph TD",
            "    %% Style Definitions",
            "    classDef orchestrator fill:#f9f,stroke:#333,stroke-width:2px;",
            "    classDef database fill:#bbf,stroke:#333,stroke-width:1px;",
            "    classDef process fill:#dfd,stroke:#333,stroke-width:1px;"
        ]
 
        # Categorize and write edges
        for src, tgt, rel in sorted(self.edges):
            if "TABLE_" in tgt:
                mermaid_lines.append(f"    {src} -->|{rel}| {tgt}[/ {tgt.replace('TABLE_', '')} /]")
            else:
                mermaid_lines.append(f"    {src} -->|{rel}| {tgt}")
 
        # Write to file
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("\n".join(mermaid_lines))
 
        print(f"\nLineage diagram successfully saved to: {output_file}")
        return "\n".join(mermaid_lines)
 
 
if __name__ == "__main__":
    LOCAL_REPO_PATH = "./campione"  # Path to local directory
    extractor = LineageExtractor(LOCAL_REPO_PATH)
    
    print("Scanning repository for composite wires, BPEL links, and table references...")
    extractor.scan_repository()
    
    mermaid_code = extractor.generate_mermaid("process_lineage.mmd")
    
    # Preview top output lines
    print("\nMermaid Output Preview (first 25 lines):")
    print("--------------------------------------------------")
    print("\n".join(mermaid_code.splitlines()[:25]))
 
 