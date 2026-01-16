import { Virtuoso } from "react-virtuoso";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PipelineStage } from "@shared/schema";

import type { DealWithRelations } from "../types";
import { DealCard } from "./DealCard";

type Props = {
  stage: PipelineStage;
  deals: DealWithRelations[];
  stageValue: number;
  dealsLoading: boolean;
  dragOver: boolean;
  draggedDealId: number | null;
  onDragOver: (event: React.DragEvent, stageId: number) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent, stageId: number) => void;
  onDealDragStart: (event: React.DragEvent, deal: DealWithRelations) => void;
  onDealClick: (deal: DealWithRelations) => void;
};

export function PipelineStageColumn({
  stage,
  deals,
  stageValue,
  dealsLoading,
  dragOver,
  draggedDealId,
  onDragOver,
  onDragLeave,
  onDrop,
  onDealDragStart,
  onDealClick,
}: Props) {
  return (
    <div
      className={`flex min-h-0 w-72 flex-shrink-0 flex-col rounded-lg border bg-card ${
        dragOver ? "ring-2 ring-primary" : ""
      }`}
      onDragOver={(event) => onDragOver(event, stage.id)}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(event, stage.id)}
      data-testid={`column-stage-${stage.id}`}
    >
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color || "hsl(var(--primary))" }} />
          <h3 className="font-semibold">{stage.name}</h3>
          <Badge variant="secondary" className="text-xs">
            {deals.length}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">R$ {stageValue.toLocaleString("pt-BR")}</span>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden p-2">
        {dealsLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <Virtuoso
            style={{ height: "100%" }}
            data={deals}
            computeItemKey={(_index, deal) => deal.id}
            itemContent={(_index, deal) => (
              <div className="pb-2">
                <DealCard
                  deal={deal}
                  dragging={draggedDealId === deal.id}
                  onClick={onDealClick}
                  onDragStart={onDealDragStart}
                />
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
