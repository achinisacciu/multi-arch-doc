# Categoria: fixture
# File sorgente: src/parser.py
# Creato: 2026-07-17
# Descrizione: genera un XML SunopsisExport ODI 12c sintetico e deterministico
#               per i test, senza dipendenze esterne (nessun file su disco richiesto).

def build_sample_mapping_xml() -> str:
    """Ritorna una stringa XML ODI 12c rappresentante un mapping con:
    - 1 sorgente (SRC), 1 target (TGT), 1 lookup (LKP)
    - 1 JOIN, 1 FILTER, 1 AGGREGATE, 1 EXPRESSION
    - espressioni, attributi, properties, scenario con task SQL
    - 1 FK reference (dipendenza)
    """
    return """<?xml version="1.0" encoding="UTF-8"?>
<SunopsisExport>
  <Object class="oracle.odi.domain.mapping.SnpMapping">
    <Field name="Name">MAPPING_TEST</Field>
    <Field name="Description">Mapping di test sintetico</Field>
    <Field name="BusinessName">Mapping Test</Field>
    <Field name="GlobalId">GID_MAP</Field>
    <Field name="FirstDate">2024-01-01</Field>
    <Field name="LastDate">2024-02-01</Field>
    <Field name="FirstUser">user1</Field>
    <Field name="LastUser">user2</Field>
    <Field name="IMapping">1</Field>
    <Field name="IFolder">10</Field>
  </Object>

  <Object class="oracle.odi.domain.mapping.SnpMapRef">
    <Field name="IMapRef">R1</Field>
    <Field name="AdapterIntfType">IDataStore</Field>
    <Field name="AdapterName">SRC_DS</Field>
    <Field name="QualifiedName">SRC_SCHEMA.SRC_TABLE</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapRef">
    <Field name="IMapRef">R2</Field>
    <Field name="AdapterIntfType">IDataStore</Field>
    <Field name="AdapterName">TGT_DS</Field>
    <Field name="QualifiedName">TGT_SCHEMA.TGT_TABLE</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapRef">
    <Field name="IMapRef">R3</Field>
    <Field name="AdapterIntfType">IDataStore</Field>
    <Field name="AdapterName">LKP_DS</Field>
    <Field name="QualifiedName">LKP_SCHEMA.LKP_TABLE</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapRef">
    <Field name="IMapRef">R4</Field>
    <Field name="AdapterIntfType">IKnowledgeModule</Field>
    <Field name="QualifiedName">KM_TEST</Field>
  </Object>

  <Object class="oracle.odi.domain.mapping.SnpMapComp">
    <Field name="IMapComp">C1</Field>
    <Field name="Name">SRC_COMP</Field>
    <Field name="TypeName">DATASTORE</Field>
    <Field name="IMapRef">R1</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapComp">
    <Field name="IMapComp">C2</Field>
    <Field name="Name">TGT_COMP</Field>
    <Field name="TypeName">DATASTORE</Field>
    <Field name="IMapRef">R2</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapComp">
    <Field name="IMapComp">C3</Field>
    <Field name="Name">LKP_COMP</Field>
    <Field name="TypeName">DATASTORE</Field>
    <Field name="IMapRef">R3</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapComp">
    <Field name="IMapComp">C4</Field>
    <Field name="Name">JOIN_COMP</Field>
    <Field name="TypeName">JOIN</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapComp">
    <Field name="IMapComp">C5</Field>
    <Field name="Name">FILTER_COMP</Field>
    <Field name="TypeName">FILTER</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapComp">
    <Field name="IMapComp">C6</Field>
    <Field name="Name">AGG_COMP</Field>
    <Field name="TypeName">AGGREGATE</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapComp">
    <Field name="IMapComp">C7</Field>
    <Field name="Name">EXPR_COMP</Field>
    <Field name="TypeName">EXPRESSION</Field>
  </Object>

  <Object class="oracle.odi.domain.mapping.SnpMapCp">
    <Field name="IMapCp">P1</Field>
    <Field name="Name">OUT_SRC</Field>
    <Field name="Direction">O</Field>
    <Field name="IOwnerMapComp">C1</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapCp">
    <Field name="IMapCp">P2</Field>
    <Field name="Name">IN_JOIN</Field>
    <Field name="Direction">I</Field>
    <Field name="IOwnerMapComp">C4</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapCp">
    <Field name="IMapCp">P3</Field>
    <Field name="Name">OUT_JOIN</Field>
    <Field name="Direction">O</Field>
    <Field name="IOwnerMapComp">C4</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapCp">
    <Field name="IMapCp">P4</Field>
    <Field name="Name">IN_FILTER</Field>
    <Field name="Direction">I</Field>
    <Field name="IOwnerMapComp">C5</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapCp">
    <Field name="IMapCp">P5</Field>
    <Field name="Name">OUT_FILTER</Field>
    <Field name="Direction">O</Field>
    <Field name="IOwnerMapComp">C5</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapCp">
    <Field name="IMapCp">P6</Field>
    <Field name="Name">IN_AGG</Field>
    <Field name="Direction">I</Field>
    <Field name="IOwnerMapComp">C6</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapCp">
    <Field name="IMapCp">P7</Field>
    <Field name="Name">OUT_AGG</Field>
    <Field name="Direction">O</Field>
    <Field name="IOwnerMapComp">C6</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapCp">
    <Field name="IMapCp">P8</Field>
    <Field name="Name">IN_EXPR</Field>
    <Field name="Direction">I</Field>
    <Field name="IOwnerMapComp">C7</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapCp">
    <Field name="IMapCp">P9</Field>
    <Field name="Name">OUT_EXPR</Field>
    <Field name="Direction">O</Field>
    <Field name="IOwnerMapComp">C7</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapCp">
    <Field name="IMapCp">P10</Field>
    <Field name="Name">IN_TGT</Field>
    <Field name="Direction">I</Field>
    <Field name="IOwnerMapComp">C2</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapCp">
    <Field name="IMapCp">P11</Field>
    <Field name="Name">IN_LKP</Field>
    <Field name="Direction">I</Field>
    <Field name="IOwnerMapComp">C3</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapCp">
    <Field name="IMapCp">P12</Field>
    <Field name="Name">OUT_LKP</Field>
    <Field name="Direction">O</Field>
    <Field name="IOwnerMapComp">C3</Field>
  </Object>

  <Object class="oracle.odi.domain.mapping.SnpMapConn">
    <Field name="IMapConn">K1</Field>
    <Field name="Name">SRC_TO_JOIN</Field>
    <Field name="IStartMapCp">P1</Field>
    <Field name="IEndMapCp">P2</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapConn">
    <Field name="IMapConn">K2</Field>
    <Field name="Name">JOIN_TO_FILTER</Field>
    <Field name="IStartMapCp">P3</Field>
    <Field name="IEndMapCp">P4</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapConn">
    <Field name="IMapConn">K3</Field>
    <Field name="Name">FILTER_TO_AGG</Field>
    <Field name="IStartMapCp">P5</Field>
    <Field name="IEndMapCp">P6</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapConn">
    <Field name="IMapConn">K4</Field>
    <Field name="Name">AGG_TO_EXPR</Field>
    <Field name="IStartMapCp">P7</Field>
    <Field name="IEndMapCp">P8</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapConn">
    <Field name="IMapConn">K5</Field>
    <Field name="Name">EXPR_TO_TGT</Field>
    <Field name="IStartMapCp">P9</Field>
    <Field name="IEndMapCp">P10</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapConn">
    <Field name="IMapConn">K6</Field>
    <Field name="Name">LKP_TO_JOIN</Field>
    <Field name="IStartMapCp">P12</Field>
    <Field name="IEndMapCp">P2</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapConn">
    <Field name="IMapConn">K7</Field>
    <Field name="Name">SRC_TO_LKP</Field>
    <Field name="IStartMapCp">P1</Field>
    <Field name="IEndMapCp">P11</Field>
  </Object>

  <Object class="oracle.odi.domain.mapping.SnpMapAttr">
    <Field name="IMapAttr">A1</Field>
    <Field name="Name">ID_PROGETTO</Field>
    <Field name="IOwnerMapCp">P10</Field>
    <Field name="IsRequired">1</Field>
    <Field name="Length">10</Field>
    <Field name="Scale">0</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapAttr">
    <Field name="IMapAttr">A2</Field>
    <Field name="Name">IMPORTO_TOTALE</Field>
    <Field name="IOwnerMapCp">P7</Field>
    <Field name="GrpFunc">SUM</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapAttr">
    <Field name="IMapAttr">A3</Field>
    <Field name="Name">ANNO</Field>
    <Field name="IOwnerMapCp">P7</Field>
    <Field name="GrpFunc">AUTO</Field>
  </Object>

  <Object class="oracle.odi.domain.mapping.SnpMapExpr">
    <Field name="IMapExpr">E1</Field>
    <Field name="Txt">SUM(SRC.IMPORTO)</Field>
    <Field name="ParsedTxt">SUM(SRC.IMPORTO)</Field>
    <Field name="IOwnerMapAttr">A2</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapExpr">
    <Field name="IMapExpr">E2</Field>
    <Field name="Txt">EXTRACT(YEAR FROM SRC.DATA)</Field>
    <Field name="IOwnerMapAttr">A3</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapExpr">
    <Field name="IMapExpr">E3</Field>
    <Field name="Txt">SRC.ID = LKP.ID</Field>
    <Field name="IOwnerMapProp">PR1</Field>
  </Object>

  <Object class="oracle.odi.domain.mapping.SnpMapProp">
    <Field name="IMapProp">PR1</Field>
    <Field name="Name">JOIN_CONDITION</Field>
    <Field name="IMapComp">C4</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpMapProp">
    <Field name="IMapProp">PR2</Field>
    <Field name="Name">FILTER_CONDITION</Field>
    <Field name="IMapComp">C5</Field>
  </Object>

  <Object class="oracle.odi.domain.mapping.SnpScen">
    <Field name="ScenNo">100</Field>
    <Field name="ScenName">SCEN_TEST</Field>
    <Field name="ScenVersion">1.0</Field>
    <Field name="IMapping">1</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpScenStep">
    <Field name="ScenNo">100</Field>
    <Field name="Nno">10</Field>
    <Field name="StepName">STEP_LOAD</Field>
    <Field name="TableName">TGT_TABLE</Field>
  </Object>
  <Object class="oracle.odi.domain.mapping.SnpScenTask">
    <Field name="ScenNo">100</Field>
    <Field name="ScenTaskNo">1</Field>
    <Field name="TaskName1">INSERT</Field>
    <Field name="Nno">10</Field>
    <Field name="DefTxt">INSERT INTO TGT_TABLE (ID) VALUES (1)</Field>
    <Field name="ColTxt">SELECT 1 FROM DUAL</Field>
  </Object>

  <Object class="oracle.odi.domain.mapping.SnpFKXRef">
    <Field name="RefKey">FK1</Field>
    <Field name="RefObjFQName">SRC_SCHEMA.SRC_TABLE</Field>
    <Field name="RefObjFQType">SNP_TABLE</Field>
    <Field name="RefObjGlobalId">GID_TBL</Field>
  </Object>
</SunopsisExport>
"""
