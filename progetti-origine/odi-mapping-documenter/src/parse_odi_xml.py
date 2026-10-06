#!/usr/bin/env python3
"""
ODI 12c Mapping XML Parser
Parses SunopsisExport XML files and extracts mapping documentation.
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path


class OdiMappingParser:
    """Parses ODI 12c XML export files."""

    def __init__(self, xml_path):
        self.xml_path = Path(xml_path)
        self.tree = ET.parse(xml_path)
        self.root = self.tree.getroot()

        # Data stores
        self.mapping = {}
        self.datastores = {}       # IMapRef -> datastore info
        self.columns = {}          # IMapRef -> column info
        self.kms = {}              # IMapRef -> KM info
        self.contexts = {}         # IMapRef -> context info
        self.logical_schemas = {}  # IMapRef -> logical schema info
        self.data_types = {}       # IMapRef -> data type info
        self.keys = {}             # IMapRef -> key info

        # Mapping components
        self.components = {}       # IMapComp -> component info
        self.connection_points = {}  # IMapCp -> cp info
        self.attributes = {}       # IMapAttr -> attribute info
        self.expressions = {}      # IMapExpr -> expression info
        self.expression_refs = {}  # IMapExprRef -> expr ref info
        self.connections = {}      # IMapConn -> connection info
        self.properties = {}       # IMapProp -> property info

        # Scenarios
        self.scenarios = {}        # ScenNo -> scenario info
        self.scen_steps = {}       # (ScenNo, Nno) -> step info
        self.scen_tasks = {}       # (ScenNo, ScenTaskNo) -> task info

        # Execution
        self.exec_units = {}       # IExecUnit -> exec unit info
        self.exec_unit_groups = {} # IExecUnitGrp -> exec unit group info
        self.deploy_specs = {}     # IDeploySpec -> deploy spec info
        self.phy_nodes = {}        # IPhyNode -> phy node info

        # Dependencies (from FK references)
        self.fk_refs = []          # list of FK references

        self._parse_all()

    def _get_field(self, obj, field_name, default=None):
        """Extract field value from an Object element."""
        for field in obj.findall('Field'):
            if field.get('name') == field_name:
                text = field.text
                if text is None or text.strip().lower() == 'null':
                    return default
                return text.strip()
        return default

    def _parse_all(self):
        """Parse all objects in the XML."""
        for obj in self.root.findall('Object'):
            obj_class = obj.get('class', '')
            class_name = obj_class.split('.')[-1] if '.' in obj_class else obj_class

            if class_name == 'SnpMapping':
                self._parse_mapping(obj)
            elif class_name == 'SnpMapRef':
                self._parse_map_ref(obj)
            elif class_name == 'SnpMapComp':
                self._parse_map_comp(obj)
            elif class_name == 'SnpMapCp':
                self._parse_map_cp(obj)
            elif class_name == 'SnpMapAttr':
                self._parse_map_attr(obj)
            elif class_name == 'SnpMapExpr':
                self._parse_map_expr(obj)
            elif class_name == 'SnpMapExprRef':
                self._parse_map_expr_ref(obj)
            elif class_name == 'SnpMapConn':
                self._parse_map_conn(obj)
            elif class_name == 'SnpMapProp':
                self._parse_map_prop(obj)
            elif class_name == 'SnpScen':
                self._parse_scen(obj)
            elif class_name == 'SnpScenStep':
                self._parse_scen_step(obj)
            elif class_name == 'SnpScenTask':
                self._parse_scen_task(obj)
            elif class_name == 'SnpExecUnit':
                self._parse_exec_unit(obj)
            elif class_name == 'SnpExecUnitGrp':
                self._parse_exec_unit_grp(obj)
            elif class_name == 'SnpDeploySpec':
                self._parse_deploy_spec(obj)
            elif class_name == 'SnpPhyNode':
                self._parse_phy_node(obj)
            elif class_name == 'SnpFKXRef':
                self._parse_fk_ref(obj)

    def _parse_mapping(self, obj):
        self.mapping = {
            'name': self._get_field(obj, 'Name'),
            'description': self._get_field(obj, 'Description'),
            'business_name': self._get_field(obj, 'BusinessName'),
            'global_id': self._get_field(obj, 'GlobalId'),
            'first_date': self._get_field(obj, 'FirstDate'),
            'last_date': self._get_field(obj, 'LastDate'),
            'first_user': self._get_field(obj, 'FirstUser'),
            'last_user': self._get_field(obj, 'LastUser'),
            'i_mapping': self._get_field(obj, 'IMapping'),
            'i_folder': self._get_field(obj, 'IFolder'),
            'project_code': self._get_field(obj, 'ProjectCode'),
            'project_name': self._get_field(obj, 'ProjectName'),
        }

    def _parse_map_ref(self, obj):
        ref_id = self._get_field(obj, 'IMapRef')
        adapter_type = self._get_field(obj, 'AdapterIntfType')
        qualified_name = self._get_field(obj, 'QualifiedName')
        fco_id = self._get_field(obj, 'IFcoId')
        ref_obj_id = self._get_field(obj, 'IRefId')

        info = {
            'i_map_ref': ref_id,
            'adapter_type': adapter_type,
            'adapter_name': self._get_field(obj, 'AdapterName'),
            'qualified_name': qualified_name,
            'qualified_name2': self._get_field(obj, 'QualifiedName2'),
            'qualified_name3': self._get_field(obj, 'QualifiedName3'),
            'fco_qualified_name': self._get_field(obj, 'FcoQualifiedName'),
            'i_fco_id': fco_id,
            'i_ref_id': ref_obj_id,
            'global_id': self._get_field(obj, 'GlobalId'),
        }

        if adapter_type == 'IDataStore':
            self.datastores[ref_id] = info
        elif adapter_type == 'IColumn':
            self.columns[ref_id] = info
        elif adapter_type == 'IKnowledgeModule':
            self.kms[ref_id] = info
        elif adapter_type == 'IContext':
            self.contexts[ref_id] = info
        elif adapter_type == 'ILogicalSchema':
            self.logical_schemas[ref_id] = info
        elif adapter_type == 'IDataType':
            self.data_types[ref_id] = info
        elif adapter_type == 'IKey':
            self.keys[ref_id] = info

    def _parse_map_comp(self, obj):
        comp_id = self._get_field(obj, 'IMapComp')
        self.components[comp_id] = {
            'i_map_comp': comp_id,
            'name': self._get_field(obj, 'Name'),
            'type_name': self._get_field(obj, 'TypeName'),
            'i_map_comp_type': self._get_field(obj, 'IMapCompType'),
            'i_map_ref': self._get_field(obj, 'IMapRef'),
            'alias': self._get_field(obj, 'Alias'),
            'description': self._get_field(obj, 'Description'),
            'sort_pos': self._get_field(obj, 'SortPos'),
            'is_hidden': self._get_field(obj, 'IsHidden'),
            'global_id': self._get_field(obj, 'GlobalId'),
        }

    def _parse_map_cp(self, obj):
        cp_id = self._get_field(obj, 'IMapCp')
        self.connection_points[cp_id] = {
            'i_map_cp': cp_id,
            'name': self._get_field(obj, 'Name'),
            'direction': self._get_field(obj, 'Direction'),
            'i_owner_map_comp': self._get_field(obj, 'IOwnerMapComp'),
            'i_map_cp_role': self._get_field(obj, 'IMapCpRole'),
            'cardinality': self._get_field(obj, 'Cardinality'),
            'cp_order': self._get_field(obj, 'CpOrder'),
        }

    def _parse_map_attr(self, obj):
        attr_id = self._get_field(obj, 'IMapAttr')
        self.attributes[attr_id] = {
            'i_map_attr': attr_id,
            'name': self._get_field(obj, 'Name'),
            'i_owner_map_cp': self._get_field(obj, 'IOwnerMapCp'),
            'i_map_ref': self._get_field(obj, 'IMapRef'),
            'i_data_map_ref': self._get_field(obj, 'IDataMapRef'),
            'attr_type': self._get_field(obj, 'AttrType'),
            'length': self._get_field(obj, 'Length'),
            'scale': self._get_field(obj, 'Scale'),
            'is_required': self._get_field(obj, 'IsRequired'),
            'grp_func': self._get_field(obj, 'GrpFunc'),
            'sort_pos': self._get_field(obj, 'SortPos'),
            'global_id': self._get_field(obj, 'GlobalId'),
        }

    def _parse_map_expr(self, obj):
        expr_id = self._get_field(obj, 'IMapExpr')
        self.expressions[expr_id] = {
            'i_map_expr': expr_id,
            'txt': self._get_field(obj, 'Txt'),
            'parsed_txt': self._get_field(obj, 'ParsedTxt'),
            'i_owner_map_attr': self._get_field(obj, 'IOwnerMapAttr'),
            'i_owner_map_prop': self._get_field(obj, 'IOwnerMapProp'),
            'i_map_cp': self._get_field(obj, 'IMapCp'),
            'is_parsed': self._get_field(obj, 'IsParsed'),
            'global_id': self._get_field(obj, 'GlobalId'),
        }

    def _parse_map_expr_ref(self, obj):
        ref_id = self._get_field(obj, 'IMapExprRef')
        self.expression_refs[ref_id] = {
            'i_map_expr_ref': ref_id,
            'i_owner_map_expr': self._get_field(obj, 'IOwnerMapExpr'),
            'i_ref_map_attr': self._get_field(obj, 'IRefMapAttr'),
            'i_ref_map_comp': self._get_field(obj, 'IRefMapComp'),
            'i_ref_map_ref': self._get_field(obj, 'IRefMapRef'),
            'ref_key': self._get_field(obj, 'RefKey'),
            'ref_text': self._get_field(obj, 'RefText'),
            'i_scoping_map_cp': self._get_field(obj, 'IScopingMapCp'),
        }

    def _parse_map_conn(self, obj):
        conn_id = self._get_field(obj, 'IMapConn')
        self.connections[conn_id] = {
            'i_map_conn': conn_id,
            'name': self._get_field(obj, 'Name'),
            'i_start_map_cp': self._get_field(obj, 'IStartMapCp'),
            'i_end_map_cp': self._get_field(obj, 'IEndMapCp'),
        }

    def _parse_map_prop(self, obj):
        prop_id = self._get_field(obj, 'IMapProp')
        self.properties[prop_id] = {
            'i_map_prop': prop_id,
            'name': self._get_field(obj, 'Name'),
            'i_map_comp': self._get_field(obj, 'IMapComp'),
            'i_map_attr': self._get_field(obj, 'IMapAttr'),
            'i_map_cp': self._get_field(obj, 'IMapCp'),
            'i_mapping': self._get_field(obj, 'IMapping'),
            'i_deploy_spec': self._get_field(obj, 'IDeploySpec'),
            'i_exec_unit': self._get_field(obj, 'IExecUnit'),
            'i_prop_def': self._get_field(obj, 'IPropDef'),
            'prop_type': self._get_field(obj, 'PropType'),
            'prop_value': self._get_field(obj, 'PropValue'),
            'is_hidden': self._get_field(obj, 'IsHidden'),
        }

    def _parse_scen(self, obj):
        scen_no = self._get_field(obj, 'ScenNo')
        self.scenarios[scen_no] = {
            'scen_no': scen_no,
            'scen_name': self._get_field(obj, 'ScenName'),
            'scen_version': self._get_field(obj, 'ScenVersion'),
            'i_mapping': self._get_field(obj, 'IMapping'),
            'first_date': self._get_field(obj, 'FirstDate'),
            'last_date': self._get_field(obj, 'LastDate'),
            'first_user': self._get_field(obj, 'FirstUser'),
            'last_user': self._get_field(obj, 'LastUser'),
            'global_id': self._get_field(obj, 'GlobalId'),
        }

    def _parse_scen_step(self, obj):
        scen_no = self._get_field(obj, 'ScenNo')
        nno = self._get_field(obj, 'Nno')
        key = (scen_no, nno)
        self.scen_steps[key] = {
            'scen_no': scen_no,
            'nno': nno,
            'step_name': self._get_field(obj, 'StepName'),
            'step_type': self._get_field(obj, 'StepType'),
            'table_name': self._get_field(obj, 'TableName'),
            'res_name': self._get_field(obj, 'ResName'),
            'lschema_name': self._get_field(obj, 'LschemaName'),
            'mod_code': self._get_field(obj, 'ModCode'),
            'gen_info': self._get_field(obj, 'GenInfo'),
        }

    def _parse_scen_task(self, obj):
        scen_no = self._get_field(obj, 'ScenNo')
        task_no = self._get_field(obj, 'ScenTaskNo')
        key = (scen_no, task_no)
        self.scen_tasks[key] = {
            'scen_no': scen_no,
            'scen_task_no': task_no,
            'task_name1': self._get_field(obj, 'TaskName1'),
            'task_name2': self._get_field(obj, 'TaskName2'),
            'task_name3': self._get_field(obj, 'TaskName3'),
            'task_type': self._get_field(obj, 'TaskType'),
            'def_txt': self._get_field(obj, 'DefTxt'),
            'col_txt': self._get_field(obj, 'ColTxt'),
            'def_lschema_name': self._get_field(obj, 'DefLschemaName'),
            'col_lschema_name': self._get_field(obj, 'ColLschemaName'),
            'def_tech_int_name': self._get_field(obj, 'DefTechIntName'),
            'col_tech_int_name': self._get_field(obj, 'ColTechIntName'),
            'nno': self._get_field(obj, 'Nno'),
            'ord_trt': self._get_field(obj, 'OrdTrt'),
        }

    def _parse_exec_unit(self, obj):
        eu_id = self._get_field(obj, 'IExecUnit')
        self.exec_units[eu_id] = {
            'i_exec_unit': eu_id,
            'name': self._get_field(obj, 'Name'),
            'business_name': self._get_field(obj, 'BusinessName'),
            'i_exec_unit_grp': self._get_field(obj, 'IExecUnitGrp'),
            'i_lschema_ref': self._get_field(obj, 'ILschemaRef'),
            'i_eu_km_ref': self._get_field(obj, 'IEuKmRef'),
        }

    def _parse_exec_unit_grp(self, obj):
        grp_id = self._get_field(obj, 'IExecUnitGrp')
        self.exec_unit_groups[grp_id] = {
            'i_exec_unit_grp': grp_id,
            'name': self._get_field(obj, 'Name'),
        }

    def _parse_deploy_spec(self, obj):
        ds_id = self._get_field(obj, 'IDeploySpec')
        self.deploy_specs[ds_id] = {
            'i_deploy_spec': ds_id,
            'name': self._get_field(obj, 'Name'),
        }

    def _parse_phy_node(self, obj):
        pn_id = self._get_field(obj, 'IPhyNode')
        self.phy_nodes[pn_id] = {
            'i_phy_node': pn_id,
            'name': self._get_field(obj, 'Name'),
            'node_type': self._get_field(obj, 'NodeType'),
            'i_exec_unit': self._get_field(obj, 'IExecUnit'),
            'i_map_comp': self._get_field(obj, 'IMapComp'),
            'i_map_cp': self._get_field(obj, 'IMapCp'),
            'i_par_phy_node': self._get_field(obj, 'IParPhyNode'),
            'i_src_comp_km': self._get_field(obj, 'ISrcCompKm'),
            'i_tgt_comp_km': self._get_field(obj, 'ITgtCompKm'),
            'stage_table_name': self._get_field(obj, 'StageTableName'),
        }

    def _parse_fk_ref(self, obj):
        self.fk_refs.append({
            'ref_key': self._get_field(obj, 'RefKey'),
            'ref_obj_fq_name': self._get_field(obj, 'RefObjFQName'),
            'ref_obj_fq_type': self._get_field(obj, 'RefObjFQType'),
            'ref_obj_global_id': self._get_field(obj, 'RefObjGlobalId'),
        })

    # ---- Helper methods to reconstruct the mapping flow ----

    def _normalize_qualified_name(self, qualified_name):
        """Replace model prefix with project/database name in qualified names."""
        if not qualified_name:
            return qualified_name
        
        project_code = self.mapping.get('project_code')
        if not project_code:
            return qualified_name
        
        # If already starts with project_code, keep it as is
        if qualified_name.startswith(project_code + '.'):
            return qualified_name
        
        # Replace the first component (model name) with project_code
        parts = qualified_name.split('.')
        if len(parts) > 1:
            parts[0] = project_code
            return '.'.join(parts)
        
        return qualified_name

    def get_datastore_name(self, map_ref_id):
        """Get datastore name from a MapRef ID."""
        if map_ref_id in self.datastores:
            qualified_name = self.datastores[map_ref_id].get('qualified_name', 'Unknown')
            return self._normalize_qualified_name(qualified_name)
        return None

    def get_component_datastore(self, comp_id):
        """Get the datastore associated with a component."""
        comp = self.components.get(comp_id)
        if comp and comp.get('i_map_ref'):
            return self.get_datastore_name(comp['i_map_ref'])
        return None

    def get_cp_component(self, cp_id):
        """Get the component that owns a connection point."""
        cp = self.connection_points.get(cp_id)
        if cp:
            return cp.get('i_owner_map_comp')
        return None

    def get_expr_for_attr(self, attr_id):
        """Get the expression text for an attribute."""
        for expr in self.expressions.values():
            if expr.get('i_owner_map_attr') == attr_id:
                return expr.get('txt') or expr.get('parsed_txt')
        return None

    def get_expr_for_prop(self, prop_id):
        """Get the expression text for a property."""
        for expr in self.expressions.values():
            if expr.get('i_owner_map_prop') == prop_id:
                return expr.get('txt') or expr.get('parsed_txt')
        return None

    def get_source_attributes(self, expr_id):
        """Get source attributes referenced by an expression."""
        sources = []
        for ref in self.expression_refs.values():
            if ref.get('i_owner_map_expr') == expr_id:
                ref_attr_id = ref.get('i_ref_map_attr')
                if ref_attr_id and ref_attr_id in self.attributes:
                    sources.append({
                        'attr': self.attributes[ref_attr_id],
                        'ref_text': ref.get('ref_text'),
                        'ref_key': ref.get('ref_key'),
                    })
        return sources

    def find_sources_and_targets(self):
        """Identify source and target datastores based on connection flow."""
        sources = []
        targets = []

        for comp_id, comp in self.components.items():
            if comp.get('type_name') != 'DATASTORE':
                continue

            # Check if this datastore has only OUTPUT connections (source)
            # or only INPUT connections (target)
            has_input = False
            has_output = False

            for cp in self.connection_points.values():
                if cp.get('i_owner_map_comp') != comp_id:
                    continue
                cp_id = cp['i_map_cp']

                # Check incoming connections
                for conn in self.connections.values():
                    if conn.get('i_end_map_cp') == cp_id:
                        has_input = True
                    if conn.get('i_start_map_cp') == cp_id:
                        has_output = True

            ds_name = self.get_component_datastore(comp_id)
            if ds_name:
                if has_output and not has_input:
                    sources.append(ds_name)
                elif has_input and not has_output:
                    targets.append(ds_name)
                elif has_input and has_output:
                    # Lookup table (joined in the middle)
                    pass

        return sorted(set(sources)), sorted(set(targets))

    def find_lookup_tables(self):
        """Find datastores used as lookups (both input and output)."""
        lookups = []
        for comp_id, comp in self.components.items():
            if comp.get('type_name') != 'DATASTORE':
                continue

            has_input = False
            has_output = False

            for cp in self.connection_points.values():
                if cp.get('i_owner_map_comp') != comp_id:
                    continue
                cp_id = cp['i_map_cp']
                for conn in self.connections.values():
                    if conn.get('i_end_map_cp') == cp_id:
                        has_input = True
                    if conn.get('i_start_map_cp') == cp_id:
                        has_output = True

            if has_input and has_output:
                ds_name = self.get_component_datastore(comp_id)
                if ds_name:
                    lookups.append(ds_name)

        return sorted(set(lookups))

    def get_join_conditions(self):
        """Extract all join conditions from the mapping."""
        joins = []
        for comp_id, comp in self.components.items():
            if comp.get('type_name') != 'JOIN':
                continue

            join_info = {
                'name': comp.get('name'),
                'conditions': [],
                'inputs': [],
            }

            # Find input connection points
            for cp in self.connection_points.values():
                if cp.get('i_owner_map_comp') == comp_id and cp.get('direction') == 'I':
                    # Find what's connected to this input
                    for conn in self.connections.values():
                        if conn.get('i_end_map_cp') == cp['i_map_cp']:
                            source_cp_id = conn.get('i_start_map_cp')
                            source_cp = self.connection_points.get(source_cp_id)
                            if source_cp:
                                source_comp_id = source_cp.get('i_owner_map_comp')
                                source_comp = self.components.get(source_comp_id)
                                if source_comp:
                                    source_ds = self.get_component_datastore(source_comp_id)
                                    join_info['inputs'].append({
                                        'cp_name': cp.get('name'),
                                        'source_component': source_comp.get('name'),
                                        'source_datastore': source_ds,
                                    })

            # Find join conditions (properties with name JOIN_CONDITION)
            for prop in self.properties.values():
                if prop.get('i_map_comp') == comp_id and prop.get('name') == 'JOIN_CONDITION':
                    cond_text = self.get_expr_for_prop(prop['i_map_prop'])
                    if cond_text:
                        join_info['conditions'].append(cond_text)

            joins.append(join_info)
        return joins

    def get_filter_conditions(self):
        """Extract all filter conditions."""
        filters = []
        for comp_id, comp in self.components.items():
            if comp.get('type_name') != 'FILTER':
                continue

            filter_info = {
                'name': comp.get('name'),
                'conditions': [],
            }

            for prop in self.properties.values():
                if prop.get('i_map_comp') == comp_id and prop.get('name') == 'FILTER_CONDITION':
                    cond_text = self.get_expr_for_prop(prop['i_map_prop'])
                    if cond_text:
                        filter_info['conditions'].append(cond_text)

            filters.append(filter_info)
        return filters

    def get_aggregate_info(self):
        """Extract aggregation information."""
        aggregates = []
        for comp_id, comp in self.components.items():
            if comp.get('type_name') != 'AGGREGATE':
                continue

            agg_info = {
                'name': comp.get('name'),
                'group_by': [],
                'aggregations': [],
            }

            # Get output attributes
            for cp in self.connection_points.values():
                if cp.get('i_owner_map_comp') == comp_id and cp.get('direction') == 'O':
                    for attr in self.attributes.values():
                        if attr.get('i_owner_map_cp') == cp['i_map_cp']:
                            expr_text = self.get_expr_for_attr(attr['i_map_attr'])
                            grp_func = attr.get('grp_func', 'AUTO')
                            if expr_text:
                                if grp_func != 'AUTO' or (expr_text and any(
                                    fn in expr_text.upper() for fn in ['SUM(', 'COUNT(', 'AVG(', 'MIN(', 'MAX(']
                                )):
                                    agg_info['aggregations'].append({
                                        'attribute': attr.get('name'),
                                        'expression': expr_text,
                                        'function': grp_func,
                                    })
                                else:
                                    agg_info['group_by'].append({
                                        'attribute': attr.get('name'),
                                        'expression': expr_text,
                                    })

            aggregates.append(agg_info)
        return aggregates

    def get_expression_components(self):
        """Extract custom expression components."""
        expressions = []
        for comp_id, comp in self.components.items():
            if comp.get('type_name') != 'EXPRESSION':
                continue

            expr_info = {
                'name': comp.get('name'),
                'expressions': [],
            }

            for cp in self.connection_points.values():
                if cp.get('i_owner_map_comp') == comp_id and cp.get('direction') == 'O':
                    for attr in self.attributes.values():
                        if attr.get('i_owner_map_cp') == cp['i_map_cp']:
                            expr_text = self.get_expr_for_attr(attr['i_map_attr'])
                            if expr_text:
                                expr_info['expressions'].append({
                                    'attribute': attr.get('name'),
                                    'expression': expr_text,
                                })

            expressions.append(expr_info)
        return expressions

    def get_target_attributes(self):
        """Get attributes mapped to target datastores."""
        target_attrs = []
        for comp_id, comp in self.components.items():
            if comp.get('type_name') != 'DATASTORE':
                continue

            # Check if it's a target (has input but no output)
            has_input = False
            has_output = False
            for cp in self.connection_points.values():
                if cp.get('i_owner_map_comp') != comp_id:
                    continue
                cp_id = cp['i_map_cp']
                for conn in self.connections.values():
                    if conn.get('i_end_map_cp') == cp_id:
                        has_input = True
                    if conn.get('i_start_map_cp') == cp_id:
                        has_output = True

            if has_input and not has_output:
                ds_name = self.get_component_datastore(comp_id)
                for cp in self.connection_points.values():
                    if cp.get('i_owner_map_comp') == comp_id and cp.get('direction') == 'I':
                        for attr in self.attributes.values():
                            if attr.get('i_owner_map_cp') == cp['i_map_cp']:
                                expr_text = self.get_expr_for_attr(attr['i_map_attr'])
                                target_attrs.append({
                                    'datastore': ds_name,
                                    'attribute': attr.get('name'),
                                    'source_expression': expr_text,
                                    'is_required': attr.get('is_required') == '1',
                                    'length': attr.get('length'),
                                    'scale': attr.get('scale'),
                                })
        return target_attrs

    def get_km_usage(self):
        """Get knowledge modules used in the mapping."""
        km_list = []
        for ref_id, km in self.kms.items():
            km_list.append({
                'name': km.get('qualified_name'),
                'type': 'KM',
            })
        return km_list

    def get_dependencies(self):
        """Extract dependencies from FK references."""
        deps = {
            'tables': set(),
            'columns': set(),
            'models': set(),
            'submodels': set(),
            'keys': set(),
        }

        for ref in self.fk_refs:
            fq_name = ref.get('ref_obj_fq_name')
            fq_type = ref.get('ref_obj_fq_type')
            if not fq_name:
                continue

            parts = fq_name.split('.')
            if 'SNP_TABLE' in (fq_type or ''):
                deps['tables'].add(fq_name)
            elif 'SNP_COL' in (fq_type or ''):
                deps['columns'].add(fq_name)
            elif 'SNP_MODEL' in (fq_type or ''):
                deps['models'].add(fq_name)
            elif 'SNP_SUBMODEL' in (fq_type or ''):
                deps['submodels'].add(fq_name)
            elif 'SNP_KEY' in (fq_type or ''):
                deps['keys'].add(fq_name)

        return {k: sorted(v) for k, v in deps.items()}

    def get_scenarios_info(self):
        """Get scenario information with their tasks."""
        scenarios_info = []
        for scen_no, scen in self.scenarios.items():
            scen_data = dict(scen)
            scen_data['steps'] = []

            # Find steps for this scenario
            for (sn, nno), step in self.scen_steps.items():
                if sn == scen_no:
                    step_data = dict(step)
                    step_data['tasks'] = []

                    # Find tasks for this step
                    for (sn2, tn), task in self.scen_tasks.items():
                        if sn2 == scen_no and task.get('nno') == nno:
                            step_data['tasks'].append(task)

                    scen_data['steps'].append(step_data)

            scenarios_info.append(scen_data)
        return scenarios_info

    def get_generated_sql(self):
        """Extract generated SQL from scenario tasks."""
        sql_statements = []
        for (scen_no, task_no), task in self.scen_tasks.items():
            def_txt = task.get('def_txt')
            col_txt = task.get('col_txt')
            if def_txt and def_txt.strip():
                sql_statements.append({
                    'scenario': scen_no,
                    'task_no': task_no,
                    'task_name1': task.get('task_name1'),
                    'task_name2': task.get('task_name2'),
                    'task_name3': task.get('task_name3'),
                    'type': 'DEF',
                    'sql': def_txt.strip(),
                    'lschema': task.get('def_lschema_name'),
                    'tech': task.get('def_tech_int_name'),
                })
            if col_txt and col_txt.strip():
                sql_statements.append({
                    'scenario': scen_no,
                    'task_no': task_no,
                    'task_name1': task.get('task_name1'),
                    'task_name2': task.get('task_name2'),
                    'task_name3': task.get('task_name3'),
                    'type': 'COL',
                    'sql': col_txt.strip(),
                    'lschema': task.get('col_lschema_name'),
                    'tech': task.get('col_tech_int_name'),
                })
        return sql_statements

    def get_execution_units_info(self):
        """Get execution units with their groups and logical schemas."""
        eu_info = []
        for eu_id, eu in self.exec_units.items():
            grp_name = None
            if eu.get('i_exec_unit_grp') in self.exec_unit_groups:
                grp_name = self.exec_unit_groups[eu['i_exec_unit_grp']].get('name')

            lschema_name = None
            if eu.get('i_lschema_ref') in self.logical_schemas:
                lschema_name = self.logical_schemas[eu['i_lschema_ref']].get('qualified_name')

            eu_km_name = None
            if eu.get('i_eu_km_ref') in self.kms:
                eu_km_name = self.kms[eu['i_eu_km_ref']].get('qualified_name')

            eu_info.append({
                'name': eu.get('name'),
                'business_name': eu.get('business_name'),
                'group': grp_name,
                'logical_schema': lschema_name,
                'km': eu_km_name,
            })
        return eu_info

    def to_dict(self):
        """Export the parsed data as a dictionary."""
        sources, targets = self.find_sources_and_targets()
        return {
            'mapping': self.mapping,
            'sources': sources,
            'targets': targets,
            'lookups': self.find_lookup_tables(),
            'components': list(self.components.values()),
            'join_conditions': self.get_join_conditions(),
            'filter_conditions': self.get_filter_conditions(),
            'aggregates': self.get_aggregate_info(),
            'expressions': self.get_expression_components(),
            'target_attributes': self.get_target_attributes(),
            'kms': self.get_km_usage(),
            'dependencies': self.get_dependencies(),
            'scenarios': self.get_scenarios_info(),
            'generated_sql': self.get_generated_sql(),
            'execution_units': self.get_execution_units_info(),
            'contexts': [c for c in self.contexts.values()],
            'logical_schemas': [ls for ls in self.logical_schemas.values()],
        }


def generate_technical_markdown(data, output_path):
    """Generate technical documentation in Markdown."""
    m = data['mapping']
    lines = []
    lines.append(f"# Documentazione Tecnica - Mapping: {m.get('name', 'N/A')}")
    lines.append("")
    lines.append("## Informazioni Generali")
    lines.append("")
    lines.append("| Campo | Valore |")
    lines.append("|-------|--------|")
    lines.append(f"| **Nome Mapping** | {m.get('name', 'N/A')} |")
    if m.get('description'):
        lines.append(f"| **Descrizione** | {m.get('description')} |")
    lines.append(f"| **Global ID** | `{m.get('global_id', 'N/A')}` |")
    lines.append(f"| **Creato il** | {m.get('first_date', 'N/A')} |")
    lines.append(f"| **Ultima modifica** | {m.get('last_date', 'N/A')} |")
    lines.append(f"| **Creato da** | {m.get('first_user', 'N/A')} |")
    lines.append(f"| **Ultimo utente** | {m.get('last_user', 'N/A')} |")
    lines.append("")

    # Contexts and Logical Schemas
    if data.get('contexts'):
        lines.append("## Contesti")
        lines.append("")
        for ctx in data['contexts']:
            lines.append(f"- **{ctx.get('qualified_name', 'N/A')}**")
        lines.append("")

    if data.get('logical_schemas'):
        lines.append("## Logical Schema Coinvolti")
        lines.append("")
        for ls in data['logical_schemas']:
            lines.append(f"- `{ls.get('qualified_name', 'N/A')}`")
        lines.append("")

    # Dataflow Overview
    lines.append("## Flusso Dati")
    lines.append("")
    lines.append("### Sorgenti")
    lines.append("")
    for src in data.get('sources', []):
        lines.append(f"- `{src}`")
    lines.append("")

    lines.append("### Target")
    lines.append("")
    for tgt in data.get('targets', []):
        lines.append(f"- `{tgt}`")
    lines.append("")

    if data.get('lookups'):
        lines.append("### Tabelle di Lookup")
        lines.append("")
        for lk in data['lookups']:
            lines.append(f"- `{lk}`")
        lines.append("")

    # Components
    lines.append("## Componenti del Mapping")
    lines.append("")
    lines.append("| Componente | Tipo | Datastore Associato |")
    lines.append("|------------|------|---------------------|")
    for comp in data.get('components', []):
        ds = ""
        if comp.get('type_name') == 'DATASTORE' and comp.get('i_map_ref'):
            # Find datastore name
            for ref_id, ds_info in {k: v for k, v in []}.items():
                pass
        lines.append(f"| {comp.get('name', 'N/A')} | {comp.get('type_name', 'N/A')} | - |")
    lines.append("")

    # Join Conditions
    joins = data.get('join_conditions', [])
    if joins:
        lines.append("## Condizioni di JOIN")
        lines.append("")
        for join in joins:
            lines.append(f"### {join.get('name', 'JOIN')}")
            lines.append("")
            if join.get('inputs'):
                lines.append("**Input:**")
                lines.append("")
                for inp in join['inputs']:
                    ds = inp.get('source_datastore') or inp.get('source_component')
                    lines.append(f"- `{inp.get('cp_name')}` ← `{ds}` (componente: `{inp.get('source_component')}`)")
                lines.append("")
            if join.get('conditions'):
                lines.append("**Condizioni:**")
                lines.append("")
                for cond in join['conditions']:
                    lines.append(f"- `{cond}`")
                lines.append("")

    # Filter Conditions
    filters = data.get('filter_conditions', [])
    if filters:
        lines.append("## Filtri")
        lines.append("")
        for filt in filters:
            lines.append(f"### {filt.get('name', 'FILTER')}")
            lines.append("")
            for cond in filt.get('conditions', []):
                lines.append(f"- `{cond}`")
            lines.append("")

    # Aggregations
    aggs = data.get('aggregates', [])
    if aggs:
        lines.append("## Aggregazioni")
        lines.append("")
        for agg in aggs:
            lines.append(f"### {agg.get('name', 'AGGREGATE')}")
            lines.append("")
            if agg.get('group_by'):
                lines.append("**GROUP BY:**")
                lines.append("")
                lines.append("| Attributo | Espressione |")
                lines.append("|-----------|-------------|")
                for gb in agg['group_by']:
                    lines.append(f"| `{gb.get('attribute')}` | `{gb.get('expression')}` |")
                lines.append("")
            if agg.get('aggregations'):
                lines.append("**Aggregazioni:**")
                lines.append("")
                lines.append("| Attributo | Espressione | Funzione |")
                lines.append("|-----------|-------------|----------|")
                for ag in agg['aggregations']:
                    lines.append(f"| `{ag.get('attribute')}` | `{ag.get('expression')}` | {ag.get('function', 'N/A')} |")
                lines.append("")

    # Custom Expressions
    exprs = data.get('expressions', [])
    if exprs:
        lines.append("## Espressioni Personalizzate")
        lines.append("")
        for expr_comp in exprs:
            lines.append(f"### {expr_comp.get('name', 'EXPRESSION')}")
            lines.append("")
            lines.append("| Attributo di Output | Espressione |")
            lines.append("|---------------------|-------------|")
            for e in expr_comp.get('expressions', []):
                lines.append(f"| `{e.get('attribute')}` | `{e.get('expression')}` |")
            lines.append("")

    # Target Attributes
    tgt_attrs = data.get('target_attributes', [])
    if tgt_attrs:
        lines.append("## Mappatura Attributi Target")
        lines.append("")
        # Group by datastore
        by_ds = defaultdict(list)
        for ta in tgt_attrs:
            by_ds[ta.get('datastore', 'Unknown')].append(ta)

        for ds_name, attrs in by_ds.items():
            lines.append(f"### `{ds_name}`")
            lines.append("")
            lines.append("| Colonna Target | Espressione Sorgente | Obbligatorio | Lunghezza | Scala |")
            lines.append("|----------------|---------------------|--------------|-----------|-------|")
            for a in attrs:
                req = "✓" if a.get('is_required') else ""
                lines.append(f"| `{a.get('attribute')}` | `{a.get('source_expression', 'N/A')}` | {req} | {a.get('length', '')} | {a.get('scale', '')} |")
            lines.append("")

    # Knowledge Modules
    kms = data.get('kms', [])
    if kms:
        lines.append("## Knowledge Modules Utilizzati")
        lines.append("")
        for km in kms:
            lines.append(f"- `{km.get('name')}`")
        lines.append("")

    # Execution Units
    eus = data.get('execution_units', [])
    if eus:
        lines.append("## Execution Units")
        lines.append("")
        lines.append("| Nome | Business Name | Gruppo | Logical Schema | KM |")
        lines.append("|------|--------------|--------|----------------|-----|")
        for eu in eus:
            lines.append(f"| `{eu.get('name')}` | {eu.get('business_name', '') or ''} | {eu.get('group', '') or ''} | `{eu.get('logical_schema', '') or ''}` | `{eu.get('km', '') or ''}` |")
        lines.append("")

    # Scenarios
    scenarios = data.get('scenarios', [])
    if scenarios:
        lines.append("## Scenari")
        lines.append("")
        for scen in scenarios:
            lines.append(f"### {scen.get('scen_name', 'N/A')} (v{scen.get('scen_version', 'N/A')})")
            lines.append("")
            lines.append(f"- **Numero Scenario:** {scen.get('scen_no')}")
            lines.append(f"- **Creato il:** {scen.get('first_date', 'N/A')}")
            lines.append(f"- **Ultima modifica:** {scen.get('last_date', 'N/A')}")
            lines.append(f"- **Autore:** {scen.get('first_user', 'N/A')}")
            lines.append("")

            for step in scen.get('steps', []):
                lines.append(f"#### Step: {step.get('step_name', 'N/A')}")
                lines.append("")
                lines.append(f"- **Tabella:** `{step.get('table_name', 'N/A')}`")
                lines.append(f"- **Logical Schema:** `{step.get('lschema_name', 'N/A')}`")
                lines.append(f"- **Modello:** `{step.get('mod_code', 'N/A')}`")
                lines.append("")

                if step.get('tasks'):
                    lines.append("**Task:**")
                    lines.append("")
                    lines.append("| # | Nome Task | KM | Tipo |")
                    lines.append("|---|-----------|-----|------|")
                    for task in step['tasks']:
                        lines.append(f"| {task.get('scen_task_no')} | {task.get('task_name1', '')} / {task.get('task_name2', '')} | {task.get('task_name3', '') or ''} | {task.get('task_type', '')} |")
                    lines.append("")

    # Generated SQL
    sql_stmts = data.get('generated_sql', [])
    if sql_stmts:
        lines.append("## SQL Generato")
        lines.append("")
        lines.append("> Di seguito è riportato l'SQL generato dai task degli scenari.")
        lines.append("")
        for stmt in sql_stmts:
            lines.append(f"### Task {stmt.get('task_no')} - {stmt.get('task_name1', '')} / {stmt.get('task_name2', '')}")
            if stmt.get('task_name3'):
                lines.append(f"*{stmt.get('task_name3')}*")
            lines.append("")
            lines.append(f"- **Logical Schema:** `{stmt.get('lschema', 'N/A')}`")
            lines.append(f"- **Tecnologia:** `{stmt.get('tech', 'N/A')}`")
            lines.append(f"- **Tipo:** {stmt.get('type')}")
            lines.append("")
            lines.append("```sql")
            lines.append(stmt.get('sql', ''))
            lines.append("```")
            lines.append("")

    # Dependencies
    deps = data.get('dependencies', {})
    if any(deps.values()):
        lines.append("## Dipendenze")
        lines.append("")
        if deps.get('tables'):
            lines.append("### Tabelle")
            lines.append("")
            for t in deps['tables']:
                lines.append(f"- `{t}`")
            lines.append("")
        if deps.get('columns'):
            lines.append("### Colonne")
            lines.append("")
            for c in deps['columns']:
                lines.append(f"- `{c}`")
            lines.append("")
        if deps.get('models'):
            lines.append("### Modelli")
            lines.append("")
            for m in deps['models']:
                lines.append(f"- `{m}`")
            lines.append("")
        if deps.get('keys'):
            lines.append("### Chiavi")
            lines.append("")
            for k in deps['keys']:
                lines.append(f"- `{k}`")
            lines.append("")

    content = "\n".join(lines)
    Path(output_path).write_text(content, encoding='utf-8')
    return content


def generate_business_markdown(data, output_path):
    """Generate business-friendly documentation in Markdown."""
    m = data['mapping']
    lines = []
    lines.append(f"# Documentazione Business - Mapping: {m.get('name', 'N/A')}")
    lines.append("")
    lines.append("## Scopo del Mapping")
    lines.append("")

    # Build a narrative description
    sources = data.get('sources', [])
    targets = data.get('targets', [])
    lookups = data.get('lookups', [])

    lines.append("Questo mapping esegue le seguenti operazioni:")
    lines.append("")

    # Describe the flow
    if sources:
        src_list = ", ".join([f"`{s.split('.')[-1]}`" for s in sources])
        lines.append(f"1. **Legge i dati** dalle tabelle sorgente: {src_list}")

    if lookups:
        lk_list = ", ".join([f"`{l.split('.')[-1]}`" for l in lookups])
        lines.append(f"2. **Arricchisce i dati** attraverso join con tabelle di riferimento: {lk_list}")

    # Describe transformations
    transforms = []
    if data.get('join_conditions'):
        transforms.append(f"{len(data['join_conditions'])} operazioni di JOIN")
    if data.get('aggregates'):
        transforms.append("operazioni di aggregazione (raggruppamento e calcolo totali)")
    if data.get('filter_conditions'):
        transforms.append("applicazioni di filtri sui dati")
    if data.get('expressions'):
        transforms.append("calcolo di espressioni personalizzate")

    if transforms:
        lines.append(f"3. **Trasforma i dati** mediante: {', '.join(transforms)}")

    if targets:
        tgt_list = ", ".join([f"`{t.split('.')[-1]}`" for t in targets])
        lines.append(f"4. **Scrive i risultati** nelle tabelle target: {tgt_list}")
    lines.append("")

    # Business rules
    lines.append("## Regole di Business")
    lines.append("")

    # Joins
    joins = data.get('join_conditions', [])
    if joins:
        lines.append("### Relazioni tra Entità")
        lines.append("")
        for join in joins:
            inputs = join.get('inputs', [])
            conditions = join.get('conditions', [])
            if len(inputs) >= 2 and conditions:
                ds_names = [inp.get('source_datastore', '').split('.')[-1] for inp in inputs if inp.get('source_datastore')]
                if len(ds_names) >= 2:
                    lines.append(f"- **{ds_names[0]}** si collega a **{ds_names[1]}** tramite: `{conditions[0]}`")
        lines.append("")

    # Filters
    filters = data.get('filter_conditions', [])
    if filters:
        lines.append("### Filtri Applicati")
        lines.append("")
        lines.append("Solo i dati che soddisfano le seguenti condizioni vengono inclusi nel risultato:")
        lines.append("")
        for filt in filters:
            for cond in filt.get('conditions', []):
                lines.append(f"- `{cond}`")
        lines.append("")

    # Aggregations
    aggs = data.get('aggregates', [])
    if aggs:
        lines.append("### Aggregazioni")
        lines.append("")
        for agg in aggs:
            if agg.get('aggregations'):
                lines.append("Vengono calcolati i seguenti totali:")
                lines.append("")
                for ag in agg['aggregations']:
                    lines.append(f"- **{ag.get('attribute')}**: `{ag.get('expression')}`")
                lines.append("")

    # Custom expressions
    exprs = data.get('expressions', [])
    if exprs:
        lines.append("### Calcoli Personalizzati")
        lines.append("")
        for expr_comp in exprs:
            for e in expr_comp.get('expressions', []):
                attr = e.get('attribute', '')
                expr = e.get('expression', '')
                # Try to explain in business terms
                if 'PERCENTUALE' in attr.upper():
                    lines.append(f"- **{attr}**: calcola la percentuale come `{expr}`")
                elif 'RISCHIO' in attr.upper() or 'LIVELLO' in attr.upper():
                    lines.append(f"- **{attr}**: classifica il livello di rischio in base all'importo")
                elif 'ANNO' in attr.upper():
                    lines.append(f"- **{attr}**: estrae l'anno dalla data di riferimento")
                elif 'DATA_CARICAMENTO' in attr.upper():
                    lines.append(f"- **{attr}**: timestamp di caricamento del dato (data corrente)")
                else:
                    lines.append(f"- **{attr}**: `{expr}`")
        lines.append("")

    # Target summary
    tgt_attrs = data.get('target_attributes', [])
    if tgt_attrs:
        lines.append("## Risultato Finale")
        lines.append("")
        lines.append("Il mapping produce i seguenti dati in output:")
        lines.append("")
        by_ds = defaultdict(list)
        for ta in tgt_attrs:
            by_ds[ta.get('datastore', 'Unknown')].append(ta)

        for ds_name, attrs in by_ds.items():
            lines.append(f"### Tabella `{ds_name.split('.')[-1]}`")
            lines.append("")
            lines.append("| Campo | Descrizione |")
            lines.append("|-------|-------------|")
            for a in attrs:
                attr_name = a.get('attribute', '')
                expr = a.get('source_expression', '')
                # Generate business description
                desc = _business_description(attr_name, expr)
                lines.append(f"| **{attr_name}** | {desc} |")
            lines.append("")

    # Scenarios
    scenarios = data.get('scenarios', [])
    if scenarios:
        lines.append("## Esecuzione")
        lines.append("")
        lines.append("Il mapping è disponibile attraverso i seguenti scenari:")
        lines.append("")
        for scen in scenarios:
            lines.append(f"- **{scen.get('scen_name', 'N/A')}** (versione {scen.get('scen_version', 'N/A')})")
        lines.append("")

    # Metadata
    lines.append("---")
    lines.append("")
    lines.append("*Documento generato automaticamente dall'XML di ODI 12c*")
    lines.append(f"*Mapping: {m.get('name', 'N/A')}*")
    lines.append(f"*Ultima modifica: {m.get('last_date', 'N/A')}*")

    content = "\n".join(lines)
    Path(output_path).write_text(content, encoding='utf-8')
    return content


def _business_description(attr_name, expression):
    """Generate a business-friendly description for an attribute."""
    name_upper = attr_name.upper()
    expr_upper = (expression or '').upper()

    if 'ID_' in name_upper:
        entity = name_upper.replace('ID_', '').replace('_', ' ').title()
        return f"Identificativo univoco di {entity.lower()}"
    elif 'DESCRIZIONE' in name_upper or 'DESCR_' in name_upper:
        return "Descrizione testuale dell'elemento"
    elif 'IMPORTO_APPROVATO' in name_upper:
        return "Importo finanziario approvato per il progetto"
    elif 'IMPORTO_EROGATO' in name_upper or 'TOTALE_EROGATO' in name_upper:
        return "Importo totale erogato"
    elif 'DATA_APPROVAZIONE' in name_upper:
        return "Data di approvazione"
    elif 'ANNO_APPROVAZIONE' in name_upper:
        return "Anno di approvazione (estratto dalla data)"
    elif 'DATA_CARICAMENTO' in name_upper:
        return "Data e ora di caricamento del dato nel sistema"
    elif 'STATO' in name_upper:
        return "Stato attuale del progetto"
    elif 'REGIONE' in name_upper:
        return "Regione geografica di riferimento"
    elif 'AREA_GEOGRAFICA' in name_upper:
        return "Area geografica di classificazione"
    elif 'PERCENTUALE_EROGATA' in name_upper:
        return "Percentuale di importo erogato rispetto all'approvato"
    elif 'LIVELLO_RISCHIO' in name_upper:
        return "Classificazione del livello di rischio (ALTO/MEDIO/BASSO)"
    elif 'NOME_PROGETTO' in name_upper:
        return "Nome/denominazione del progetto"
    elif 'CODICE' in name_upper:
        return "Codice identificativo"
    else:
        return f"Valore derivato: `{expression}`" if expression else "Dato mappato dalla sorgente"


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if len(sys.argv) < 2:
        print("Usage: parse_odi_xml.py <xml_file> [--output-dir <dir>] [--format technical|business|both]")
        sys.exit(1)

    xml_file = sys.argv[1]
    output_dir = Path('.')
    format_type = 'both'

    # Parse arguments
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--output-dir' and i + 1 < len(sys.argv):
            output_dir = Path(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == '--format' and i + 1 < len(sys.argv):
            format_type = sys.argv[i + 1]
            i += 2
        else:
            i += 1

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Parsing ODI XML: {xml_file}")
    parser = OdiMappingParser(xml_file)
    data = parser.to_dict()

    mapping_name = data['mapping'].get('name', 'mapping')
    safe_name = re.sub(r'[^\w\-]', '_', mapping_name)

    if format_type in ('technical', 'both'):
        tech_path = output_dir / f"{safe_name}_TECNICO.md"
        generate_technical_markdown(data, tech_path)
        print(f"✓ Technical documentation: {tech_path}")

    if format_type in ('business', 'both'):
        bus_path = output_dir / f"{safe_name}_BUSINESS.md"
        generate_business_markdown(data, bus_path)
        print(f"✓ Business documentation: {bus_path}")


if __name__ == '__main__':
    main()
