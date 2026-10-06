import { useState, useEffect, useCallback } from 'react';
import { SimulationStep } from '../types';
import { Play, Pause, StepForward, RotateCcw, SkipBack, Loader2 } from 'lucide-react';

interface Props {
  bpmnViewerInstance: any;
  onActiveElementChange: (id: string | null) => void;
  onCloseSimulation: () => void;
}

export function SimulationControls({ bpmnViewerInstance, onActiveElementChange, onCloseSimulation }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [steps, setSteps] = useState<SimulationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);

  const buildSteps = useCallback(() => {
    if (!bpmnViewerInstance) return;
    const registry = bpmnViewerInstance.get('elementRegistry');
    const elements = registry.getAll();
    const simSteps: SimulationStep[] = [];
    const startElements = elements.filter((e: any) => e.type === 'bpmn:StartEvent');
    const visited = new Set<string>();
    const traverse = (elementId: string) => {
      if (visited.has(elementId)) return;
      visited.add(elementId);
      const el = registry.get(elementId);
      if (!el) return;
      if (el.type !== 'bpmn:SequenceFlow') {
        simSteps.push({ elementId: el.id, elementName: el.businessObject?.name || el.id, elementType: el.type?.replace('bpmn:', '') || '' });
      }
      if (el.outgoing) {
        for (const flow of el.outgoing) {
          if (flow.target) traverse(flow.target.id);
        }
      }
    };
    if (startElements.length > 0) {
      traverse(startElements[0].id);
    } else {
      elements.forEach((e: any) => {
        if (e.type !== 'bpmn:SequenceFlow' && !visited.has(e.id)) traverse(e.id);
      });
    }
    setSteps(simSteps);
  }, [bpmnViewerInstance]);

  useEffect(() => { buildSteps(); }, [buildSteps]);

  const goToStep = useCallback((index: number) => {
    if (index < 0 || index >= steps.length) {
      setCurrentStepIndex(-1);
      onActiveElementChange(null);
      return;
    }
    setCurrentStepIndex(index);
    onActiveElementChange(steps[index].elementId);
  }, [steps, onActiveElementChange]);

  useEffect(() => {
    if (!isPlaying || steps.length === 0) return;
    const nextIndex = currentStepIndex + 1 >= steps.length ? 0 : currentStepIndex + 1;
    const delay = 1500 / speed;
    const timer = setTimeout(() => goToStep(nextIndex), delay);
    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIndex, steps.length, speed, goToStep]);

  const handlePlay = () => {
    if (steps.length === 0) return;
    if (currentStepIndex < 0) goToStep(0);
    setIsPlaying(!isPlaying);
  };

  const handleStep = () => {
    setIsPlaying(false);
    const next = currentStepIndex + 1 >= steps.length ? 0 : currentStepIndex + 1;
    goToStep(next);
  };

  const handleReset = () => {
    setIsPlaying(false);
    goToStep(-1);
  };

  return (
    <div className="w-64 bg-white border-l border-slate-200 flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-slate-100">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Simulazione</h3>
        <div className="flex items-center justify-center gap-2">
          <button onClick={handleReset} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors" title="Ripristina"><RotateCcw className="w-4 h-4" /></button>
          <button onClick={handlePlay} className="p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg" title={isPlaying ? 'Pausa' : 'Play'}>
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button onClick={handleStep} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors" title="Passo successivo"><StepForward className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center justify-center gap-1 mt-2">
          {([1, 2, 4] as const).map(s => (
            <button key={s} onClick={() => setSpeed(s)} className={`px-3 py-1 rounded-md text-[10px] font-medium transition-colors ${speed === s ? 'bg-blue-100 text-blue-700' : 'text-slate-400 hover:bg-slate-50'}`}>{s}x</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-xs text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" />Analisi percorso...</div>
        ) : (
          <div className="space-y-1">
            {steps.map((step, i) => (
              <button key={step.elementId} onClick={() => goToStep(i)} className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${i === currentStepIndex ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'text-slate-600 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i === currentStepIndex ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{step.elementName}</p>
                    <p className="text-[10px] text-slate-400">{step.elementType}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="p-3 border-t border-slate-100">
        <button onClick={onCloseSimulation} className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-600 transition-colors">Chiudi Simulazione</button>
      </div>
    </div>
  );
}
