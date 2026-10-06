import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, User, Loader2 } from 'lucide-react';
import { ChatMessage, ParsedBpmn, BpmnDocumentation } from '../types';

interface BpmnChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  parsedBpmn: ParsedBpmn;
  documentation: BpmnDocumentation | null;
}

export const BpmnChatAssistant: React.FC<BpmnChatAssistantProps> = ({
  isOpen,
  onClose,
  parsedBpmn,
  documentation,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Ciao! Sono l'Assistente del processo "${parsedBpmn.processName}". Puoi pormi qualsiasi domanda sui passaggi, i ruoli responsabili, le condizioni dei gateway o la matrice RACI.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  // Fallback deterministic response generator for offline/fast mode
  const generateLocalAnswer = (query: string): string => {
    const q = query.toLowerCase();

    if (q.includes('service') || q.includes('automatic')) {
      const serviceTasks = parsedBpmn.elements.filter(e => e.type.includes('ServiceTask') || e.type.includes('ScriptTask'));
      if (serviceTasks.length === 0) return 'Nel processo non sono presenti Service Task o Script Task automatici.';
      return `Nel processo sono presenti ${serviceTasks.length} task automatici:\n` +
        serviceTasks.map(t => `- **${t.name || t.id}**: ${t.documentation || 'Integrazione automatica di sistema.'}`).join('\n');
    }

    if (q.includes('ruol') || q.includes('attor') || q.includes('lane') || q.includes('chi fa')) {
      if (!documentation) return `Ruoli identificati nel processo: ${parsedBpmn.lanes.map(l => l.name).join(', ') || 'Operatore Generale'}.`;
      return `Ruoli e Partecipanti del processo:\n` +
        documentation.rolesAndParticipants.map(r => `- **${r.name}** (${r.type}): ${r.assignedTasksCount} attività assegnate.`).join('\n');
    }

    if (q.includes('gateway') || q.includes('condizion') || q.includes('eccezion')) {
      if (!documentation || documentation.gateways.length === 0) return 'Non sono presenti gateway decisionali complessi nel diagramma.';
      return `Gateway del processo:\n` +
        documentation.gateways.map(g => `- **${g.name}**: ${g.branches.length} ramificazioni (${g.branches.map(b => b.condition).join(', ')})`).join('\n');
    }

    if (q.includes('raci') || q.includes('responsab')) {
      if (!documentation) return 'Matrice RACI non ancora calcolata.';
      return `Estratto Matrice RACI:\n` +
        documentation.raciMatrix.slice(0, 5).map(m => `- **${m.taskName}**: R=${m.responsible}, A=${m.accountable}`).join('\n');
    }

    if (q.includes('prerequisit') || q.includes('obiettiv') || q.includes('sintesi')) {
      if (!documentation) return `Sintesi del processo: ${parsedBpmn.processName}`;
      return `**Sintesi Esecutiva:**\n${documentation.executiveSummary}\n\n**Obiettivi:**\n${documentation.businessObjectives.map(o => `- ${o}`).join('\n')}`;
    }

    // General step overview answer
    if (!documentation) return `Il processo "${parsedBpmn.processName}" contiene ${parsedBpmn.stats.totalElements} nodi e ${parsedBpmn.stats.tasksCount} task.`;
    return `Il processo "${parsedBpmn.processName}" include ${documentation.processSteps.length} fasi operative distribuite su ${documentation.rolesAndParticipants.length} ruoli.\n\n` +
      `Prime fasi del processo:\n` +
      documentation.processSteps.slice(0, 3).map(s => `${s.stepNumber}. **${s.name}** (${s.actorRole}): ${s.description}`).join('\n');
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isSending) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    try {
      const res = await fetch('/api/chat-bpmn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          parsedBpmn,
          documentation,
          history: messages,
        }),
      });

      if (!res.ok) throw new Error('API non disponibile');
      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: data.answer || generateLocalAnswer(query),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      // Fallback local instant answering engine
      const localAnswer = generateLocalAnswer(query);
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: localAnswer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const samplePrompts = [
    'Quali sono i ruoli del processo?',
    'Mostrami i Gateway e le condizioni',
    'Sintesi e obiettivi del processo',
    'Quali sono i Service Task automatici?',
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-slideLeft">
        
        {/* Chat Drawer Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Assistente Processo BPMN</h3>
              <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
                {parsedBpmn.processName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 text-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[82%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-sm'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'
                }`}
              >
                <p className="whitespace-pre-line">{msg.text}</p>
                <span
                  className={`block text-[10px] mt-1.5 text-right font-mono ${
                    msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>
              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 text-xs font-bold">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isSending && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-white p-3 rounded-2xl border border-slate-200 w-fit">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span>Ricerca informazioni nel processo...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Sample Prompt Chips */}
        <div className="p-2.5 bg-white border-t border-slate-200 overflow-x-auto flex gap-1.5 no-scrollbar">
          {samplePrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              disabled={isSending}
              className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg whitespace-nowrap border border-slate-200 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Chiedi qualcosa sul processo BPMN..."
            className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
};
