import React, { useState, useEffect, useRef } from 'react';
import type { ParsedBpmn, SimulationStep } from '../types';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Loader2 } from 'lucide-react';

interface Props {
  parsed: ParsedBpmn;
  onStepChange: (elementId: string | null) => void;
}

export function StepByStepView({ parsed, onStepChange }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [steps, setSteps] = useState<SimulationStep[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const flowNodeTags = new Set([
      'startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent',
      'task', 'userTask', 'serviceTask', 'sendTask', 'receiveTask', 'manualTask', 'scriptTask', 'businessRuleTask',
      'subProcess', 'callActivity', 'transaction',
      'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway',
    ]);

    const elements = parsed.elements.filter(e => flowNodeTags.has((e.rawType || '').toLowerCase()));
    const adj = new Map<string, string[]>();
    for (const el of elements) {
      adj.set(el.id, el.outgoing.filter(t => elements.some(e => e.id === t)));
    }

    const visited = new Set<string>();
    const ordered: SimulationStep[] = [];
    let order = 0;

    // Find start events
    const startIds = elements
      .filter(e => (e.rawType || '').toLowerCase() === 'startevent')
      .map(e => e.id);

    if (startIds.length === 0) {
      // Fallback: find elements with no incoming flows
      const allTargets = new Set<string>();
      for (const el of elements) {
        for (const t of el.outgoing) allTargets.add(t);
      }
      startIds.push(...elements.filter(e => !allTargets.has(e.id)).map(e => e.id));
    }

    // BFS traversal with branching support
    const bfs = (start: string) => {
      const queue: string[] = [start];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (visited.has(curr)) continue;
        visited.add(curr);
        const el = elements.find(e => e.id === curr);
        if (!el) continue;

        const rt = (el.rawType || '').toLowerCase();
        let stepType: SimulationStep['type'] = 'element';
        if (rt.includes('gateway')) stepType = 'gateway';
        else if (rt.includes('event') || rt === 'startEvent' || rt === 'endEvent') stepType = 'element';

        ordered.push({
          id: `step_${ordered.length + 1}`,
          elementId: el.id,
          elementName: el.name || el.id,
          elementType: el.type,
          type: stepType,
          order: order++,
        });

        for (const next of adj.get(curr) || []) {
          if (!visited.has(next)) queue.push(next);
        }
      }
    };

    for (const s of startIds) bfs(s);
    // Add any unvisited elements
    for (const el of elements) {
      if (!visited.has(el.id)) bfs(el.id);
    }

    setSteps(ordered);
  }, [parsed]);

  useEffect(() => {
    if (!isPlaying || steps.length === 0) return;
    const next = currentStep + 1 >= steps.length ? 0 : currentStep + 1;
    const delay = 2000 / speed;
    const timer = setTimeout(() => goToStep(next), delay);
    return () => clearTimeout(timer);
  }, [isPlaying, currentStep, steps, speed]);

  useEffect(() => {
    if (steps.length > 0 && currentStep >= 0) {
      onStepChange(steps[currentStep].elementId);
    } else {
      onStepChange(null);
    }
  }, [currentStep, steps, onStepChange]);

  const goToStep = (index: number) => {
    if (index < 0 || index >= steps.length) {
      setCurrentStep(-1);
      setIsPlaying(false);
      return;
    }
    setCurrentStep(index);
  };

  const handlePlay = () => {
    if (steps.length === 0) return;
    if (currentStep < 0) goToStep(0);
    setIsPlaying(!isPlaying);
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    goToStep(currentStep + 1 >= steps.length ? -1 : currentStep + 1);
  };

  const handleStepBack = () => {
    setIsPlaying(false);
    goToStep(currentStep <= 0 ? -1 : currentStep - 1);
  };

  const handleReset = () => {
    setIsPlaying(false);
    goToStep(-1);
  };

  return (
    <div className="flex-1 flex min-h-0">
      {/* Steps list */}
      <div className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-3 border-b border-slate-200">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Percorso del Processo</h3>
          <div className="flex items-center gap-2">
            <button onClick={handleReset} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors" title="Ripristina">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={handlePlay} className="p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg" title={isPlaying ? 'Pausa' : 'Play'}>
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button onClick={handleStepBack} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors" title="Indietro"><SkipBack className="w-4 h-4" /></button>
            <button onClick={handleStepForward} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors" title="Avanti"><SkipForward className="w-4 h-4" /></button>
            <div className="flex items-center gap-0.5 ml-auto">
              {([1, 2, 4] as const).map(s => (
                <button key={s} onClick={() => setSpeed(s)} className={`px-2 py-1 rounded text-[10px] font-medium ${speed === s ? 'bg-blue-100 text-blue-700' : 'text-slate-400 hover:bg-slate-100'}`}>{s}x</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {steps.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-xs">Nessun elemento trovato nel processo</div>
          ) : (
            <div className="space-y-1 p-2">
              {steps.map((step, i) => (
                <button
                  key={step.id}
                  onClick={() => { setIsPlaying(false); goToStep(i); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all ${
                    i === currentStep
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm'
                      : i < currentStep
                      ? 'bg-blue-50 text-blue-700 border border-blue-100'
                      : 'text-slate-600 hover:bg-slate-100 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      i === currentStep ? 'bg-emerald-500 text-white' : i < currentStep ? 'bg-blue-400 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{step.elementName}</p>
                      <p className="text-[10px] opacity-70">{step.elementType}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
