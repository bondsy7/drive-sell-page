import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PIPELINE_STAGES, STAGE_CONFIG } from './crm-constants';

interface CrmPipelineBarProps {
  pipelineCounts: Record<string, number>;
  filterStage: string;
  onFilterStage: (stage: string) => void;
}

export function CrmPipelineBar({ pipelineCounts, filterStage, onFilterStage }: CrmPipelineBarProps) {
  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex">
          {PIPELINE_STAGES.map((stage, idx) => {
            const cfg = STAGE_CONFIG[stage.key];
            const count = pipelineCounts[stage.key] || 0;
            return (
              <button
                key={stage.key}
                onClick={() => onFilterStage(filterStage === stage.key ? 'all' : stage.key)}
                className={`flex-1 py-3 px-2 text-center transition-all relative group
                  ${filterStage === stage.key ? 'ring-2 ring-accent ring-inset' : ''}
                  ${idx > 0 ? 'border-l border-border/30' : ''}`}
              >
                <div className={`w-6 h-6 rounded-full ${cfg?.color || 'bg-muted'} mx-auto mb-1 flex items-center justify-center text-white`}>
                  <span className="text-[10px] font-bold">{count}</span>
                </div>
                <p className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {stage.label}
                </p>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <ArrowRight className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 text-muted-foreground/30 z-10" />
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
