#!/usr/bin/env python3
"""
ODI 12c Mapping XML Parser Module
Parses SunopsisExport XML files and extracts mapping documentation.

Supports:
- single mapping exports;
- SmartExport / SunopsisExport files containing multiple mappings;
- backward compatibility with existing builders.
"""
import re
from pathlib import Path
from typing import Any

from lxml import etree as ET


class OdiMappingParser:
    """Parses ODI 12c XML export files using an in-memory relational approach."""

    def __init__(self, xml_path: str):
        self.xml_path = Path(xml_path)

        # Non forziamo encoding='utf-8' perché gli export ODI possono essere ISO-8859-1.
        # lxml di norma usa l'encoding dichiarato nella XML declaration.
        parser = ET.XMLParser(recover=True, huge_tree=True)
        self.tree = ET.parse(str(xml_path), parser=parser)
        self.root = self.tree.getroot()

        # Export metadata
        self.admin = {}
        self.encryption = {}
        self.smart_export_includes = []
        self.smart_export_materialize_shortcut = None

        # Mapping registry
        self.mapping = {}
        self.mappings = {}
        self._mapping_order = []
        self._mapping_alias_to_id = {}

        # Project / folder context
        self.projects = {}
        self.folders = {}

        # Data stores & Metadata
        self.datastores = {}
        self.columns = {}
        self.kms = {}
        self.contexts = {}
        self.logical_schemas = {}
        self.data_types = {}
        self.keys = {}

        # Mapping components
        self.components = {}
        self.connection_points = {}
        self.attributes = {}
        self.expressions = {}
        self.expression_refs = {}
        self.connections = {}
        self.properties = {}

        # Scenarios
        self.scenarios = {}
        self.scen_steps = {}
        self.scen_tasks = {}

        # Execution
        self.exec_units = {}
        self.exec_unit_groups = {}
        self.deploy_specs = {}
        self.phy_nodes = {}

        # Dependencies
        self.fk_refs = []

        # Performance indexes
        self._expr_by_attr = {}
        self._expr_by_prop = {}

        # Used to understand if multi-mapping partitioning is reliable
        self._has_component_ownership = False
        self.scoping_fallback_used = False

        # Dispatch table
        self._parsers = {
            "SnpProject": self._parse_project,
            "SnpFolder": self._parse_folder,
            "SnpMapping": self._parse_mapping,
            "SnpMapRef": self._parse_map_ref,
            "SnpMapComp": self._parse_map_comp,
            "SnpMapCp": self._parse_map_cp,
            "SnpMapAttr": self._parse_map_attr,
            "SnpMapExpr": self._parse_map_expr,
            "SnpMapExprRef": self._parse_map_expr_ref,
            "SnpMapConn": self._parse_map_conn,
            "SnpMapProp": self._parse_map_prop,
            "SnpScen": self._parse_scen,
            "SnpScenStep": self._parse_scen_step,
            "SnpScenTask": self._parse_scen_task,
            "SnpExecUnit": self._parse_exec_unit,
            "SnpExecUnitGrp": self._parse_exec_unit_grp,
            "SnpDeploySpec": self._parse_deploy_spec,
            "SnpPhyNode": self._parse_phy_node,
            "SnpFKXRef": self._parse_fk_ref,
        }

        self._parse_header()
        self._parse_all()
        self._post_process()

    # ---------------------------------------------------------------------
    # BASIC HELPERS
    # ---------------------------------------------------------------------
    FIELD_ALIASES = {
        "IMapping": [
            "IMapping",
            "I_MAPPING",
            "MappingId",
        ],
        "IMapComp": [
            "IMapComp",
            "I_MAP_COMP",
        ],
        "IOwnerMapComp": [
            "IOwnerMapComp",
            "I_OWNER_MAP_COMP",
            "OwnerComponentId",
        ],
        "IMapCp": [
            "IMapCp",
            "I_MAP_CP",
        ],
        "IOwnerMapCp": [
            "IOwnerMapCp",
            "I_OWNER_MAP_CP",
            "OwnerPortId",
        ],
        "IMapAttr": [
            "IMapAttr",
            "I_MAP_ATTR",
        ],
        "IOwnerMapAttr": [
            "IOwnerMapAttr",
            "I_OWNER_MAP_ATTR",
            "OwnerAttributeId",
        ],
        "IMapProp": [
            "IMapProp",
            "I_MAP_PROP",
        ],
        "IMapConn": [
            "IMapConn",
            "I_MAP_CONN",
        ],
        "IStartMapCp": [
            "IStartMapCp",
            "I_START_MAP_CP",
            "SourcePortId",
        ],
        "IEndMapCp": [
            "IEndMapCp",
            "I_END_MAP_CP",
            "TargetPortId",
        ],
        "IStartMapComp": [
            "IStartMapComp",
            "I_START_MAP_COMP",
            "SourceCompId",
        ],
        "IEndMapComp": [
            "IEndMapComp",
            "I_END_MAP_COMP",
            "TargetCompId",
        ],
        "IMapRef": [
            "IMapRef",
            "I_MAP_REF",
        ],
        "IDataMapRef": [
            "IDataMapRef",
            "I_DATA_MAP_REF",
        ],
        "IRefMapAttr": [
            "IRefMapAttr",
            "I_REF_MAP_ATTR",
        ],
        "IRefMapComp": [
            "IRefMapComp",
            "I_REF_MAP_COMP",
        ],
        "IRefMapRef": [
            "IRefMapRef",
            "I_REF_MAP_REF",
        ],
        "IOwnerMapExpr": [
            "IOwnerMapExpr",
            "I_OWNER_MAP_EXPR",
            "OwnerExpressionId",
        ],
        "IOwnerMapProp": [
            "IOwnerMapProp",
            "I_OWNER_MAP_PROP",
        ],
        "IExecUnit": [
            "IExecUnit",
            "I_EXEC_UNIT",
        ],
        "IDeploySpec": [
            "IDeploySpec",
            "I_DEPLOY_SPEC",
        ],
        "IPhyNode": [
            "IPhyNode",
            "I_PHY_NODE",
        ],
    }

    def _camel_to_upper_snake(self, name):
        return re.sub(r"(?<!^)(?=[A-Z])", "_", str(name)).upper()

    def _field_candidates(self, field_name):
        candidates = []

        def add_candidate(value):
            if value and value not in candidates:
                candidates.append(value)

        add_candidate(field_name)

        for alias in self.FIELD_ALIASES.get(field_name, []):
            add_candidate(alias)

        add_candidate(self._camel_to_upper_snake(field_name))
        add_candidate(str(field_name).upper())
        add_candidate(str(field_name).lower())

        return candidates

    def _resolve_mapping_id(self, value):
        if not value:
            return value
        return self._mapping_alias_to_id.get(value, value)
    
    def _local_tag(self, tag):
        return str(tag).split("}", 1)[-1].lower()

    def _get_field(self, obj, field_name, default=None):
        """
        Extract field value from an Object element.

        Tries multiple field name variants/aliases to be more robust
        with different ODI export conventions.
        """
        for candidate in self._field_candidates(field_name):
            field = obj.find(f"Field[@name='{candidate}']")
            if field is not None:
                text = field.text
                if text is None or text.strip().lower() == "null":
                    continue
                return text.strip()

        return default

    def _mark_ownership(self, i_mapping):
        if i_mapping:
            self._has_component_ownership = True

    # ---------------------------------------------------------------------
    # HEADER / EXPORT METADATA
    # ---------------------------------------------------------------------

    def _parse_header(self):
        """Parse Admin, Encryption and SmartExportList elements."""
        for child in self.root:
            tag = self._local_tag(child.tag)

            if tag == "admin":
                self.admin = dict(child.attrib)

            elif tag == "encryption":
                self.encryption = dict(child.attrib)

            elif tag == "smartexportlist":
                self.smart_export_materialize_shortcut = child.get("materializeShortcut")
                for include in child:
                    if self._local_tag(include.tag) == "include" and include.text:
                        self.smart_export_includes.append(include.text.strip())

    # ---------------------------------------------------------------------
    # MAIN PARSING
    # ---------------------------------------------------------------------

    def _parse_all(self):
        """Parse all objects in the XML using the dispatch table."""
        for obj in self.root.findall("Object"):
            obj_class = obj.get("class", "")
            class_name = obj_class.split(".")[-1] if "." in obj_class else obj_class

            parser_func = self._parsers.get(class_name)
            if parser_func:
                parser_func(obj)

    def _post_process(self):
        """Final adjustments after parsing."""
        if self._mapping_order:
            self.mapping = self.mappings[self._mapping_order[0]]

        self._normalize_mapping_ids()

        # Enrich mappings with folder/project names when available
        for mapping in self.mappings.values():
            folder = self.folders.get(mapping.get("i_folder"))
            if folder:
                mapping.setdefault("folder_name", folder.get("folder_name"))
                if folder.get("i_project"):
                    mapping.setdefault("i_project", folder.get("i_project"))

            project = self.projects.get(mapping.get("i_project"))
            if project:
                mapping.setdefault("project_name", project.get("project_name"))
                mapping.setdefault("project_code", project.get("project_code"))


    def _normalize_mapping_ids(self):
        """
        Normalize i_mapping fields using mapping aliases.

        This helps when child objects reference a mapping using MappingId,
        GlobalId, I_MAPPING, etc., while the mapping primary key is IMapping.
        """
        stores = [
            self.components,
            self.connection_points,
            self.attributes,
            self.expressions,
            self.expression_refs,
            self.connections,
            self.properties,
            self.exec_units,
            self.deploy_specs,
            self.phy_nodes,
        ]

        for store in stores:
            for obj in store.values():
                if obj.get("i_mapping"):
                    obj["i_mapping"] = self._resolve_mapping_id(obj["i_mapping"])

        for _, store in self._all_map_ref_stores():
            for obj in store.values():
                if obj.get("i_mapping"):
                    obj["i_mapping"] = self._resolve_mapping_id(obj["i_mapping"])

        for fk in self.fk_refs:
            if fk.get("i_mapping"):
                fk["i_mapping"] = self._resolve_mapping_id(fk["i_mapping"])
    # ---------------------------------------------------------------------
    # PUBLIC API FOR MULTI-MAPPING
    # ---------------------------------------------------------------------

    def mapping_ids(self):
        return list(self._mapping_order)

    def is_multi_mapping(self):
        return len(self._mapping_order) > 1

    def is_smart_export(self):
        is_smart = str(self.admin.get("IsSmartExportFile", "")).lower()
        return is_smart == "true" or self.is_multi_mapping()

    def can_scope_mappings(self):
        """
        Returns True if the parser believes it can reliably partition
        objects by mapping.
        """
        return len(self._mapping_order) <= 1 or self._has_component_ownership

    def to_dict_list(self):
        """
        Returns a list of mapping dictionaries.
        Each dictionary is compatible with the existing builders.
        """
        if not self._mapping_order:
            return [self._to_dict_internal()]

        return [self.to_dict_for_mapping(mapping_id) for mapping_id in self._mapping_order]

    def to_dict(self) -> dict[str, Any]:
        """
        Backward-compatible method.
        Returns the first mapping dictionary.
        """
        if self._mapping_order:
            return self.to_dict_for_mapping(self._mapping_order[0])
        return self._to_dict_internal()

    def to_dict_for_mapping(self, mapping_id):
        """
        Builds a dictionary for a specific mapping, temporarily scoping
        the parser state to only the objects related to that mapping.
        """
        mapping = self.mappings.get(mapping_id)
        if mapping is None:
            return {}

        original_state = (
            self.mapping,
            self.datastores,
            self.columns,
            self.kms,
            self.contexts,
            self.logical_schemas,
            self.data_types,
            self.keys,
            self.components,
            self.connection_points,
            self.attributes,
            self.expressions,
            self.expression_refs,
            self.connections,
            self.properties,
            self.scenarios,
            self.scen_steps,
            self.scen_tasks,
            self.exec_units,
            self.exec_unit_groups,
            self.deploy_specs,
            self.phy_nodes,
            self.fk_refs,
            self._expr_by_attr,
            self._expr_by_prop,
        )

        try:
            scoped = self._select_objects_for_mapping(mapping_id)

            self.mapping = mapping
            self.datastores = scoped["datastores"]
            self.columns = scoped["columns"]
            self.kms = scoped["kms"]
            self.contexts = scoped["contexts"]
            self.logical_schemas = scoped["logical_schemas"]
            self.data_types = scoped["data_types"]
            self.keys = scoped["keys"]
            self.components = scoped["components"]
            self.connection_points = scoped["connection_points"]
            self.attributes = scoped["attributes"]
            self.expressions = scoped["expressions"]
            self.expression_refs = scoped["expression_refs"]
            self.connections = scoped["connections"]
            self.properties = scoped["properties"]
            self.scenarios = scoped["scenarios"]
            self.scen_steps = scoped["scen_steps"]
            self.scen_tasks = scoped["scen_tasks"]
            self.exec_units = scoped["exec_units"]
            self.exec_unit_groups = scoped["exec_unit_groups"]
            self.deploy_specs = scoped["deploy_specs"]
            self.phy_nodes = scoped["phy_nodes"]
            self.fk_refs = scoped["fk_refs"]
            self._expr_by_attr = scoped["expr_by_attr"]
            self._expr_by_prop = scoped["expr_by_prop"]

            return self._to_dict_internal()
        finally:
            (
                self.mapping,
                self.datastores,
                self.columns,
                self.kms,
                self.contexts,
                self.logical_schemas,
                self.data_types,
                self.keys,
                self.components,
                self.connection_points,
                self.attributes,
                self.expressions,
                self.expression_refs,
                self.connections,
                self.properties,
                self.scenarios,
                self.scen_steps,
                self.scen_tasks,
                self.exec_units,
                self.exec_unit_groups,
                self.deploy_specs,
                self.phy_nodes,
                self.fk_refs,
                self._expr_by_attr,
                self._expr_by_prop,
            ) = original_state

    # ---------------------------------------------------------------------
    # OBJECT SELECTION / SCOPING FOR A SINGLE MAPPING
    # ---------------------------------------------------------------------

    def _select_all_objects(self):
        """Return all parsed objects. Used for single-mapping mode or fallback."""
        return {
            "datastores": dict(self.datastores),
            "columns": dict(self.columns),
            "kms": dict(self.kms),
            "contexts": dict(self.contexts),
            "logical_schemas": dict(self.logical_schemas),
            "data_types": dict(self.data_types),
            "keys": dict(self.keys),
            "components": dict(self.components),
            "connection_points": dict(self.connection_points),
            "attributes": dict(self.attributes),
            "expressions": dict(self.expressions),
            "expression_refs": dict(self.expression_refs),
            "connections": dict(self.connections),
            "properties": dict(self.properties),
            "scenarios": dict(self.scenarios),
            "scen_steps": dict(self.scen_steps),
            "scen_tasks": dict(self.scen_tasks),
            "exec_units": dict(self.exec_units),
            "exec_unit_groups": dict(self.exec_unit_groups),
            "deploy_specs": dict(self.deploy_specs),
            "phy_nodes": dict(self.phy_nodes),
            "fk_refs": list(self.fk_refs),
            "expr_by_attr": dict(self._expr_by_attr),
            "expr_by_prop": dict(self._expr_by_prop),
        }

    def _select_objects_for_mapping(self, mapping_id):
        """
        Selects only objects related to a given mapping using real ODI fields:
        - IOwnerMapping on SnpMapComp, SnpMapConn, SnpMapRef, SnpDeploySpec
        - IMapping / IOwnerMapping on SnpMapProp
        - IOwnerMapComp on SnpMapCp
        - IOwnerMapCp on SnpMapAttr
        - IOwnerMapAttr / IOwnerMapProp on SnpMapExpr
        - IOwnerMapExpr on SnpMapExprRef
        - IMapping on SnpScen
        - IDeploySpec / IExecUnit / IPhyNode references from SnpMapProp
        - IOwnerDs references from SnpExecUnit / SnpPhyNode
        """
        # Single mapping: preserve old behavior.
        if len(self._mapping_order) <= 1:
            return self._select_all_objects()

        # If we do not have enough ownership information, preserve all objects.
        if not self._has_component_ownership:
            self.scoping_fallback_used = True
            return self._select_all_objects()

        comp_ids = set()
        cp_ids = set()
        attr_ids = set()
        prop_ids = set()
        conn_ids = set()
        expr_ids = set()
        expr_ref_ids = set()
        scen_ids = set()
        exec_unit_ids = set()
        deploy_spec_ids = set()
        phy_node_ids = set()
        map_ref_ids = set()

        def add_id(target_set, value):
            if value and value not in target_set:
                target_set.add(value)
                return True
            return False

        # ------------------------------------------------------------------
        # Direct ownership by IMapping / IOwnerMapping
        # ------------------------------------------------------------------

        for comp_id, comp in self.components.items():
            if comp.get("i_mapping") == mapping_id:
                add_id(comp_ids, comp_id)

        for prop_id, prop in self.properties.items():
            if prop.get("i_mapping") == mapping_id:
                add_id(prop_ids, prop_id)

        for conn_id, conn in self.connections.items():
            if conn.get("i_mapping") == mapping_id:
                add_id(conn_ids, conn_id)

        for expr_id, expr in self.expressions.items():
            if expr.get("i_mapping") == mapping_id:
                add_id(expr_ids, expr_id)

        for scen_no, scen in self.scenarios.items():
            if scen.get("i_mapping") == mapping_id:
                add_id(scen_ids, scen_no)

        for ds_id, ds in self.deploy_specs.items():
            if ds.get("i_mapping") == mapping_id:
                add_id(deploy_spec_ids, ds_id)

        for eu_id, eu in self.exec_units.items():
            if eu.get("i_mapping") == mapping_id:
                add_id(exec_unit_ids, eu_id)

        for pn_id, pn in self.phy_nodes.items():
            if pn.get("i_mapping") == mapping_id:
                add_id(phy_node_ids, pn_id)

        # MapRef objects can be directly owned by the mapping.
        for ref_id, ref in self._all_map_refs().items():
            if ref.get("i_mapping") == mapping_id:
                add_id(map_ref_ids, ref_id)

        # ------------------------------------------------------------------
        # Closure: propagate ownership through relations
        # ------------------------------------------------------------------

        changed = True
        while changed:
            changed = False

            # Properties can reference components, exec units, deploy specs, phy nodes.
            for prop_id, prop in self.properties.items():
                if prop_id in prop_ids:
                    continue

                if (
                    prop.get("i_mapping") == mapping_id
                    or prop.get("i_map_comp") in comp_ids
                    or prop.get("i_map_cp") in cp_ids
                    or prop.get("i_map_attr") in attr_ids
                ):
                    if add_id(prop_ids, prop_id):
                        changed = True

                    if prop.get("i_map_comp") and prop.get("i_map_comp") in self.components:
                        if add_id(comp_ids, prop.get("i_map_comp")):
                            changed = True

                    if prop.get("i_exec_unit"):
                        if add_id(exec_unit_ids, prop.get("i_exec_unit")):
                            changed = True

                    if prop.get("i_deploy_spec"):
                        if add_id(deploy_spec_ids, prop.get("i_deploy_spec")):
                            changed = True

                    if prop.get("i_phy_node"):
                        if add_id(phy_node_ids, prop.get("i_phy_node")):
                            changed = True

            # Connection points owned by components.
            for cp_id, cp in self.connection_points.items():
                if cp_id in cp_ids:
                    continue

                if cp.get("i_owner_map_comp") in comp_ids:
                    if add_id(cp_ids, cp_id):
                        changed = True

                    owner = cp.get("i_owner_map_comp")
                    if owner and owner in self.components:
                        if add_id(comp_ids, owner):
                            changed = True

            # If a CP is selected, ensure its owner component is selected.
            for cp_id, cp in self.connection_points.items():
                if cp_id in cp_ids:
                    owner = cp.get("i_owner_map_comp")
                    if owner and owner in self.components:
                        if add_id(comp_ids, owner):
                            changed = True

            # Attributes owned by connection points.
            for attr_id, attr in self.attributes.items():
                if attr_id in attr_ids:
                    continue

                if attr.get("i_owner_map_cp") in cp_ids:
                    if add_id(attr_ids, attr_id):
                        changed = True

            # Expressions owned by attributes, properties, or connection points.
            for expr_id, expr in self.expressions.items():
                if expr_id in expr_ids:
                    continue

                if (
                    expr.get("i_owner_map_attr") in attr_ids
                    or expr.get("i_owner_map_prop") in prop_ids
                    or expr.get("i_map_cp") in cp_ids
                ):
                    if add_id(expr_ids, expr_id):
                        changed = True

            # Connections owned by mapping or connecting selected CPs/components.
            for conn_id, conn in self.connections.items():
                if conn_id in conn_ids:
                    continue

                start_cp = conn.get("i_start_map_cp")
                end_cp = conn.get("i_end_map_cp")

                start_cp_obj = self.connection_points.get(start_cp)
                end_cp_obj = self.connection_points.get(end_cp)

                start_comp = start_cp_obj.get("i_owner_map_comp") if start_cp_obj else None
                end_comp = end_cp_obj.get("i_owner_map_comp") if end_cp_obj else None

                if (
                    conn.get("i_mapping") == mapping_id
                    or (start_cp in cp_ids and end_cp in cp_ids)
                    or (start_comp in comp_ids and end_comp in comp_ids)
                ):
                    if add_id(conn_ids, conn_id):
                        changed = True

            # Physical nodes can reference components, CPs, exec units, deploy specs.
            for pn_id, pn in self.phy_nodes.items():
                if pn_id in phy_node_ids:
                    continue

                if (
                    pn.get("i_map_comp") in comp_ids
                    or pn.get("i_map_cp") in cp_ids
                    or pn.get("i_exec_unit") in exec_unit_ids
                    or pn.get("i_owner_ds") in deploy_spec_ids
                ):
                    if add_id(phy_node_ids, pn_id):
                        changed = True

                    if pn.get("i_exec_unit"):
                        if add_id(exec_unit_ids, pn.get("i_exec_unit")):
                            changed = True

                    if pn.get("i_map_comp") and pn.get("i_map_comp") in self.components:
                        if add_id(comp_ids, pn.get("i_map_comp")):
                            changed = True

                    if pn.get("i_map_cp") and pn.get("i_map_cp") in self.connection_points:
                        if add_id(cp_ids, pn.get("i_map_cp")):
                            changed = True

            # Exec units can be owned by deploy specs.
            for eu_id, eu in self.exec_units.items():
                if eu_id in exec_unit_ids:
                    continue

                if eu.get("i_owner_ds") in deploy_spec_ids:
                    if add_id(exec_unit_ids, eu_id):
                        changed = True

            # Deploy specs directly owned by mapping.
            for ds_id, ds in self.deploy_specs.items():
                if ds_id in deploy_spec_ids:
                    continue

                if ds.get("i_mapping") == mapping_id:
                    if add_id(deploy_spec_ids, ds_id):
                        changed = True

        # ------------------------------------------------------------------
        # Expression references
        # ------------------------------------------------------------------

        for ref_id, ref in self.expression_refs.items():
            if (
                ref.get("i_owner_map_expr") in expr_ids
                or ref.get("i_ref_map_attr") in attr_ids
                or ref.get("i_ref_map_comp") in comp_ids
            ):
                add_id(expr_ref_ids, ref_id)

        # ------------------------------------------------------------------
        # MapRef IDs used by selected objects
        # ------------------------------------------------------------------

        for comp_id in comp_ids:
            comp = self.components.get(comp_id)
            if comp:
                add_id(map_ref_ids, comp.get("i_map_ref"))

        for attr_id in attr_ids:
            attr = self.attributes.get(attr_id)
            if attr:
                add_id(map_ref_ids, attr.get("i_map_ref"))
                add_id(map_ref_ids, attr.get("i_data_map_ref"))

        for ref_id in expr_ref_ids:
            ref = self.expression_refs.get(ref_id)
            if ref:
                add_id(map_ref_ids, ref.get("i_ref_map_ref"))

        for eu_id in exec_unit_ids:
            eu = self.exec_units.get(eu_id)
            if eu:
                add_id(map_ref_ids, eu.get("i_lschema_ref"))
                add_id(map_ref_ids, eu.get("i_eu_km_ref"))

        for pn_id in phy_node_ids:
            pn = self.phy_nodes.get(pn_id)
            if pn:
                add_id(map_ref_ids, pn.get("i_src_comp_km"))
                add_id(map_ref_ids, pn.get("i_tgt_comp_km"))

        for ds_id in deploy_spec_ids:
            ds = self.deploy_specs.get(ds_id)
            if ds:
                add_id(map_ref_ids, ds.get("i_map_ref"))

        # ------------------------------------------------------------------
        # Build scoped dictionaries
        # ------------------------------------------------------------------

        components = {k: v for k, v in self.components.items() if k in comp_ids}
        connection_points = {k: v for k, v in self.connection_points.items() if k in cp_ids}
        attributes = {k: v for k, v in self.attributes.items() if k in attr_ids}
        properties = {k: v for k, v in self.properties.items() if k in prop_ids}
        expressions = {k: v for k, v in self.expressions.items() if k in expr_ids}
        connections = {k: v for k, v in self.connections.items() if k in conn_ids}
        expression_refs = {k: v for k, v in self.expression_refs.items() if k in expr_ref_ids}

        # ------------------------------------------------------------------
        # SAFETY FALLBACK
        #
        # If scoping removed structural objects that are present globally,
        # avoid producing an empty/incomplete mapping documentation.
        # ------------------------------------------------------------------

        if self.components and not components:
            self.scoping_fallback_used = True
            return self._select_all_objects()

        if self.connection_points and (components or comp_ids) and not connection_points:
            self.scoping_fallback_used = True
            return self._select_all_objects()

        if self.attributes and (components or connection_points or cp_ids) and not attributes:
            self.scoping_fallback_used = True
            return self._select_all_objects()

        if self.properties and (components or connection_points or attributes) and not properties:
            self.scoping_fallback_used = True
            return self._select_all_objects()

        if self.expressions and (attributes or properties) and not expressions:
            self.scoping_fallback_used = True
            return self._select_all_objects()

        if self.connections and (components or connection_points) and not connections:
            self.scoping_fallback_used = True
            return self._select_all_objects()

        # ------------------------------------------------------------------
        # Scenarios and execution objects
        # ------------------------------------------------------------------

        scenarios = {k: v for k, v in self.scenarios.items() if k in scen_ids}
        scen_nos = set(scen_ids)
        scen_steps = {k: v for k, v in self.scen_steps.items() if k[0] in scen_nos}
        scen_tasks = {k: v for k, v in self.scen_tasks.items() if k[0] in scen_nos}

        exec_units = {k: v for k, v in self.exec_units.items() if k in exec_unit_ids}
        deploy_specs = {k: v for k, v in self.deploy_specs.items() if k in deploy_spec_ids}
        phy_nodes = {k: v for k, v in self.phy_nodes.items() if k in phy_node_ids}

        group_ids = {
            eu.get("i_exec_unit_grp")
            for eu in exec_units.values()
            if eu.get("i_exec_unit_grp")
        }
        exec_unit_groups = {
            k: v for k, v in self.exec_unit_groups.items() if k in group_ids
        }

        # ------------------------------------------------------------------
        # Map refs
        # ------------------------------------------------------------------

        scoped_refs = {}
        for store_name, store in self._all_map_ref_stores():
            scoped_refs[store_name] = {
                k: v
                for k, v in store.items()
                if k in map_ref_ids or v.get("i_map_ref") in map_ref_ids
            }

        # If components were selected but no datastore refs were selected,
        # fallback to global objects to avoid losing source/target names.
        if self.datastores and components and not scoped_refs.get("datastores"):
            self.scoping_fallback_used = True
            return self._select_all_objects()

        # ------------------------------------------------------------------
        # FK refs
        #
        # In your real export SnpFKXRef has no owner field, so in multi-mapping
        # mode we cannot safely assign dependencies to a specific mapping.
        # ------------------------------------------------------------------

        scoped_fk_refs = []

        # ------------------------------------------------------------------
        # Rebuild expression indexes
        # ------------------------------------------------------------------

        expr_by_attr = {}
        expr_by_prop = {}
        for expr in expressions.values():
            if expr.get("i_owner_map_attr"):
                expr_by_attr[expr["i_owner_map_attr"]] = expr
            if expr.get("i_owner_map_prop"):
                expr_by_prop[expr["i_owner_map_prop"]] = expr

        return {
            "datastores": scoped_refs["datastores"],
            "columns": scoped_refs["columns"],
            "kms": scoped_refs["kms"],
            "contexts": scoped_refs["contexts"],
            "logical_schemas": scoped_refs["logical_schemas"],
            "data_types": scoped_refs["data_types"],
            "keys": scoped_refs["keys"],
            "components": components,
            "connection_points": connection_points,
            "attributes": attributes,
            "expressions": expressions,
            "expression_refs": expression_refs,
            "connections": connections,
            "properties": properties,
            "scenarios": scenarios,
            "scen_steps": scen_steps,
            "scen_tasks": scen_tasks,
            "exec_units": exec_units,
            "exec_unit_groups": exec_unit_groups,
            "deploy_specs": deploy_specs,
            "phy_nodes": phy_nodes,
            "fk_refs": scoped_fk_refs,
            "expr_by_attr": expr_by_attr,
            "expr_by_prop": expr_by_prop,
        }

    def _all_map_ref_stores(self):
        return [
            ("datastores", self.datastores),
            ("columns", self.columns),
            ("kms", self.kms),
            ("contexts", self.contexts),
            ("logical_schemas", self.logical_schemas),
            ("data_types", self.data_types),
            ("keys", self.keys),
        ]

    def _all_map_refs(self):
        all_refs = {}
        for _, store in self._all_map_ref_stores():
            for ref_id, ref in store.items():
                all_refs[ref_id] = ref
        return all_refs

    # ---------------------------------------------------------------------
    # OBJECT PARSERS
    # ---------------------------------------------------------------------

    def _parse_project(self, obj):
        project_id = self._get_field(obj, "IProject")
        if not project_id:
            return

        self.projects[project_id] = {
            "i_project": project_id,
            "project_name": self._get_field(obj, "ProjectName") or self._get_field(obj, "Name"),
            "project_code": self._get_field(obj, "ProjectCode"),
            "global_id": self._get_field(obj, "GlobalId"),
        }

    def _parse_folder(self, obj):
        folder_id = self._get_field(obj, "IFolder")
        if not folder_id:
            return

        self.folders[folder_id] = {
            "i_folder": folder_id,
            "folder_name": self._get_field(obj, "FolderName") or self._get_field(obj, "Name"),
            "i_project": self._get_field(obj, "IProject"),
            "global_id": self._get_field(obj, "GlobalId"),
        }

    def _parse_mapping(self, obj):
        raw_mapping_ids = [
            self._get_field(obj, "IMapping"),
            self._get_field(obj, "I_MAPPING"),
            self._get_field(obj, "MappingId"),
            self._get_field(obj, "GlobalId"),
        ]

        raw_mapping_ids = [x for x in raw_mapping_ids if x]

        mapping_id = (
            raw_mapping_ids[0]
            if raw_mapping_ids
            else f"mapping_{len(self.mappings) + 1}"
        )

        # Register aliases so child objects can reference this mapping
        # using IMapping, I_MAPPING, MappingId, GlobalId, etc.
        for raw_id in raw_mapping_ids:
            self._mapping_alias_to_id[raw_id] = mapping_id

        mapping = {
            "name": self._get_field(obj, "Name"),
            "description": self._get_field(obj, "Description"),
            "business_name": self._get_field(obj, "BusinessName"),
            "global_id": self._get_field(obj, "GlobalId"),
            "first_date": self._get_field(obj, "FirstDate"),
            "last_date": self._get_field(obj, "LastDate"),
            "first_user": self._get_field(obj, "FirstUser"),
            "last_user": self._get_field(obj, "LastUser"),
            "i_mapping": mapping_id,
            "i_folder": self._get_field(obj, "IFolder"),
            "i_project": self._get_field(obj, "IProject"),
            "mapping_aliases": raw_mapping_ids,
        }

        if mapping_id not in self.mappings:
            self.mappings[mapping_id] = mapping
            self._mapping_order.append(mapping_id)

        self.mapping = self.mappings[mapping_id]


    def _parse_map_ref(self, obj):
        ref_id = self._get_field(obj, "IMapRef")
        if not ref_id:
            return

        adapter_type = self._get_field(obj, "AdapterIntfType")

        i_mapping = (
            self._get_field(obj, "IMapping")
            or self._get_field(obj, "IOwnerMapping")
        )
        i_mapping = self._resolve_mapping_id(i_mapping)

        info = {
            "i_map_ref": ref_id,
            "adapter_type": adapter_type,
            "adapter_name": self._get_field(obj, "AdapterName"),
            "qualified_name": self._get_field(obj, "QualifiedName"),
            "qualified_name2": self._get_field(obj, "QualifiedName2"),
            "qualified_name3": self._get_field(obj, "QualifiedName3"),
            "fco_qualified_name": self._get_field(obj, "FcoQualifiedName"),
            "i_fco_id": self._get_field(obj, "IFcoId"),
            "i_ref_id": self._get_field(obj, "IRefId"),
            "global_id": self._get_field(obj, "GlobalId"),
            "i_owner_mapping": self._get_field(obj, "IOwnerMapping"),
            "i_mapping": i_mapping,
        }

        ref_map = {
            "IDataStore": self.datastores,
            "IColumn": self.columns,
            "IKnowledgeModule": self.kms,
            "IContext": self.contexts,
            "ILogicalSchema": self.logical_schemas,
            "IDataType": self.data_types,
            "IKey": self.keys,
        }

        target_dict = ref_map.get(adapter_type)
        if target_dict is not None:
            target_dict[ref_id] = info

    def _parse_map_comp(self, obj):
        comp_id = self._get_field(obj, "IMapComp")
        if not comp_id:
            return

        # Real ODI exports use IOwnerMapping on SnpMapComp.
        i_mapping = (
            self._get_field(obj, "IMapping")
            or self._get_field(obj, "IOwnerMapping")
        )
        i_mapping = self._resolve_mapping_id(i_mapping)

        self._mark_ownership(i_mapping)

        self.components[comp_id] = {
            "i_map_comp": comp_id,
            "name": self._get_field(obj, "Name"),
            "type_name": self._get_field(obj, "TypeName"),
            "i_map_comp_type": self._get_field(obj, "IMapCompType"),
            "i_map_ref": self._get_field(obj, "IMapRef"),
            "alias": self._get_field(obj, "Alias"),
            "description": self._get_field(obj, "Description"),
            "sort_pos": self._get_field(obj, "SortPos"),
            "is_hidden": self._get_field(obj, "IsHidden"),
            "global_id": self._get_field(obj, "GlobalId"),
            "i_owner_map_comp": self._get_field(obj, "IOwnerMapComp"),
            "i_owner_mapping": self._get_field(obj, "IOwnerMapping"),
            "i_mapping": i_mapping,
        }


    def _parse_map_cp(self, obj):
        cp_id = self._get_field(obj, "IMapCp")
        if not cp_id:
            return

        i_mapping = self._get_field(obj, "IMapping")
        self._mark_ownership(i_mapping)

        self.connection_points[cp_id] = {
            "i_map_cp": cp_id,
            "name": self._get_field(obj, "Name"),
            "direction": self._get_field(obj, "Direction"),
            "i_owner_map_comp": self._get_field(obj, "IOwnerMapComp"),
            "i_map_cp_role": self._get_field(obj, "IMapCpRole"),
            "cardinality": self._get_field(obj, "Cardinality"),
            "cp_order": self._get_field(obj, "CpOrder"),
            "i_mapping": i_mapping,
        }

    def _parse_map_attr(self, obj):
        attr_id = self._get_field(obj, "IMapAttr")
        if not attr_id:
            return

        i_mapping = self._get_field(obj, "IMapping")
        self._mark_ownership(i_mapping)

        self.attributes[attr_id] = {
            "i_map_attr": attr_id,
            "name": self._get_field(obj, "Name"),
            "i_owner_map_cp": self._get_field(obj, "IOwnerMapCp"),
            "i_map_ref": self._get_field(obj, "IMapRef"),
            "i_data_map_ref": self._get_field(obj, "IDataMapRef"),
            "attr_type": self._get_field(obj, "AttrType"),
            "length": self._get_field(obj, "Length"),
            "scale": self._get_field(obj, "Scale"),
            "is_required": self._get_field(obj, "IsRequired"),
            "grp_func": self._get_field(obj, "GrpFunc"),
            "sort_pos": self._get_field(obj, "SortPos"),
            "global_id": self._get_field(obj, "GlobalId"),
            "i_mapping": i_mapping,
        }

    def _parse_map_expr(self, obj):
        expr_id = self._get_field(obj, "IMapExpr")
        if not expr_id:
            return

        owner_attr = self._get_field(obj, "IOwnerMapAttr")
        owner_prop = self._get_field(obj, "IOwnerMapProp")

        i_mapping = (
            self._get_field(obj, "IMapping")
            or self._get_field(obj, "IOwnerMapping")
        )
        i_mapping = self._resolve_mapping_id(i_mapping)

        expr_data = {
            "i_map_expr": expr_id,
            "txt": self._get_field(obj, "Txt"),
            "parsed_txt": self._get_field(obj, "ParsedTxt"),
            "i_owner_map_attr": owner_attr,
            "i_owner_map_prop": owner_prop,
            "i_map_cp": self._get_field(obj, "IMapCp"),
            "is_parsed": self._get_field(obj, "IsParsed"),
            "global_id": self._get_field(obj, "GlobalId"),
            "i_mapping": i_mapping,
        }

        self.expressions[expr_id] = expr_data

        if owner_attr:
            self._expr_by_attr[owner_attr] = expr_data
        if owner_prop:
            self._expr_by_prop[owner_prop] = expr_data

    def _parse_map_expr_ref(self, obj):
        ref_id = self._get_field(obj, "IMapExprRef")
        if not ref_id:
            return

        self.expression_refs[ref_id] = {
            "i_map_expr_ref": ref_id,
            "i_owner_map_expr": self._get_field(obj, "IOwnerMapExpr"),
            "i_ref_map_attr": self._get_field(obj, "IRefMapAttr"),
            "i_ref_map_comp": self._get_field(obj, "IRefMapComp"),
            "i_ref_map_ref": self._get_field(obj, "IRefMapRef"),
            "ref_key": self._get_field(obj, "RefKey"),
            "ref_text": self._get_field(obj, "RefText"),
            "i_scoping_map_cp": self._get_field(obj, "IScopingMapCp"),
            "i_mapping": self._get_field(obj, "IMapping"),
        }

    def _parse_map_conn(self, obj):
        conn_id = self._get_field(obj, "IMapConn")
        if not conn_id:
            return

        i_mapping = (
            self._get_field(obj, "IMapping")
            or self._get_field(obj, "IOwnerMapping")
        )
        i_mapping = self._resolve_mapping_id(i_mapping)

        self._mark_ownership(i_mapping)

        self.connections[conn_id] = {
            "i_map_conn": conn_id,
            "name": self._get_field(obj, "Name"),
            "i_start_map_cp": self._get_field(obj, "IStartMapCp"),
            "i_end_map_cp": self._get_field(obj, "IEndMapCp"),
            "i_owner_mapping": self._get_field(obj, "IOwnerMapping"),
            "i_mapping": i_mapping,
        }

    def _parse_map_prop(self, obj):
        prop_id = self._get_field(obj, "IMapProp")
        if not prop_id:
            return

        i_mapping = (
            self._get_field(obj, "IMapping")
            or self._get_field(obj, "IOwnerMapping")
        )
        i_mapping = self._resolve_mapping_id(i_mapping)

        self._mark_ownership(i_mapping)

        self.properties[prop_id] = {
            "i_map_prop": prop_id,
            "name": self._get_field(obj, "Name"),
            "i_map_comp": self._get_field(obj, "IMapComp"),
            "i_map_attr": self._get_field(obj, "IMapAttr"),
            "i_map_cp": self._get_field(obj, "IMapCp"),
            "i_mapping": i_mapping,
            "i_owner_mapping": self._get_field(obj, "IOwnerMapping"),
            "i_deploy_spec": self._get_field(obj, "IDeploySpec"),
            "i_exec_unit": self._get_field(obj, "IExecUnit"),
            "i_phy_node": self._get_field(obj, "IPhyNode"),
            "i_prop_def": self._get_field(obj, "IPropDef"),
            "prop_type": self._get_field(obj, "PropType"),
            "prop_value": self._get_field(obj, "PropValue"),
            "is_hidden": self._get_field(obj, "IsHidden"),
        }

    def _parse_scen(self, obj):
        scen_no = self._get_field(obj, "ScenNo")
        if not scen_no:
            return

        self.scenarios[scen_no] = {
            "scen_no": scen_no,
            "scen_name": self._get_field(obj, "ScenName"),
            "scen_version": self._get_field(obj, "ScenVersion"),
            "i_mapping": self._get_field(obj, "IMapping"),
            "first_date": self._get_field(obj, "FirstDate"),
            "last_date": self._get_field(obj, "LastDate"),
            "first_user": self._get_field(obj, "FirstUser"),
            "last_user": self._get_field(obj, "LastUser"),
            "global_id": self._get_field(obj, "GlobalId"),
        }

    def _parse_scen_step(self, obj):
        scen_no = self._get_field(obj, "ScenNo")
        nno = self._get_field(obj, "Nno")
        if not scen_no or not nno:
            return

        key = (scen_no, nno)
        self.scen_steps[key] = {
            "scen_no": scen_no,
            "nno": nno,
            "step_name": self._get_field(obj, "StepName"),
            "step_type": self._get_field(obj, "StepType"),
            "table_name": self._get_field(obj, "TableName"),
            "res_name": self._get_field(obj, "ResName"),
            "lschema_name": self._get_field(obj, "LschemaName"),
            "mod_code": self._get_field(obj, "ModCode"),
            "gen_info": self._get_field(obj, "GenInfo"),
        }

    def _parse_scen_task(self, obj):
        scen_no = self._get_field(obj, "ScenNo")
        task_no = self._get_field(obj, "ScenTaskNo")
        if not scen_no or not task_no:
            return

        key = (scen_no, task_no)
        self.scen_tasks[key] = {
            "scen_no": scen_no,
            "scen_task_no": task_no,
            "task_name1": self._get_field(obj, "TaskName1"),
            "task_name2": self._get_field(obj, "TaskName2"),
            "task_name3": self._get_field(obj, "TaskName3"),
            "task_type": self._get_field(obj, "TaskType"),
            "def_txt": self._get_field(obj, "DefTxt"),
            "col_txt": self._get_field(obj, "ColTxt"),
            "def_lschema_name": self._get_field(obj, "DefLschemaName"),
            "col_lschema_name": self._get_field(obj, "ColLschemaName"),
            "def_tech_int_name": self._get_field(obj, "DefTechIntName"),
            "col_tech_int_name": self._get_field(obj, "ColTechIntName"),
            "nno": self._get_field(obj, "Nno"),
            "ord_trt": self._get_field(obj, "OrdTrt"),
        }

    def _parse_exec_unit(self, obj):
        eu_id = self._get_field(obj, "IExecUnit")
        if not eu_id:
            return

        i_mapping = self._get_field(obj, "IMapping")
        self._mark_ownership(i_mapping)

        self.exec_units[eu_id] = {
            "i_exec_unit": eu_id,
            "name": self._get_field(obj, "Name"),
            "business_name": self._get_field(obj, "BusinessName"),
            "i_exec_unit_grp": self._get_field(obj, "IExecUnitGrp"),
            "i_lschema_ref": self._get_field(obj, "ILschemaRef"),
            "i_eu_km_ref": self._get_field(obj, "IEuKmRef"),
            "i_mapping": i_mapping,
        }

    def _parse_exec_unit_grp(self, obj):
        grp_id = self._get_field(obj, "IExecUnitGrp")
        if not grp_id:
            return

        self.exec_unit_groups[grp_id] = {
            "i_exec_unit_grp": grp_id,
            "name": self._get_field(obj, "Name"),
            "i_owner_ds": self._get_field(obj, "IOwnerDs"),
        }

    def _parse_exec_unit(self, obj):
        eu_id = self._get_field(obj, "IExecUnit")
        if not eu_id:
            return

        i_mapping = self._get_field(obj, "IMapping")
        i_mapping = self._resolve_mapping_id(i_mapping)

        self.exec_units[eu_id] = {
            "i_exec_unit": eu_id,
            "name": self._get_field(obj, "Name"),
            "business_name": self._get_field(obj, "BusinessName"),
            "i_exec_unit_grp": self._get_field(obj, "IExecUnitGrp"),
            "i_lschema_ref": self._get_field(obj, "ILschemaRef"),
            "i_eu_km_ref": self._get_field(obj, "IEuKmRef"),
            "i_owner_ds": self._get_field(obj, "IOwnerDs"),
            "i_mapping": i_mapping,
        }

    def _parse_deploy_spec(self, obj):
        ds_id = self._get_field(obj, "IDeploySpec")
        if not ds_id:
            return

        i_mapping = (
            self._get_field(obj, "IMapping")
            or self._get_field(obj, "IOwnerMapping")
        )
        i_mapping = self._resolve_mapping_id(i_mapping)

        self.deploy_specs[ds_id] = {
            "i_deploy_spec": ds_id,
            "name": self._get_field(obj, "Name"),
            "i_map_ref": self._get_field(obj, "IMapRef"),
            "i_owner_mapping": self._get_field(obj, "IOwnerMapping"),
            "i_mapping": i_mapping,
        }

    def _parse_phy_node(self, obj):
        pn_id = self._get_field(obj, "IPhyNode")
        if not pn_id:
            return

        i_mapping = self._get_field(obj, "IMapping")
        i_mapping = self._resolve_mapping_id(i_mapping)

        if i_mapping:
            self._mark_ownership(i_mapping)

        self.phy_nodes[pn_id] = {
            "i_phy_node": pn_id,
            "name": self._get_field(obj, "Name"),
            "node_type": self._get_field(obj, "NodeType"),
            "i_exec_unit": self._get_field(obj, "IExecUnit"),
            "i_map_comp": self._get_field(obj, "IMapComp"),
            "i_map_cp": self._get_field(obj, "IMapCp"),
            "i_par_phy_node": self._get_field(obj, "IParPhyNode"),
            "i_src_comp_km": self._get_field(obj, "ISrcCompKm"),
            "i_tgt_comp_km": self._get_field(obj, "ITgtCompKm"),
            "stage_table_name": self._get_field(obj, "StageTableName"),
            "i_owner_ds": self._get_field(obj, "IOwnerDs"),
            "i_mapping": i_mapping,
        }

    def _parse_fk_ref(self, obj):
        self.fk_refs.append({
            "ref_key": self._get_field(obj, "RefKey"),
            "ref_obj_fq_name": self._get_field(obj, "RefObjFQName"),
            "ref_obj_fq_type": self._get_field(obj, "RefObjFQType"),
            "ref_obj_global_id": self._get_field(obj, "RefObjGlobalId"),
            "i_mapping": self._get_field(obj, "IMapping"),
            "i_map_comp": self._get_field(obj, "IMapComp"),
            "i_map_attr": self._get_field(obj, "IMapAttr"),
            "i_map_cp": self._get_field(obj, "IMapCp"),
            "i_map_prop": self._get_field(obj, "IMapProp"),
            "i_fco_id": self._get_field(obj, "IFcoId"),
        })

    # ---------------------------------------------------------------------
    # BUSINESS LOGIC & HELPERS
    # ---------------------------------------------------------------------

    def _normalize_qualified_name(self, qualified_name: str) -> str:
        """Rimuove i prefissi tecnologici ODI (M, ORACLE_, ...) dal nome modello."""
        if not qualified_name or '.' not in qualified_name:
            return qualified_name

        parts = qualified_name.split('.')
        model = parts[0]

        prefixes = ['ORACLE_', 'MSSQL_', 'DB2_', 'MYSQL_', 'HIVE_', 'HADOOP_', 'TERADATA_', 'SQLS_']
        stripped = False
        for prefix in prefixes:
            if model.startswith(prefix):
                model = model[len(prefix):]
                stripped = True
                break

        if not stripped and len(model) > 1 and model[0] == 'M' and model[1].isupper():
            model = model[1:]

        parts[0] = model
        return '.'.join(parts)

    def get_datastore_name(self, map_ref_id: str):
        if map_ref_id in self.datastores:
            qn = self.datastores[map_ref_id].get("qualified_name", "Unknown")
            return self._normalize_qualified_name(qn)
        return None

    def get_component_datastore(self, comp_id: str):
        comp = self.components.get(comp_id)
        if comp and comp.get("i_map_ref"):
            return self.get_datastore_name(comp["i_map_ref"])
        return None

    def get_expr_for_attr(self, attr_id: str):
        expr = self._expr_by_attr.get(attr_id)
        if expr:
            return expr.get("txt") or expr.get("parsed_txt")
        return None

    def get_expr_for_prop(self, prop_id: str):
        expr = self._expr_by_prop.get(prop_id)
        if expr:
            return expr.get("txt") or expr.get("parsed_txt")
        return None

    def _analyze_datastore_flow(self):
        ds_roles = {}

        for comp_id, comp in self.components.items():
            if comp.get("type_name") != "DATASTORE":
                continue

            has_input = False
            has_output = False

            for cp in self.connection_points.values():
                if cp.get("i_owner_map_comp") != comp_id:
                    continue

                cp_id = cp["i_map_cp"]

                for conn in self.connections.values():
                    if conn.get("i_end_map_cp") == cp_id:
                        has_input = True
                    if conn.get("i_start_map_cp") == cp_id:
                        has_output = True

            ds_name = self.get_component_datastore(comp_id)
            if ds_name:
                if has_output and not has_input:
                    ds_roles[ds_name] = "SOURCE"
                elif has_input and not has_output:
                    ds_roles[ds_name] = "TARGET"
                elif has_input and has_output:
                    ds_roles[ds_name] = "LOOKUP"

        return ds_roles

    def find_sources_and_targets(self):
        roles = self._analyze_datastore_flow()
        sources = [name for name, role in roles.items() if role == "SOURCE"]
        targets = [name for name, role in roles.items() if role == "TARGET"]
        return sorted(sources), sorted(targets)

    def find_lookup_tables(self):
        roles = self._analyze_datastore_flow()
        lookups = [name for name, role in roles.items() if role == "LOOKUP"]
        return sorted(lookups)

    def get_join_conditions(self):
        joins = []

        for comp_id, comp in self.components.items():
            if comp.get("type_name") != "JOIN":
                continue

            join_info = {
                "name": comp.get("name"),
                "conditions": [],
                "inputs": [],
            }

            for cp in self.connection_points.values():
                if cp.get("i_owner_map_comp") == comp_id and cp.get("direction") == "I":
                    for conn in self.connections.values():
                        if conn.get("i_end_map_cp") == cp["i_map_cp"]:
                            source_cp_id = conn.get("i_start_map_cp")
                            source_cp = self.connection_points.get(source_cp_id)
                            if source_cp:
                                source_comp_id = source_cp.get("i_owner_map_comp")
                                source_comp = self.components.get(source_comp_id)
                                if source_comp:
                                    source_ds = self.get_component_datastore(source_comp_id)
                                    join_info["inputs"].append({
                                        "cp_name": cp.get("name"),
                                        "source_component": source_comp.get("name"),
                                        "source_datastore": source_ds,
                                    })

            for prop in self.properties.values():
                if prop.get("i_map_comp") == comp_id and prop.get("name") == "JOIN_CONDITION":
                    cond_text = self.get_expr_for_prop(prop["i_map_prop"])
                    if cond_text:
                        join_info["conditions"].append(cond_text)

            joins.append(join_info)

        return joins

    def get_filter_conditions(self):
        filters = []

        for comp_id, comp in self.components.items():
            if comp.get("type_name") != "FILTER":
                continue

            filter_info = {
                "name": comp.get("name"),
                "conditions": [],
            }

            for prop in self.properties.values():
                if prop.get("i_map_comp") == comp_id and prop.get("name") == "FILTER_CONDITION":
                    cond_text = self.get_expr_for_prop(prop["i_map_prop"])
                    if cond_text:
                        filter_info["conditions"].append(cond_text)

            filters.append(filter_info)

        return filters

    def get_aggregate_info(self):
        aggregates = []

        for comp_id, comp in self.components.items():
            if comp.get("type_name") != "AGGREGATE":
                continue

            agg_info = {
                "name": comp.get("name"),
                "group_by": [],
                "aggregations": [],
            }

            for cp in self.connection_points.values():
                if cp.get("i_owner_map_comp") == comp_id and cp.get("direction") == "O":
                    for attr in self.attributes.values():
                        if attr.get("i_owner_map_cp") == cp["i_map_cp"]:
                            expr_text = self.get_expr_for_attr(attr["i_map_attr"])
                            grp_func = attr.get("grp_func", "AUTO")

                            if expr_text:
                                if grp_func != "AUTO" or any(
                                    fn in expr_text.upper()
                                    for fn in ["SUM(", "COUNT(", "AVG(", "MIN(", "MAX("]
                                ):
                                    agg_info["aggregations"].append({
                                        "attribute": attr.get("name"),
                                        "expression": expr_text,
                                        "function": grp_func,
                                    })
                                else:
                                    agg_info["group_by"].append({
                                        "attribute": attr.get("name"),
                                        "expression": expr_text,
                                    })

            aggregates.append(agg_info)

        return aggregates

    def get_expression_components(self):
        expressions = []

        for comp_id, comp in self.components.items():
            if comp.get("type_name") != "EXPRESSION":
                continue

            expr_info = {
                "name": comp.get("name"),
                "expressions": [],
            }

            for cp in self.connection_points.values():
                if cp.get("i_owner_map_comp") == comp_id and cp.get("direction") == "O":
                    for attr in self.attributes.values():
                        if attr.get("i_owner_map_cp") == cp["i_map_cp"]:
                            expr_text = self.get_expr_for_attr(attr["i_map_attr"])
                            if expr_text:
                                expr_info["expressions"].append({
                                    "attribute": attr.get("name"),
                                    "expression": expr_text,
                                })

            expressions.append(expr_info)

        return expressions

    def get_target_attributes(self):
        target_attrs = []

        for comp_id, comp in self.components.items():
            if comp.get("type_name") != "DATASTORE":
                continue

            has_input = False
            has_output = False

            for cp in self.connection_points.values():
                if cp.get("i_owner_map_comp") != comp_id:
                    continue

                cp_id = cp["i_map_cp"]

                for conn in self.connections.values():
                    if conn.get("i_end_map_cp") == cp_id:
                        has_input = True
                    if conn.get("i_start_map_cp") == cp_id:
                        has_output = True

            if has_input and not has_output:
                ds_name = self.get_component_datastore(comp_id)

                for cp in self.connection_points.values():
                    if cp.get("i_owner_map_comp") == comp_id and cp.get("direction") == "I":
                        for attr in self.attributes.values():
                            if attr.get("i_owner_map_cp") == cp["i_map_cp"]:
                                expr_text = self.get_expr_for_attr(attr["i_map_attr"])
                                target_attrs.append({
                                    "datastore": ds_name,
                                    "attribute": attr.get("name"),
                                    "source_expression": expr_text,
                                    "is_required": attr.get("is_required") == "1",
                                    "attr_type": attr.get("attr_type"),
                                    "length": attr.get("length"),
                                    "scale": attr.get("scale"),
                                })

        return target_attrs


    def _unique_by_qualified_name(self, items):
        """
        Remove duplicate MapRef entries based on adapter type + qualified name.
        Useful for contexts, logical schemas, KMs, etc.
        """
        seen = set()
        unique_items = []

        for item in items:
            name = item.get("qualified_name")
            adapter = item.get("adapter_type")

            if name:
                key = (adapter, name)
            else:
                key = id(item)

            if key in seen:
                continue

            seen.add(key)
            unique_items.append(item)

        return unique_items

    def _unique_components(self, components):
        """
        Remove duplicate component rows when global fallback is used.

        This is intentionally conservative: it merges components that have
        the same visible documentation footprint.
        """
        seen = set()
        unique_components = []

        for comp in components:
            key = (
                comp.get("name"),
                comp.get("type_name"),
                comp.get("datastore_name"),
                comp.get("alias"),
                comp.get("description"),
            )

            if key in seen:
                continue

            seen.add(key)
            unique_components.append(comp)

        return unique_components

    def _merge_datastore_role(self, old_role, new_role):
        """
        Merge roles when multiple datastore components refer to the same table.
        """
        roles = {old_role, new_role}

        if "LOOKUP" in roles:
            return "LOOKUP"

        if "TARGET" in roles and "SOURCE" in roles:
            return "LOOKUP"

        if "TARGET" in roles:
            return "TARGET"

        if "SOURCE" in roles:
            return "SOURCE"

        return old_role or new_role or "DATASTORE"

    def get_km_usage(self):
        kms = []

        for km in self.kms.values():
            kms.append({
                "name": km.get("qualified_name"),
                "type": "KM",
            })

        return self._unique_by_qualified_name(kms)

    def get_dependencies(self):
        deps = {
            "tables": set(),
            "columns": set(),
            "models": set(),
            "submodels": set(),
            "keys": set(),
        }

        for ref in self.fk_refs:
            fq_name = ref.get("ref_obj_fq_name")
            fq_type = ref.get("ref_obj_fq_type", "")
            if not fq_name:
                continue

            if "SNP_TABLE" in fq_type:
                deps["tables"].add(fq_name)
            elif "SNP_COL" in fq_type:
                deps["columns"].add(fq_name)
            elif "SNP_MODEL" in fq_type:
                deps["models"].add(fq_name)
            elif "SNP_SUBMODEL" in fq_type:
                deps["submodels"].add(fq_name)
            elif "SNP_KEY" in fq_type:
                deps["keys"].add(fq_name)

        return {k: sorted(v) for k, v in deps.items()}

    def get_scenarios_info(self):
        scenarios_info = []

        for scen_no, scen in self.scenarios.items():
            scen_data = dict(scen)
            scen_data["steps"] = []

            for (sn, nno), step in self.scen_steps.items():
                if sn == scen_no:
                    step_data = dict(step)
                    step_data["tasks"] = []

                    for (sn2, tn), task in self.scen_tasks.items():
                        if sn2 == scen_no and task.get("nno") == nno:
                            step_data["tasks"].append(task)

                    scen_data["steps"].append(step_data)

            scenarios_info.append(scen_data)

        return scenarios_info

    def get_generated_sql(self):
        sql_statements = []

        for (scen_no, task_no), task in self.scen_tasks.items():
            def_txt = task.get("def_txt")
            col_txt = task.get("col_txt")

            if def_txt and def_txt.strip():
                sql_statements.append({
                    "scenario": scen_no,
                    "task_no": task_no,
                    "task_name1": task.get("task_name1"),
                    "task_name2": task.get("task_name2"),
                    "task_name3": task.get("task_name3"),
                    "type": "DEF",
                    "sql": def_txt.strip(),
                    "lschema": task.get("def_lschema_name"),
                    "tech": task.get("def_tech_int_name"),
                })

            if col_txt and col_txt.strip():
                sql_statements.append({
                    "scenario": scen_no,
                    "task_no": task_no,
                    "task_name1": task.get("task_name1"),
                    "task_name2": task.get("task_name2"),
                    "task_name3": task.get("task_name3"),
                    "type": "COL",
                    "sql": col_txt.strip(),
                    "lschema": task.get("col_lschema_name"),
                    "tech": task.get("col_tech_int_name"),
                })

        return sql_statements

    def get_execution_units_info(self):
        eu_info = []

        for eu_id, eu in self.exec_units.items():
            grp_name = self.exec_unit_groups.get(eu.get("i_exec_unit_grp"), {}).get("name")
            lschema_name = self.logical_schemas.get(eu.get("i_lschema_ref"), {}).get("qualified_name")
            eu_km_name = self.kms.get(eu.get("i_eu_km_ref"), {}).get("qualified_name")

            eu_info.append({
                "name": eu.get("name"),
                "business_name": eu.get("business_name"),
                "group": grp_name,
                "logical_schema": lschema_name,
                "km": eu_km_name,
            })

        return eu_info

    def get_mapping_flow(self):
        sources, targets = self.find_sources_and_targets()
        lookups = self.find_lookup_tables()

        raw_nodes = {}

        for comp_id, comp in self.components.items():
            comp_type = comp.get("type_name")

            if comp_type in [
                "DATASTORE",
                "JOIN",
                "FILTER",
                "AGGREGATE",
                "EXPRESSION",
                "SET",
                "UNION",
                "INTERSECT",
                "MINUS",
            ]:
                comp_name = comp.get("name", "Unknown")
                ds_name = self.get_component_datastore(comp_id)

                role = "TRANSFORM"
                if comp_type == "DATASTORE":
                    if ds_name in sources:
                        role = "SOURCE"
                    elif ds_name in targets:
                        role = "TARGET"
                    elif ds_name in lookups:
                        role = "LOOKUP"
                    else:
                        role = "DATASTORE"

                raw_nodes[str(comp_id).strip()] = {
                    "name": ds_name if ds_name else comp_name,
                    "type": comp_type,
                    "role": role,
                    "component_id": str(comp_id).strip(),
                }

        nodes = {}
        key_to_flow_id = {}
        flow_id_by_comp = {}

        # If fallback global mode was used, merge duplicate visible nodes
        # more aggressively to avoid duplicated diagrams.
        merge_all_duplicates = getattr(self, "scoping_fallback_used", False)

        for comp_id, node in raw_nodes.items():
            if node["type"] == "DATASTORE" and node.get("name"):
                merge_key = ("DATASTORE", node["name"])
            elif merge_all_duplicates:
                merge_key = (node["type"], node["name"])
            else:
                merge_key = ("COMPONENT", comp_id)

            if merge_key in key_to_flow_id:
                flow_id = key_to_flow_id[merge_key]

                if node["type"] == "DATASTORE":
                    nodes[flow_id]["role"] = self._merge_datastore_role(
                        nodes[flow_id].get("role"),
                        node.get("role"),
                    )
            else:
                flow_id = f"N{len(key_to_flow_id) + 1}"
                key_to_flow_id[merge_key] = flow_id
                nodes[flow_id] = dict(node)

            flow_id_by_comp[comp_id] = flow_id

        edges = set()

        for conn in self.connections.values():
            start_cp_id = str(conn.get("i_start_map_cp", "")).strip()
            end_cp_id = str(conn.get("i_end_map_cp", "")).strip()

            start_cp = self.connection_points.get(start_cp_id)
            end_cp = self.connection_points.get(end_cp_id)

            source_comp_id = None
            target_comp_id = None

            if start_cp:
                source_comp_id = str(start_cp.get("i_owner_map_comp", "")).strip()

            if end_cp:
                target_comp_id = str(end_cp.get("i_owner_map_comp", "")).strip()

            # Fallback if connection directly stores component references
            if not source_comp_id:
                source_comp_id = str(conn.get("i_start_map_comp", "")).strip()

            if not target_comp_id:
                target_comp_id = str(conn.get("i_end_map_comp", "")).strip()

            source_flow_id = flow_id_by_comp.get(source_comp_id)
            target_flow_id = flow_id_by_comp.get(target_comp_id)

            if (
                source_flow_id
                and target_flow_id
                and source_flow_id != target_flow_id
            ):
                edges.add((source_flow_id, target_flow_id))

        return {
            "nodes": nodes,
            "edges": list(edges),
        }

        for conn in self.connections.values():
            start_cp_id = str(conn.get("i_start_map_cp", "")).strip()
            end_cp_id = str(conn.get("i_end_map_cp", "")).strip()

            start_cp = self.connection_points.get(start_cp_id)
            end_cp = self.connection_points.get(end_cp_id)

            if start_cp and end_cp:
                source_comp_id = str(start_cp.get("i_owner_map_comp", "")).strip()
                target_comp_id = str(end_cp.get("i_owner_map_comp", "")).strip()

                if source_comp_id in nodes and target_comp_id in nodes:
                    edges.add((source_comp_id, target_comp_id))

        return {
            "nodes": nodes,
            "edges": list(edges),
        }

    # ---------------------------------------------------------------------
    # FINAL DICT OUTPUT
    # ---------------------------------------------------------------------

    def _to_dict_internal(self) -> dict[str, Any]:
        sources, targets = self.find_sources_and_targets()

        enriched_components = []
        for comp_id, comp in self.components.items():
            comp_copy = dict(comp)

            if comp.get("type_name") == "DATASTORE":
                comp_copy["datastore_name"] = self.get_component_datastore(comp_id)
            else:
                comp_copy["datastore_name"] = None

            enriched_components.append(comp_copy)

        # If global fallback was used, remove duplicate visible components.
        if getattr(self, "scoping_fallback_used", False):
            enriched_components = self._unique_components(enriched_components)

        return {
            "mapping": self.mapping,
            "sources": sources,
            "targets": targets,
            "lookups": self.find_lookup_tables(),
            "components": enriched_components,
            "join_conditions": self.get_join_conditions(),
            "filter_conditions": self.get_filter_conditions(),
            "aggregates": self.get_aggregate_info(),
            "expressions": self.get_expression_components(),
            "target_attributes": self.get_target_attributes(),
            "kms": self.get_km_usage(),
            "dependencies": self.get_dependencies(),
            "scenarios": self.get_scenarios_info(),
            "generated_sql": self.get_generated_sql(),
            "execution_units": self.get_execution_units_info(),
            "contexts": self._unique_by_qualified_name(list(self.contexts.values())),
            "logical_schemas": self._unique_by_qualified_name(list(self.logical_schemas.values())),
            "mapping_flow": self.get_mapping_flow(),
        }