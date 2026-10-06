import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  FastForward,
  CheckCircle,
  X,
} from 'lucide-react';

interface SimulationControlsProps {
  bpmnViewerInstance: any;
  onActiveElementChange: (elementId: string | null) => void;
  onCloseSimulation: () => void;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  bpmnViewerInstance,
  onActiveElementChange,
  onCloseSimulation,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1500); // ms per step
  const [simulationPath, setSimulationPath] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // Extract execution path starting from Start Event
  useEffect(() => {
    if (!bpmnViewerInstance) return;

    try {
      const elementRegistry = bpmnViewerInstance.get('elementRegistry');
      const path: Array<{ id: string; name: string; type: string }> = [];
      const visited = new Set<string>();

      // Find start event
      let startNode: any = null;
      elementRegistry.forEach((el: any) => {
        if (el.type === 'bpmn:StartEvent' && !startNode) {
          startNode = el;
        }
      });

      if (!startNode) return;

      let currentNode = startNode;
      while (currentNode && !visited.has(currentNode.id)) {
        visited.add(currentNode.id);
        const name = currentNode.businessObject?.name || currentNode.id;
        path.push({
          id: currentNode.id,
          name,
          type: currentNode.type.replace('bpmn:', ''),
        });

        // Pick next node from outgoing flows
        const outgoing = currentNode.outgoing || [];
        if (outgoing.length > 0) {
          const nextFlow = outgoing[0];
          currentNode = nextFlow.target;
        } else {
          currentNode = null;
        }
      }

      setSimulationPath(path);
      if (path.length > 0) {
        setCurrentIndex(0);
        onActiveElementChange(path[0].id);
      }
    } catch (e) {
      console.error('Build path error', e);
    }
  }, [bpmnViewerInstance]);

  // Handle Play/Pause timer
  useEffect(() => {
    let timer: any = null;

    if (isPlaying && simulationPath.length > 0) {
      timer = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          if (next >= simulationPath.length) {
            setIsPlaying(false);
            return prev;
          }
          onActiveElementChange(simulationPath[next].id);
          return next;
        });
      }, speed);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, speed, simulationPath]);

  const handleStepForward = () => {
    if (currentIndex < simulationPath.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      onActiveElementChange(simulationPath[next].id);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
    if (simulationPath.length > 0) {
      onActiveElementChange(simulationPath[0].id);
    } else {
      onActiveElementChange(null);
    }
  };

  const currentStep = simulationPath[currentIndex];

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-2xl p-3 flex items-center gap-4 z-30 animate-slideDown">
      {/* Status indicator */}
      <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
        <div className="text-left">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Simulazione Flusso</p>
          <p className="text-xs font-bold text-slate-800 truncate max-w-[200px]">
            {currentStep ? `${currentIndex + 1}/${simulationPath.length}: ${currentStep.name}` : 'Pronto'}
          </p>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleReset}
          title="Riavvia Simulazione"
          className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`p-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" />
              <span>Pausa</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Avvia Token</span>
            </>
          )}
        </button>

        <button
          onClick={handleStepForward}
          disabled={currentIndex >= simulationPath.length - 1}
          title="Passo Successivo"
          className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 disabled:opacity-40 transition-colors"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Speed Selector */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
        {[
          { label: '1x', speed: 1500 },
          { label: '2x', speed: 800 },
          { label: '4x', speed: 300 },
        ].map((sp) => (
          <button
            key={sp.label}
            onClick={() => setSpeed(sp.speed)}
            className={`px-2 py-0.5 rounded-lg transition-all ${
              speed === sp.speed ? 'bg-white text-emerald-700 font-bold shadow-2xs' : 'hover:text-slate-900'
            }`}
          >
            {sp.label}
          </button>
        ))}
      </div>

      {/* Close Simulation Mode */}
      <button
        onClick={() => {
          handleReset();
          onCloseSimulation();
        }}
        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg ml-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
