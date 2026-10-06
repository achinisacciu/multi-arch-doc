import {
  AdapterType,
  EndpointType,
  JCAAdapterConfig,
  JCAConnectionFactory,
  JCAEndpoint,
  JCAFileAnalysis,
  JCAMessagingAnalysis,
  JCAProperty,
  JCASqlAnalysis,
  JCATransactionAnalysis,
} from '../types/jca';

// Knowledge catalog for standard JCA adapter property descriptions & categories
const PROPERTY_KNOWLEDGE_BASE: Record<string, { category: JCAProperty['category']; description: string; isCritical?: boolean }> = {
  // DB Adapter
  SqlString: {
    category: 'sql',
    description: 'Istruzione SQL, query DML o blocco PL/SQL eseguito sul database target.',
    isCritical: true,
  },
  DmlType: {
    category: 'sql',
    description: 'Tipo di operazione DML (insert, update, merge, delete, pureSql, call).',
    isCritical: true,
  },
  DescriptorName: {
    category: 'core',
    description: 'Descrittore entità ORM TopLink / EclipseLink mappato a questa interazione.',
  },
  ProcedureName: {
    category: 'sql',
    description: 'Nome della stored procedure o function PL/SQL invocata dall\'adapter.',
    isCritical: true,
  },
  PackageName: {
    category: 'sql',
    description: 'Nome del package database contenente la stored procedure target.',
  },
  SchemaName: {
    category: 'sql',
    description: 'Schema database proprietario delle tabelle o stored procedure.',
  },
  QueryName: {
    category: 'sql',
    description: 'Nome della query TopLink definita nei metadati di mappatura.',
  },
  MappingsMetaDataURL: {
    category: 'core',
    description: 'Percorso del file di mapping or-mappings.xml.',
  },
  GetActiveUnitOfWork: {
    category: 'transaction',
    description: 'Indica se l\'adapter partecipa alla transazione globale attiva (XA/JTA).',
  },
  DetectOmissions: {
    category: 'transaction',
    description: 'Se true, omette i campi con valore null dalle scritture SQL evitando di sovrascrivere valori di default.',
  },
  OptimizeMerge: {
    category: 'performance',
    description: 'Se true, ottimizza le istruzioni MERGE per ridurre blocchi e round-trip di rete.',
  },
  ReturnSingleResultSet: {
    category: 'sql',
    description: 'Specifica se l\'esecuzione della query restituisce un singolo record o un result set multiplo.',
  },
  MaxRows: {
    category: 'performance',
    description: 'Numero massimo di record restituiti da una singola esecuzione della query.',
  },
  RowsPerBatch: {
    category: 'performance',
    description: 'Dimensione del batch per inserimenti/aggiornamenti multipli.',
  },
  UseBatchWriting: {
    category: 'performance',
    description: 'Abilita la scrittura a batch JDBC per massimizzare il throughput.',
  },
  PollingInterval: {
    category: 'performance',
    description: 'Intervallo in secondi per il polling di nuovi record.',
    isCritical: true,
  },
  PollingStrategy: {
    category: 'core',
    description: 'Strategia di polling (Logical Delete, Delete On Read, Sequencing).',
  },

  // JMS Adapter
  DestinationName: {
    category: 'core',
    description: 'Nome JNDI della Coda (Queue) o Topic JMS target.',
    isCritical: true,
  },
  DestinationType: {
    category: 'core',
    description: 'Tipo di destinazione JMS (Queue o Topic).',
    isCritical: true,
  },
  UseMessageListener: {
    category: 'performance',
    description: 'Indica se è attivo un listener asincrono per il consumo immediato dei messaggi.',
  },
  PayloadType: {
    category: 'core',
    description: 'Formato del payload JMS (TextMessage, BytesMessage, StreamMessage, ObjectMessage).',
  },
  MessageSelector: {
    category: 'core',
    description: 'Filtro di selezione SQL-92 valutato dal broker prima dell\'inoltro.',
    isCritical: true,
  },
  DeliveryMode: {
    category: 'transaction',
    description: 'Modalità di consegna JMS (Persistent o Non-Persistent).',
  },
  AcknowledgeMode: {
    category: 'transaction',
    description: 'Modalità di conferma messaggio (AUTO_ACKNOWLEDGE, CLIENT_ACKNOWLEDGE, DUPS_OK).',
  },
  ConcurrentConsumers: {
    category: 'performance',
    description: 'Numero di thread consumatori paralleli configurati.',
  },

  // File / FTP Adapter
  PhysicalDirectory: {
    category: 'path',
    description: 'Percorso fisico della cartella su file system.',
    isCritical: true,
  },
  LogicalDirectory: {
    category: 'path',
    description: 'Variabile logica della cartella risolta a runtime tramite deployment plan.',
    isCritical: true,
  },
  FileName: {
    category: 'path',
    description: 'Nome del file o pattern regex per la ricerca/creazione file.',
    isCritical: true,
  },
  FileNamingConvention: {
    category: 'path',
    description: 'Convenzione per la generazione dinamica del nome file (es. prefix_%SEQ%_%yyyyMMdd%).',
  },
  PollingFrequency: {
    category: 'performance',
    description: 'Frequenza di polling (in secondi) per il controllo di nuovi file.',
    isCritical: true,
  },
  MinimumAge: {
    category: 'performance',
    description: 'Età minima del file prima dell\'elaborazione per evitare la lettura di file in scrittura.',
  },
  DeleteFile: {
    category: 'transaction',
    description: 'Indica se il file letto viene cancellato dopo l\'elaborazione con successo.',
  },
  ArchiveDirectory: {
    category: 'path',
    description: 'Directory di backup dove archiviare i file già processati.',
  },
  MaxRaiseSize: {
    category: 'performance',
    description: 'Numero massimo di file elaborati per ogni ciclo di polling.',
  },
  Host: {
    category: 'security',
    description: 'Indirizzo IP o hostname del server FTP/SFTP remoto.',
    isCritical: true,
  },
  Port: {
    category: 'security',
    description: 'Porta di connessione del server remoto.',
  },
  SecureStorage: {
    category: 'security',
    description: 'Flag per la trasmissione sicura con protocollo SFTP / SSH.',
  },

  // AQ Adapter
  QueueName: {
    category: 'core',
    description: 'Nome della coda Oracle Advanced Queuing nel database.',
    isCritical: true,
  },
  DatabaseSchema: {
    category: 'core',
    description: 'Schema database contenente le tabelle e payload AQ.',
  },
  Consumer: {
    category: 'core',
    description: 'Nome del subscriber/consumer per code AQ multi-consumer.',
  },
  Correlation: {
    category: 'core',
    description: 'Identificativo di correlazione AQ per il recupero mirato dei messaggi.',
  },
};

