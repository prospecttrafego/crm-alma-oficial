import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type ContactsColumnsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  resetLabel: string;
  doneLabel: string;
  columnIds: string[];
  getColumnLabel: (columnId: string) => string;
  isColumnVisible: (columnId: string) => boolean;
  onToggleColumnVisible: (columnId: string, nextVisible: boolean) => void;
  onReorder: (activeColumnId: string, overColumnId: string) => void;
  onReset: () => void;
};

export function ContactsColumnsDialog({
  open,
  onOpenChange,
  title,
  description,
  resetLabel,
  doneLabel,
  columnIds,
  getColumnLabel,
  isColumnVisible,
  onToggleColumnVisible,
  onReorder,
  onReset,
}: ContactsColumnsDialogProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="space-y-2">
          {columnIds.map((columnId) => (
            <div
              key={columnId}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", columnId);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverId(columnId);
                e.dataTransfer.dropEffect = "move";
              }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverId(null);
                const activeId = e.dataTransfer.getData("text/plain");
                if (!activeId || activeId === columnId) return;
                onReorder(activeId, columnId);
              }}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-2",
                dragOverId === columnId && "bg-muted/50",
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className="truncate text-sm font-medium">{getColumnLabel(columnId)}</span>
                <Checkbox
                  checked={isColumnVisible(columnId)}
                  onCheckedChange={(checked) => onToggleColumnVisible(columnId, !!checked)}
                  aria-label={getColumnLabel(columnId)}
                />
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={onReset} className="w-full sm:w-auto">
            <RotateCcw className="mr-2 h-4 w-4" />
            {resetLabel}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            {doneLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
