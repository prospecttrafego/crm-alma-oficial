import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, User, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditLog, AuditLogAction, AuditLogEntityType } from "@shared/schema";

type EnrichedAuditLog = AuditLog & {
  user: { id: string; firstName: string | null; lastName: string | null } | null;
};

interface EntityHistoryProps {
  entityType: AuditLogEntityType;
  entityId: number;
}

const actionIcons: Record<AuditLogAction, typeof Plus> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
};

const actionColors: Record<AuditLogAction, string> = {
  create: "text-green-500",
  update: "text-blue-500",
  delete: "text-red-500",
};

const actionLabels: Record<AuditLogAction, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
};

export function EntityHistory({ entityType, entityId }: EntityHistoryProps) {
  const { data: logs, isLoading } = useQuery<EnrichedAuditLog[]>({
    queryKey: ["/api/audit-logs/entity", entityType, entityId],
  });

  const formatUserName = (user: EnrichedAuditLog["user"]) => {
    if (!user) return "System";
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.firstName || "Unknown";
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Activity History</span>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!logs?.length) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
          <Clock className="h-4 w-4" />
          <span>Activity History</span>
        </div>
        <p className="text-sm text-muted-foreground">No history available</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
        <Clock className="h-4 w-4" />
        <span>Activity History</span>
      </div>
      <ScrollArea className="h-[200px]">
        <div className="space-y-3">
          {logs.map((log) => {
            const ActionIcon = actionIcons[log.action as AuditLogAction];
            const actionColor = actionColors[log.action as AuditLogAction];
            const actionLabel = actionLabels[log.action as AuditLogAction];

            return (
              <div
                key={log.id}
                className="flex items-start gap-3"
                data-testid={`history-item-${log.id}`}
              >
                <div className={`mt-0.5 ${actionColor}`}>
                  <ActionIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{actionLabel}</span>
                    {" by "}
                    <span className="text-muted-foreground">{formatUserName(log.user)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {log.createdAt
                      ? format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")
                      : "-"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