export function normalizeAdapterType(adapterStr: string): AdapterType {
  const lower = (adapterStr || '').toLowerCase();
  // Token boundaries: evita falso positivo su 'customdbadapter' -> db
  const hasToken = (token: string) => new RegExp(`(^|[^a-z])${token}([^a-z]|$)`).test(lower) || lower.includes(`.${token}`) || lower.includes(`${token}.`);
  if (lower.includes('oracle.tip.adapter.db') || hasToken('db') || lower.includes('database')) return 'db';
  if (lower.includes('jms') || lower.includes('queue') || lower.includes('topic') || lower.includes('eis/wls/queue') || lower.includes('eis/wls/topic')) return 'jms';
  if (hasToken('aq') || lower.includes('oracle.tip.adapter.aq')) return 'aq';
  if (lower.includes('ftp') || lower.includes('sftp') || lower.includes('ftps')) return 'ftp';
  if (hasToken('file')) return 'file';
  if (lower.includes('socket') || hasToken('tcp')) return 'socket';
  if (hasToken('rest')) return 'rest';
  if (lower.includes('apps') || lower.includes('ebs')) return 'apps';
  if (hasToken('mq') || lower.includes('mqseries')) return 'mq';
  return 'custom';
}

export function categorizeSpecClass(className: string): string {
  const lower = (className || '').toLowerCase();
  if (lower.includes('puresql')) return 'Database Pure SQL Interaction';
  if (lower.includes('storedprocedure') || lower.includes('dbstoredproc')) return 'Database Stored Procedure';
  if (lower.includes('dbwrite') || lower.includes('writeinteraction')) return 'Database DML Write';
  if (lower.includes('dbread') || lower.includes('select') || lower.includes('query')) return 'Database Read / Query';
  if (lower.includes('jmsactivationspec')) return 'JMS Inbound Activation (Consumer)';
  if (lower.includes('jmsinteractionspec') || lower.includes('jmsproduce')) return 'JMS Outbound Interaction (Producer)';
  if (lower.includes('fileactivationspec') || lower.includes('filepoll')) return 'File Inbound Polling';
  if (lower.includes('fileinteractionspec') || lower.includes('filewrite')) return 'File Outbound Write';
  if (lower.includes('ftpactivationspec')) return 'FTP Inbound Polling';
  if (lower.includes('ftpinteractionspec')) return 'FTP Outbound Transfer';
  if (lower.includes('aqactivationspec')) return 'Oracle AQ Dequeue Activation';
  if (lower.includes('aqinteractionspec')) return 'Oracle AQ Enqueue Interaction';
  if (lower.includes('socket')) return 'TCP Socket Interaction';
  return className ? className.split('.').pop() || className : 'Generic Adapter Spec';
}

