import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Enable JSON body parsing with higher payload limit for XML/Docs
app.use(express.json({ limit: '50mb' }));

// Lazy-initialized Gemini Client helper
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Chiave API GEMINI_API_KEY non configurata nei segreti dell\'ambiente.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Language name helper
function getLanguageLabel(lang: string): string {
  switch (lang) {
    case 'it': return 'Italiano';
    case 'en': return 'Inglese (English)';
    case 'de': return 'Tedesco (Deutsch)';
    case 'fr': return 'Francese (Français)';
    case 'es': return 'Spagnolo (Español)';
    default: return 'Italiano';
  }
}

// Route 1: Analyze BPMN and generate full documentation
app.post('/api/analyze-bpmn', async (req, res) => {
  try {
    const { parsedBpmn, rawXml, language = 'it', detailLevel = 'high', customInstructions = '' } = req.body;

    if (!parsedBpmn || !parsedBpmn.elements) {
      return res.status(400).json({ error: 'Dati BPMN non validi o mancanti.' });
    }

    const ai = getGeminiClient();
    const langLabel = getLanguageLabel(language);

    const systemInstruction = `Sei un esperto Senior Business Process Architect & BPMN 2.0 Specialist.
Il tuo compito è analizzare la struttura XML e gli elementi di un processo aziendale BPMN 2.0 e generare una documentazione professionale, completa, accurata e dettagliata.
Lingua obbligatoria di output: ${langLabel}.
Livello di dettaglio: ${detailLevel}.

Linee guida per l'analisi:
1. Metti in evidenza gli obiettivi di business del processo.
2. Identifica chiaramente tutti gli attori, ruoli, corsie (lanes) e partecipanti (pools).
3. Mappa ciascuna fase del processo in ordine logico sequenziale, indicando ruolo responsabile, descrizione dell'attività, input, output e regole di decisione.
4. Costruisci una Matrice RACI (Responsible, Accountable, Consulted, Informed) completa per tutte le attività principali.
5. Dettaglia le regole di ramificazione dei Gateway (XOR, AND, OR) e le condizioni di flusso.
6. Individua potenziali rischi, eccezioni, colli di bottiglia o punti di fallimento (SLA/Timer) e proponi mitigazioni ed elementi di ottimizzazione.
7. Crea una guida rapida manuale utente (User Manual Guide) e scenari di test funzionali (Test Cases).
Se presenti istruzioni personalizzate dall'utente, applicale rigorosamente: ${customInstructions}`;

    const promptText = `Pagine/Dati del processo BPMN da documentare:
Nome Processo: ${parsedBpmn.processName} (ID: ${parsedBpmn.processId})
Documentazione e descrizioni esistenti nel BPMN: "${parsedBpmn.documentation || 'Nessuna nota aggiuntiva'}"

Pools / Partecipanti:
${JSON.stringify(parsedBpmn.pools, null, 2)}

Lanes / Corsie:
${JSON.stringify(parsedBpmn.lanes, null, 2)}

Elementi di processo (Task, Gateway, Eventi, Stream di Flusso):
${JSON.stringify(
  parsedBpmn.elements.map((e: any) => ({
    id: e.id,
    name: e.name,
    type: e.rawType,
    documentation: e.documentation,
    laneName: e.laneName,
    incoming: e.incoming,
    outgoing: e.outgoing,
    camundaAssignee: e.camundaAssignee,
    camundaCandidateGroups: e.camundaCandidateGroups,
    formFields: e.formFields,
    timerEventDefinition: e.timerEventDefinition,
  })),
  null,
  2
)}

Codice XML BPMN 2.0 Grezzo (per contesto aggiuntivo):
\`\`\`xml
${rawXml ? rawXml.substring(0, 15000) : ''}
\`\`\`

Fornisci la risposte strettamente in formato JSON valido aderente allo schema richiesto.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: promptText,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            processName: { type: Type.STRING },
            processId: { type: Type.STRING },
            version: { type: Type.STRING },
            executiveSummary: { type: Type.STRING, description: 'Sintesi esecutiva ad alto livello per il management' },
            targetAudience: { type: Type.STRING },
            businessObjectives: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            rolesAndParticipants: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  type: { type: Type.STRING, description: 'Pool o Lane o Actor' },
                  description: { type: Type.STRING },
                  assignedTasksCount: { type: Type.INTEGER }
                },
                required: ['name', 'type', 'description']
              }
            },
            processSteps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stepNumber: { type: Type.INTEGER },
                  elementId: { type: Type.STRING },
                  name: { type: Type.STRING },
                  type: { type: Type.STRING },
                  actorRole: { type: Type.STRING },
                  description: { type: Type.STRING },
                  inputs: { type: Type.ARRAY, items: { type: Type.STRING } },
                  outputs: { type: Type.ARRAY, items: { type: Type.STRING } },
                  decisionRules: { type: Type.STRING },
                  triggerOrTimer: { type: Type.STRING },
                  notes: { type: Type.STRING }
                },
                required: ['stepNumber', 'elementId', 'name', 'type', 'actorRole', 'description']
              }
            },
            gateways: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  type: { type: Type.STRING },
                  branches: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        condition: { type: Type.STRING },
                        target: { type: Type.STRING }
                      },
                      required: ['condition', 'target']
                    }
                  }
                },
                required: ['id', 'name', 'type', 'branches']
              }
            },
            raciMatrix: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  taskName: { type: Type.STRING },
                  elementId: { type: Type.STRING },
                  responsible: { type: Type.STRING },
                  accountable: { type: Type.STRING },
                  consulted: { type: Type.STRING },
                  informed: { type: Type.STRING }
                },
                required: ['taskName', 'responsible', 'accountable', 'consulted', 'informed']
              }
            },
            functionalRequirements: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            risksAndExceptions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  risk: { type: Type.STRING },
                  location: { type: Type.STRING },
                  mitigation: { type: Type.STRING }
                },
                required: ['risk', 'location', 'mitigation']
              }
            },
            optimizationSuggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            testScenarios: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  preconditions: { type: Type.STRING },
                  pathSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
                  expectedResult: { type: Type.STRING }
                },
                required: ['id', 'title', 'preconditions', 'pathSteps', 'expectedResult']
              }
            },
            userManualGuide: { type: Type.STRING, description: 'Guida passo-passo formattata in Markdown' }
          },
          required: [
            'processName',
            'executiveSummary',
            'targetAudience',
            'businessObjectives',
            'rolesAndParticipants',
            'processSteps',
            'gateways',
            'raciMatrix',
            'functionalRequirements',
            'risksAndExceptions',
            'optimizationSuggestions',
            'testScenarios',
            'userManualGuide'
          ]
        }
      }
    });

    const jsonText = response.text || '{}';
    const parsedDoc = JSON.parse(jsonText);
    parsedDoc.generatedAt = new Date().toISOString();
    parsedDoc.language = language;

    return res.json({ success: true, documentation: parsedDoc });
  } catch (err: any) {
    console.error('Errore durante l\'analisi BPMN:', err);
    return res.status(500).json({
      error: err.message || 'Errore durante la generazione della documentazione BPMN.'
    });
  }
});

// Route 2: Interactive AI Assistant / Process Q&A
app.post('/api/chat-bpmn', async (req, res) => {
  try {
    const { message, parsedBpmn, documentation, history = [] } = req.body;

    if (!message || !parsedBpmn) {
      return res.status(400).json({ error: 'Messaggio o dati del processo mancanti.' });
    }

    const ai = getGeminiClient();

    const systemInstruction = `Sei un Assistente AI esperto del processo aziendale "${parsedBpmn.processName}".
Hai accesso sia al modello BPMN grezzo parsed sia alla documentazione generata.
Rispondi in modo preciso, professionale e sintetico alle domande dell'utente riguardanti il flusso di lavoro, i ruoli, le condizioni nei gateway, le responsabilità e i casi limite.
Includi riferimenti specifici ai nomi degli elementi e alle corsie/ruoli interessati.`;

    const formattedHistory = history.map((msg: any) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `Contesto Processo BPMN:
Nome: ${parsedBpmn.processName}
Sintesi: ${documentation?.executiveSummary || 'N/D'}
Ruoli: ${JSON.stringify(documentation?.rolesAndParticipants || parsedBpmn.lanes)}
Fasi di processo: ${JSON.stringify(documentation?.processSteps || parsedBpmn.elements)}

Domanda Utente: ${message}`
          }
        ]
      }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [...formattedHistory, ...contents],
      config: {
        systemInstruction,
        temperature: 0.7
      }
    });

    return res.json({ success: true, answer: response.text || 'Nessuna risposta generata.' });
  } catch (err: any) {
    console.error('Errore chat BPMN:', err);
    return res.status(500).json({ error: err.message || 'Errore durante l\'elaborazione del messaggio.' });
  }
});

// Serve frontend / Vite middleware
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 DocuBPMN Server avviato su http://0.0.0.0:${PORT}`);
  });
}

setupServer();
