import { memo } from "react";
import { Building2, DollarSign, GripVertical, User } from "lucide-react";

import type { DealWithRelations } from "../types";

type Props = {
  deal: DealWithRelations;
  dragging: boolean;
  onClick: (deal: DealWithRelations) => void;
  onDragStart: (event: React.DragEvent, deal: DealWithRelations) => void;
};

function DealCardComponent({ deal, dragging, onClick, onDragStart }: Props) {
  return (
    <div
      draggable
      onDragStart={(event) => onDragStart(event, deal)}
      onClick={() => onClick(deal)}
      className={`cursor-pointer rounded-md border bg-background p-3 shadow-sm transition-all hover:shadow-md ${
        dragging ? "opacity-50" : ""
      }`}
      data-testid={`card-deal-${deal.id}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <GripVertical className="h-4 w-4 flex-shrink-0 cursor-grab text-muted-foreground" />
        <h4 className="flex-1 truncate text-sm font-medium">{deal.title}</h4>
      </div>
      {deal.value && (
        <div className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
          <DollarSign className="h-3 w-3" />
          R$ {Number(deal.value).toLocaleString("pt-BR")}
        </div>
      )}
      {deal.contact && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          {deal.contact.firstName} {deal.contact.lastName}
        </div>
      )}
      {deal.company && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" />
          {deal.company.name}
        </div>
      )}
    </div>
  );
}

export const DealCard = memo(DealCardComponent);