export function extractSqlParameters(sql: string): string[] {
  if (!sql) return [];
  const params = new Set<string>();
  const hashMatches = sql.match(/#([a-zA-Z0-9_]+)/g);
  if (hashMatches) {
    hashMatches.forEach((m) => params.add(m.replace(/#/g, '')));
  }
  const colonMatches = sql.match(/:([a-zA-Z0-9_]+)/g);
  if (colonMatches) {
    colonMatches.forEach((m) => params.add(m.replace(/:/g, '')));
  }
  return Array.from(params);
}

export function extractSqlTables(sql: string): string[] {
  if (!sql) return [];
  const tables = new Set<string>();
  // Rimuove commenti SQL e normalizza
  const withoutComments = sql
    .replace(/--.*$/gm, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  const cleanSql = withoutComments.replace(/\s+/g, ' ');
  const fromJoinRegex = /(?:FROM|JOIN|INTO|UPDATE|MERGE\s+INTO|USING)\s+["`]?([a-zA-Z0-9_\."]+)["`]?/gi;
  let match: RegExpExecArray | null;
  while ((match = fromJoinRegex.exec(cleanSql)) !== null) {
    let candidate = match[1].replace(/[(),;"]/g, '').replace(/`/g, '').trim();
    // Scarta subquery o parole riservate
    if (!candidate || candidate.startsWith('(') || candidate.startsWith('SELECT')) continue;
    const upper = candidate.toUpperCase();
    if (['SELECT', 'WHERE', 'SET', 'VALUES', 'DUAL', 'ON', 'GROUP', 'ORDER', 'USING'].includes(upper)) continue;
    tables.add(candidate);
  }
  return Array.from(tables);
}

export function detectSqlType(sql: string): JCASqlAnalysis['sqlType'] {
  if (!sql) return 'UNKNOWN';
  const stripped = sql
    .replace(/^\uFEFF/, '')
    .replace(/--.*$/gm, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim();
  const trimmed = stripped.toUpperCase();
  // Rimuove prefissi commentati e parentesi iniziali
  const normalized = trimmed.replace(/^[\s(]+/, '');
  if (normalized.startsWith('SELECT') || normalized.startsWith('WITH')) return 'SELECT';
  if (normalized.startsWith('INSERT')) return 'INSERT';
  if (normalized.startsWith('UPDATE')) return 'UPDATE';
  if (normalized.startsWith('DELETE')) return 'DELETE';
  if (normalized.startsWith('MERGE')) return 'MERGE';
  if (normalized.startsWith('CALL') || normalized.startsWith('BEGIN') || normalized.startsWith('EXEC') || normalized.startsWith('EXECUTE')) return 'CALL';
  return 'UNKNOWN';
}

function enrichProperty(name: string, value: string): JCAProperty {
  const knowledge = PROPERTY_KNOWLEDGE_BASE[name];
  if (knowledge) {
    return {
      name,
      value,
      category: knowledge.category,
      description: knowledge.description,
      isCritical: knowledge.isCritical,
    };
  }

  let category: JCAProperty['category'] = 'general';
  const lowerName = name.toLowerCase();
  if (lowerName.includes('sql') || lowerName.includes('query') || lowerName.includes('table') || lowerName.includes('column') || lowerName.includes('proc')) {
    category = 'sql';
  } else if (lowerName.includes('trans') || lowerName.includes('uow') || lowerName.includes('commit') || lowerName.includes('ack') || lowerName.includes('lock')) {
    category = 'transaction';
  } else if (lowerName.includes('poll') || lowerName.includes('batch') || lowerName.includes('timeout') || lowerName.includes('max') || lowerName.includes('concurrent') || lowerName.includes('interval')) {
    category = 'performance';
  } else if (lowerName.includes('dir') || lowerName.includes('file') || lowerName.includes('path')) {
    category = 'path';
  } else if (lowerName.includes('user') || lowerName.includes('pass') || lowerName.includes('ssl') || lowerName.includes('secure') || lowerName.includes('host') || lowerName.includes('port') || lowerName.includes('auth')) {
    category = 'security';
  } else if (lowerName.includes('spec') || lowerName.includes('name') || lowerName.includes('type') || lowerName.includes('dest')) {
    category = 'core';
  }

  return {
    name,
    value,
    category,
    description: `Parametro di configurazione adapter per ${name}.`,
    isCritical: ['SqlString', 'ProcedureName', 'DestinationName', 'PhysicalDirectory', 'Host'].includes(name),
  };
}

/**
 * Deterministic JCA File Parser (No AI, pure AST & XML/Regex tokenization)
 */
export function parseJcaContent(xmlContent: string, fileName: string = 'adapter.jca', relativePath: string = ''): JCAAdapterConfig {
  const warnings: string[] = [];
  let xmlDoc: Document | null = null;

  try {
    const parser = new DOMParser();
    xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    const parseError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (parseError) {
      warnings.push(`XML Parsing: ${parseError.textContent?.slice(0, 120) || 'Controllo struttura completato con fallback'}`);
    }
  } catch (err) {
    warnings.push(`DOMParser: ${err instanceof Error ? err.message : String(err)}`);
  }

  let adapterName = fileName.replace(/\.jca$/i, '');
  let adapterTypeRaw = '';
  let wsdlLocation = '';
  let xmlns = '';
  let targetNamespace = '';
  const connectionFactory: JCAConnectionFactory = {
    location: '',
    otherAttributes: {},
  };
  const endpoints: JCAEndpoint[] = [];

  if (xmlDoc && !xmlDoc.getElementsByTagName('parsererror')[0]) {
    const adapterConfigEl = xmlDoc.getElementsByTagName('adapter-config')[0] || xmlDoc.documentElement;
    if (adapterConfigEl) {
      adapterName = adapterConfigEl.getAttribute('name') || adapterName;
      adapterTypeRaw = adapterConfigEl.getAttribute('adapter') || '';
      wsdlLocation = adapterConfigEl.getAttribute('wsdlLocation') || '';
      xmlns = adapterConfigEl.getAttribute('xmlns') || '';
      targetNamespace = adapterConfigEl.getAttribute('targetNamespace') || '';
    }

    const connFactEl = xmlDoc.getElementsByTagName('connection-factory')[0];
    if (connFactEl) {
      connectionFactory.location = connFactEl.getAttribute('location') || '';
      connectionFactory.uiConnectionName = connFactEl.getAttribute('UIConnectionName') || connFactEl.getAttribute('uiConnectionName') || undefined;
      connectionFactory.uiQueryResultConfiguration = connFactEl.getAttribute('UIQueryResultConfiguration') || undefined;

      for (let i = 0; i < connFactEl.attributes.length; i++) {
        const attr = connFactEl.attributes[i];
        if (!['location', 'UIConnectionName', 'uiConnectionName', 'UIQueryResultConfiguration'].includes(attr.name)) {
          connectionFactory.otherAttributes[attr.name] = attr.value;
        }
      }
    }

    const interactionEls = Array.from(xmlDoc.getElementsByTagName('endpoint-interaction'));
    const activationEls = Array.from(xmlDoc.getElementsByTagName('endpoint-activation'));

    const processEndpoint = (el: Element, type: EndpointType, index: number) => {
      const portType = el.getAttribute('portType') || '';
      const operation = el.getAttribute('operation') || '';

      const specEl = el.getElementsByTagName('interaction-spec')[0] || el.getElementsByTagName('activation-spec')[0];
      const specClassName = specEl ? (specEl.getAttribute('className') || '') : '';
      const specCategory = categorizeSpecClass(specClassName);

      const propertyEls = specEl ? Array.from(specEl.getElementsByTagName('property')) : Array.from(el.getElementsByTagName('property'));
      const properties: JCAProperty[] = propertyEls.map((p) => {
        const name = p.getAttribute('name') || '';
        const value = p.getAttribute('value') || p.textContent || '';
        return enrichProperty(name, value);
      });

      const propMap: Record<string, string> = {};
      properties.forEach((p) => {
        propMap[p.name] = p.value;
      });

      let sqlAnalysis: JCASqlAnalysis | undefined = undefined;
      if (propMap.SqlString || propMap.ProcedureName || propMap.DmlType || propMap.DescriptorName || adapterTypeRaw.toLowerCase().includes('db')) {
        const sqlString = propMap.SqlString;
        sqlAnalysis = {
          sqlString,
          sqlType: sqlString ? detectSqlType(sqlString) : (propMap.DmlType ? (['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'MERGE', 'CALL'].includes(propMap.DmlType.toUpperCase()) ? propMap.DmlType.toUpperCase() as JCASqlAnalysis['sqlType'] : 'UNKNOWN') : undefined),
          tables: sqlString ? extractSqlTables(sqlString) : [],
          parameters: sqlString ? extractSqlParameters(sqlString) : [],
          procedureName: propMap.ProcedureName,
          packageName: propMap.PackageName,
          schemaName: propMap.SchemaName,
          dmlType: propMap.DmlType,
          descriptorName: propMap.DescriptorName,
        };
      }

      let messagingAnalysis: JCAMessagingAnalysis | undefined = undefined;
      if (propMap.DestinationName || propMap.DestinationType || propMap.MessageSelector || adapterTypeRaw.toLowerCase().includes('jms')) {
        messagingAnalysis = {
          destinationName: propMap.DestinationName,
          destinationType: propMap.DestinationType ? (propMap.DestinationType.includes('Topic') ? 'Topic' : 'Queue') : undefined,
          messageSelector: propMap.MessageSelector,
          payloadType: propMap.PayloadType,
          deliveryMode: propMap.DeliveryMode,
          acknowledgeMode: propMap.AcknowledgeMode,
          useMessageListener: propMap.UseMessageListener ? propMap.UseMessageListener.toLowerCase() === 'true' : undefined,
        };
      }

      let fileAnalysis: JCAFileAnalysis | undefined = undefined;
      if (propMap.PhysicalDirectory || propMap.LogicalDirectory || propMap.FileName || propMap.PollingFrequency || adapterTypeRaw.toLowerCase().includes('file') || adapterTypeRaw.toLowerCase().includes('ftp')) {
        fileAnalysis = {
          physicalDirectory: propMap.PhysicalDirectory,
          logicalDirectory: propMap.LogicalDirectory,
          fileName: propMap.FileName,
          fileNamingConvention: propMap.FileNamingConvention,
          pollingFrequency: propMap.PollingFrequency,
          deleteAfterRead: propMap.DeleteFile ? propMap.DeleteFile.toLowerCase() === 'true' : undefined,
          archiveDirectory: propMap.ArchiveDirectory,
          maxRaiseSize: propMap.MaxRaiseSize,
          minimumAge: propMap.MinimumAge,
          host: propMap.Host,
          port: propMap.Port,
          secureStorage: propMap.SecureStorage,
        };
      }

      const transactionAnalysis: JCATransactionAnalysis = {
        getActiveUnitOfWork: propMap.GetActiveUnitOfWork,
        detectOmissions: propMap.DetectOmissions,
        optimizeMerge: propMap.OptimizeMerge,
        returnSingleResultSet: propMap.ReturnSingleResultSet,
        useBatchWriting: propMap.UseBatchWriting,
        maxRows: propMap.MaxRows,
      };

      endpoints.push({
        id: `endpoint-${type}-${index}`,
        type,
        portType,
        operation,
        specClassName,
        specCategory,
        properties,
        sqlAnalysis,
        messagingAnalysis,
        fileAnalysis,
        transactionAnalysis,
      });
    };

    interactionEls.forEach((el, idx) => processEndpoint(el, 'interaction', idx));
    activationEls.forEach((el, idx) => processEndpoint(el, 'activation', idx));
  }

  // Regex fallback – solo se XML non valido e contiene almeno un endpoint tag
  if (endpoints.length === 0) {
    const hasEndpointTag = /<endpoint-(interaction|activation)/i.test(xmlContent);
    const hasAdapterConfig = /<adapter-config/i.test(xmlContent);
    // Guard C-02: se file vuoto, troppo corto o senza tag JCA, non creare endpoint fantasma
    if (!hasEndpointTag || !hasAdapterConfig || xmlContent.trim().length < 20) {
      warnings.push('Nessun endpoint JCA rilevato: file ignorato o non-JCA');
    } else {
      const nameMatch = xmlContent.match(/<adapter-config[^>]*\sname=["']([^"']+)["']/i);
      if (nameMatch) adapterName = nameMatch[1];

      const adapterMatch = xmlContent.match(/<adapter-config[^>]*\sadapter=["']([^"']+)["']/i);
      if (adapterMatch) adapterTypeRaw = adapterMatch[1];

      const wsdlMatch = xmlContent.match(/<adapter-config[^>]*\swsdlLocation=["']([^"']+)["']/i);
      if (wsdlMatch) wsdlLocation = wsdlMatch[1];

      const locationMatch = xmlContent.match(/<connection-factory[^>]*\slocation=["']([^"']+)["']/i);
      if (locationMatch) connectionFactory.location = locationMatch[1];

      const uiConnMatch = xmlContent.match(/<connection-factory[^>]*\sUIConnectionName=["']([^"']+)["']/i);
      if (uiConnMatch) connectionFactory.uiConnectionName = uiConnMatch[1];

      const hasActivation = /<endpoint-activation/i.test(xmlContent);
      const portTypeMatch = xmlContent.match(/portType=["']([^"']+)["']/i);
      const operationMatch = xmlContent.match(/operation=["']([^"']+)["']/i);
      const specClassMatch = xmlContent.match(/className=["']([^"']+)["']/i);

      const properties: JCAProperty[] = [];
      const propTagRegex = /<property\b[^>]*>/gi;
      let tagMatch: RegExpExecArray | null;
      while ((tagMatch = propTagRegex.exec(xmlContent)) !== null) {
        const tag = tagMatch[0];
        const nameM = tag.match(/\bname\s*=\s*["']([^"']+)["']/i);
        const valueM = tag.match(/\bvalue\s*=\s*["']([^"']*)["']/i);
        if (nameM) {
          const n = nameM[1];
          const v = valueM ? valueM[1] : '';
          if (!properties.some(p => p.name === n)) properties.push(enrichProperty(n, v));
        }
      }

      const propMap: Record<string, string> = {};
      properties.forEach((p) => {
        propMap[p.name] = p.value;
      });

      const specClassName = specClassMatch ? specClassMatch[1] : '';
      const sqlString = propMap.SqlString;

      endpoints.push({
        id: 'endpoint-fallback-0',
        type: hasActivation ? 'activation' : 'interaction',
        portType: portTypeMatch ? portTypeMatch[1] : 'UnknownPort',
        operation: operationMatch ? operationMatch[1] : 'UnknownOperation',
        specClassName,
        specCategory: categorizeSpecClass(specClassName),
        properties,
        sqlAnalysis: (sqlString || propMap.ProcedureName || propMap.DmlType) ? {
          sqlString,
          sqlType: sqlString ? detectSqlType(sqlString) : undefined,
          tables: sqlString ? extractSqlTables(sqlString) : [],
          parameters: sqlString ? extractSqlParameters(sqlString) : [],
          procedureName: propMap.ProcedureName,
          packageName: propMap.PackageName,
          schemaName: propMap.SchemaName,
          dmlType: propMap.DmlType,
        } : undefined,
        messagingAnalysis: propMap.DestinationName ? {
          destinationName: propMap.DestinationName,
          destinationType: propMap.DestinationType ? (propMap.DestinationType.includes('Topic') ? 'Topic' : 'Queue') : undefined,
          messageSelector: propMap.MessageSelector,
        } : undefined,
        fileAnalysis: (propMap.PhysicalDirectory || propMap.FileName) ? {
          physicalDirectory: propMap.PhysicalDirectory,
          logicalDirectory: propMap.LogicalDirectory,
          fileName: propMap.FileName,
          pollingFrequency: propMap.PollingFrequency,
        } : undefined,
      });
      warnings.push('Parser fallback regex utilizzato: verificare manualmente il file');
    }
  }

  const adapter = normalizeAdapterType(adapterTypeRaw || (endpoints[0]?.specClassName || ''));

  // ID deterministico (C-07): hash stabile su relativePath + fileName
  const stableIdBase = (relativePath || fileName).replace(/[^a-zA-Z0-9]/g, '-').slice(0, 48);
  const contentHash = (() => {
    let h = 0;
    const s = xmlContent.slice(0, 500);
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return Math.abs(h).toString(36);
  })();

  return {
    id: `jca-${stableIdBase}-${contentHash}`,
    name: adapterName,
    adapter,
    adapterRaw: adapterTypeRaw || adapter,
    wsdlLocation: wsdlLocation || `${adapterName}.wsdl`,
    xmlns,
    targetNamespace,
    connectionFactory,
    endpoints,
    rawXml: xmlContent,
    fileName,
    relativePath: relativePath || fileName,
    fileSize: new Blob([xmlContent]).size,
    parsedAt: new Date().toISOString(),
    validationWarnings: warnings,
    selectedForExport: true,
  };
}
