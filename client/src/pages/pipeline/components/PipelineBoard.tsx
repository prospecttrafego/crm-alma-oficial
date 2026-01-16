import type { PipelineStage } from "@shared/schema";

import type { DealWithRelations } from "../types";
import { PipelineStageColumn } from "./PipelineStageColumn";

type Props = {
  stages: PipelineStage[];
  dealsByStage: Map<number, DealWithRelations[]>;
  stageValues: Map<number, number>;
  dealsLoading: boolean;
  dragOverStageId: number | null;
  draggedDealId: number | null;
  onDragOverStage: (event: React.DragEvent, stageId: number) => void;
  onDragLeaveStage: () => void;
  onDropOnStage: (event: React.DragEvent, stageId: number) => void;
  onDealDragStart: (event: React.DragEvent, deal: DealWithRelations) => void;
  onDealClick: (deal: DealWithRelations) => void;
};

export function PipelineBoard({
  stages,
  dealsByStage,
  stageValues,
  dealsLoading,
  dragOverStageId,
  draggedDealId,
  onDragOverStage,
  onDragLeaveStage,
  onDropOnStage,
  onDealDragStart,
  onDealClick,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto p-4">
      {stages.map((stage) => (
        <PipelineStageColumn
          key={stage.id}
          stage={stage}
          deals={dealsByStage.get(stage.id) || []}
          stageValue={stageValues.get(stage.id) || 0}
          dealsLoading={dealsLoading}
          dragOver={dragOverStageId === stage.id}
          draggedDealId={draggedDealId}
          onDragOver={onDragOverStage}
          onDragLeave={onDragLeaveStage}
          onDrop={onDropOnStage}
          onDealDragStart={onDealDragStart}
          onDealClick={onDealClick}
        />
      ))}
    </div>
  );
}
