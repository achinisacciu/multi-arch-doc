# Specifica Tecnica: Partizionamento e Gerarchia ODI Smart Export (Mapping)

Questo documento fornisce una specifica tecnica dettagliata e rigorosamente documentata riguardante la struttura gerarchica e i campi chiave estratti dai file di tipo **SmartExport** di Oracle Data Integrator (ODI), concentrandosi in particolare sugli oggetti principali che compongono i Mapping fisici e logici:

*   **SnpMapping**: L'oggetto radice del mapping ETL.
*   **SnpMapComp**: I componenti del mapping (Sorgenti, Target, Filtri, Aggregatori, Joiner, ecc.).
*   **SnpMapCp**: I punti di connessione (*Connection Points* / Porte) associati a ciascun componente.
*   **SnpMapAttr**: Gli attributi (campi/colonne) mappati e definiti all'interno di ciascuna porta.
*   **SnpMapProp**: Le proprietà specifiche associate ad attributi o componenti (es. formule, espressioni, nomi fisici delle colonne).
*   **SnpMapConn**: I connettori fisici che collegano le varie porte (`SnpMapCp`) tra i componenti del flusso.

---

## 1. Schema della Struttura Gerarchica Complessa

La struttura XML di uno SmartExport segue una gerarchia rigida, orientata ai grafi orientati (*directed graphs*), dove i nodi di calcolo ed i flussi dati sono dichiarati in elementi annidati, mentre le relazioni topologiche di collegamento sono espresse tramite elementi di giunzione piatti (`SnpMapConn`).

### Mappa Visiva dell'Albero XML

```text
SnpMapping (Contenitore Principale del Mapping ETL)
│   ├── [Attributi]: IMapping, I_MAPPING, Name, MappingId, Description, IOwnerMapping
│
├── SnpMapComp (Componenti di Trasformazione o Sorgenti/Target)
│   ├── [Attributi]: IMapComp, IOwnerMapComp, Name, ComponentType, Description
│   │
│   └── SnpMapCp (Connection Points / Porte di Input/Output)
│       ├── [Attributi]: I_MAP_CP, Name, Direction, OwnerComponentId
│       │
│       └── SnpMapAttr (Attributi di Porta / Colonne di Flusso)
│           ├── [Attributi]: I_MAP_ATTR, Name, DataType, Precision, Scale, Length, OwnerPortId
│           │
│           └── SnpMapProp (Proprietà Tecniche / Metadati e Formule)
│               └── [Attributi]: I_MAP_PROP, Name, Value, OwnerAttributeId
│
└── SnpMapConn (Relazioni di Collegamento Fisico / Connettori di Flusso)
    └── [Attributi]: I_MAP_CONN, Name, SourceCompId, TargetCompId, SourcePortId, TargetPortId
```

---

## 2. Estratto XML Esempio (Anonimizzato)

Di seguito viene riportato un estratto XML reale, anonimizzato e formattato di SmartExport, che rispecchia fedelmente i campi fisici estratti e utilizzati all'interno del sistema:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SnpMapping IMapping="20501" I_MAPPING="20501" Name="MAP_SALES_DWH_LOAD" MappingId="d1be648d-6ec6-4660-8f92-5d4b58498877" Description="ETL Load Sales into Data Warehouse" IOwnerMapping="3001">
  
  <!-- Componente 1: Sorgente Dati Fisici -->
  <SnpMapComp IMapComp="4001" IOwnerMapComp="20501" Name="SRC_SALES_TRANSACTIONS" ComponentType="DATA_SOURCE" Description="Source sales database table">
    <SnpMapCp I_MAP_CP="5001" Name="IN_OUT_CP" Direction="IN_OUT" OwnerComponentId="4001">
      
      <SnpMapAttr I_MAP_ATTR="6001" Name="TX_ID" DataType="NUMERIC" Precision="10" Scale="0" Length="10" OwnerPortId="5001">
        <SnpMapProp I_MAP_PROP="7001" Name="COLUMN_NAME" Value="TRANSACTION_ID" OwnerAttributeId="6001"/>
        <SnpMapProp I_MAP_PROP="7002" Name="IS_PRIMARY_KEY" Value="true" OwnerAttributeId="6001"/>
      </SnpMapAttr>
      
      <SnpMapAttr I_MAP_ATTR="6002" Name="TX_DATE" DataType="DATE" OwnerPortId="5001">
        <SnpMapProp I_MAP_PROP="7003" Name="COLUMN_NAME" Value="TRANSACTION_DATE" OwnerAttributeId="6002"/>
      </SnpMapAttr>
      
      <SnpMapAttr I_MAP_ATTR="6003" Name="AMOUNT" DataType="NUMERIC" Precision="15" Scale="2" Length="15" OwnerPortId="5001">
        <SnpMapProp I_MAP_PROP="7004" Name="COLUMN_NAME" Value="NET_AMOUNT" OwnerAttributeId="6003"/>
      </SnpMapAttr>
      
    </SnpMapCp>
  </SnpMapComp>
  
  <!-- Componente 2: Trasformazione / Aggregatore -->
  <SnpMapComp IMapComp="4002" IOwnerMapComp="20501" Name="TRN_AGGREGATE_SALES" ComponentType="AGGREGATOR" Description="Calculate total net sales by date">
    
    <!-- Porta di Ingresso (Input Port) -->
    <SnpMapCp I_MAP_CP="5002" Name="INPUT_PORT" Direction="INPUT" OwnerComponentId="4002">
      <SnpMapAttr I_MAP_ATTR="6011" Name="IN_DATE" DataType="DATE" OwnerPortId="5002"/>
      <SnpMapAttr I_MAP_ATTR="6012" Name="IN_AMOUNT" DataType="NUMERIC" Precision="15" Scale="2" OwnerPortId="5002"/>
    </SnpMapCp>
    
    <!-- Porta di Uscita (Output Port con formule aggregate) -->
    <SnpMapCp I_MAP_CP="5003" Name="OUTPUT_PORT" Direction="OUTPUT" OwnerComponentId="4002">
      <SnpMapAttr I_MAP_ATTR="6021" Name="AGG_DATE" DataType="DATE" OwnerPortId="5003">
        <SnpMapProp I_MAP_PROP="7101" Name="EXPRESSION" Value="INPUT_PORT.IN_DATE" OwnerAttributeId="6021"/>
      </SnpMapAttr>
      <SnpMapAttr I_MAP_ATTR="6022" Name="TOTAL_SALES" DataType="NUMERIC" Precision="15" Scale="2" OwnerPortId="5003">
        <SnpMapProp I_MAP_PROP="7102" Name="EXPRESSION" Value="SUM(INPUT_PORT.IN_AMOUNT)" OwnerAttributeId="6022"/>
      </SnpMapAttr>
    </SnpMapCp>
    
  </SnpMapComp>
  
  <!-- Collegamento Topologico dei Flussi di Mappatura -->
  <SnpMapConn I_MAP_CONN="8001" Name="CONN_SRC_TO_TRN" SourceCompId="4001" TargetCompId="4002" SourcePortId="5001" TargetPortId="5002"/>

</SnpMapping>
```

---

## 3. Documentazione Dettagliata dei Campi Estratti

Nelle tabelle sottostanti vengono descritti meticolosamente i campi fisici per ogni entità estratta, i tipi di dati associati, la loro cardinalità e la funzione di business all'interno di ODI.

### 3.1. Entità: SnpMapping
Rappresenta l'oggetto di mapping ad alto livello. Definisce l'intero flusso logico e fisico di spostamento e trasformazione dati.

| Nome Campo | Tipo XML | Descrizione Funzionale | Esempio / Chiavi Corrispondenti |
| :--- | :--- | :--- | :--- |
| **IMapping** | Numero / ID | Identificativo numerico univoco del mapping nel repository ODI. | `20501` |
| **I_MAPPING** | Numero / ID | Chiave primaria relazionale interna usata per l'accoppiamento dei record. | `20501` |
| **Name** | Stringa | Nome logico dell'oggetto Mapping. | `MAP_SALES_DWH_LOAD` |
| **MappingId** | UUID / Stringa| Identificativo alfanumerico globale (GUID) per migrazioni e importazioni. | `d1be648d-6ec6-4660-8f92-5d4b58498877` |
| **Description**| Stringa | Nota o documentazione testuale inserita dallo sviluppatore ETL. | `ETL Load Sales into Data Warehouse` |
| **IOwnerMapping**| Numero / ID | Identificativo del proprietario del mapping o del progetto di appartenenza. | `3001` |

---

### 3.2. Entità: SnpMapComp
Definisce un nodo di elaborazione, sorgente o destinazione fisica o logica del flusso dati (es. Datastore, Join, Filter, Expression, Splitter).

| Nome Campo | Tipo XML | Descrizione Funzionale | Esempio / Chiavi Corrispondenti |
| :--- | :--- | :--- | :--- |
| **IMapComp** | Numero / ID | Chiave primaria univoca del componente all'interno del mapping. | `4001` |
| **IOwnerMapComp**| Numero / ID | Chiave esterna che collega il componente al mapping padre (`SnpMapping`). | `20501` (Rif: `IMapping`) |
| **Name** | Stringa | Nome descrittivo dell'istanza del componente. | `SRC_SALES_TRANSACTIONS` |
| **ComponentType**| Stringa | Tipologia funzionale del componente (es. `DATA_SOURCE`, `AGGREGATOR`, `JOIN`). | `DATA_SOURCE` |
| **Description**| Stringa | Descrizione o commento specifico dell'azione svolta dal componente. | `Source sales database table` |

---

### 3.3. Entità: SnpMapCp
Identifica una porta o punto di connessione di un componente. Una porta raggruppa attributi omogenei in ingresso o in uscita.

| Nome Campo | Tipo XML | Descrizione Funzionale | Esempio / Chiavi Corrispondenti |
| :--- | :--- | :--- | :--- |
| **I_MAP_CP** | Numero / ID | Chiave primaria univoca del punto di connessione (Connection Point). | `5001` |
| **Name** | Stringa | Nome logico identificativo della porta. | `INPUT_PORT`, `OUTPUT_PORT` |
| **Direction** | Stringa | Direzione del flusso nella porta (Valori possibili: `INPUT`, `OUTPUT`, `IN_OUT`). | `INPUT` |
| **OwnerComponentId**| Numero / ID| ID del componente proprietario della porta. | `4001` (Rif: `IMapComp`) |

---

### 3.4. Entità: SnpMapAttr
Rappresenta il singolo attributo (colonna logica) appartenente ad una porta. Trasporta il tipo dato e definisce i vincoli di precisione.

| Nome Campo | Tipo XML | Descrizione Funzionale | Esempio / Chiavi Corrispondenti |
| :--- | :--- | :--- | :--- |
| **I_MAP_ATTR** | Numero / ID | Chiave primaria dell'attributo. | `6001` |
| **Name** | Stringa | Nome logico dell'attributo o colonna. | `TX_ID`, `TOTAL_SALES` |
| **DataType** | Stringa | Tipo di dato SQL o interno ODI (es. `NUMERIC`, `VARCHAR`, `DATE`). | `NUMERIC` |
| **Precision** | Numero | Precisione numerica (numero massimo di cifre decimali totali). | `15` |
| **Scale** | Numero | Scala numerica (numero di cifre a destra della virgola). | `2` |
| **Length** | Numero | Lunghezza massima fisica definita per il campo di testo o binario. | `10` |
| **OwnerPortId** | Numero / ID | Chiave esterna che associa l'attributo alla sua porta (`SnpMapCp`). | `5001` (Rif: `I_MAP_CP`) |

---

### 3.5. Entità: SnpMapProp
Definisce le coppie chiave-valore necessarie a configurare comportamenti specifici di ciascun attributo o porta (es. formule SQL di aggregazione, filtri attivi).

| Nome Campo | Tipo XML | Descrizione Funzionale | Esempio / Chiavi Corrispondenti |
| :--- | :--- | :--- | :--- |
| **I_MAP_PROP** | Numero / ID | Identificativo numerico della proprietà. | `7001` |
| **Name** | Stringa | Nome della proprietà logico-funzionale (es. `COLUMN_NAME`, `EXPRESSION`). | `EXPRESSION` |
| **Value** | Stringa | Valore effettivo o query/formula associata. | `SUM(INPUT_PORT.IN_AMOUNT)` |
| **OwnerAttributeId**| Numero / ID| Collegamento diretto all'attributo di riferimento (`SnpMapAttr`). | `6022` (Rif: `I_MAP_ATTR`) |

---

### 3.6. Entità: SnpMapConn
Mappa l'unione fisica di tipo arco (Edge) che unisce due porte tra componenti diversi, permettendo la topologia del flusso dati.

| Nome Campo | Tipo XML | Descrizione Funzionale | Esempio / Chiavi Corrispondenti |
| :--- | :--- | :--- | :--- |
| **I_MAP_CONN** | Numero / ID | ID univoco del connettore. | `8001` |
| **Name** | Stringa | Nome logico della connessione fisica. | `CONN_SRC_TO_TRN` |
| **SourceCompId**| Numero / ID | ID del componente di origine del flusso. | `4001` (Rif: `IMapComp`) |
| **TargetCompId**| Numero / ID | ID del componente di destinazione del flusso. | `4002` (Rif: `IMapComp`) |
| **SourcePortId**| Numero / ID | ID della porta sorgente specifica. | `5001` (Rif: `I_MAP_CP`) |
| **TargetPortId**| Numero / ID | ID della porta destinazione specifica. | `5002` (Rif: `I_MAP_CP`) |

---

## 4. Regole di Business e Integrità Referenziale Implicitata

Nel partizionamento di questo SmartExport, si evincono tre regole di business fondamentali espresse dai legami relazionali dell'XML:

1.  **Associazione Gerarchica degli Attributi**: Gli attributi `SnpMapAttr` non possono esistere slegati da una porta `SnpMapCp`. La porta è a sua volta legata strettamente a un componente `SnpMapComp`. Di conseguenza, per navigare la formula di un attributo è sempre necessario risolvere il percorso:
    $$\text{SnpMapping} \rightarrow \text{SnpMapComp} \rightarrow \text{SnpMapCp} \rightarrow \text{SnpMapAttr} \rightarrow \text{SnpMapProp}$$
2.  **Risoluzione delle Connessioni Fisiche**: L'elemento `SnpMapConn` stabilisce un'associazione diretta tra porte. L'integrità referenziale richiede che:
    *   `SourcePortId` debba appartenere al componente identificato da `SourceCompId`.
    *   `TargetPortId` debba appartenere al componente identificato da `TargetCompId`.
3.  **Ambito di Definizione delle Proprietà**: Le espressioni SQL di trasformazione o le formule aggregate sono registrate come elementi figli `SnpMapProp` aventi nome proprietà `EXPRESSION`. I riferimenti all'interno della formula di un componente (es. `INPUT_PORT.IN_AMOUNT`) vengono risolti verificando le porte in ingresso del componente corrente.
