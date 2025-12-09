import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Plus,
  Pencil,
  Trash2,
  User,
  Building2,
  Users,
  Kanban,
  Shield,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditLog, AuditLogAction, AuditLogEntityType } from "@shared/schema";

type EnrichedAuditLog = AuditLog & {
  user: { id: string; firstName: string | null; lastName: string | null } | null;
};

const actionIcons: Record<AuditLogAction, typeof Plus> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
};

const actionColors: Record<AuditLogAction, string> = {
  create: "bg-green-500/10 text-green-500",
  update: "bg-blue-500/10 text-blue-500",
  delete: "bg-red-500/10 text-red-500",
};

const entityIcons: Record<AuditLogEntityType, typeof Kanban> = {
  deal: Kanban,
  contact: Users,
  company: Building2,
  conversation: User,
  activity: User,
  pipeline: Kanban,
  email_template: User,
};

export default function AuditLogPage() {
  const { data: logs, isLoading } = useQuery<EnrichedAuditLog[]>({
    queryKey: ["/api/audit-logs"],
  });

  const formatUserName = (user: EnrichedAuditLog["user"]) => {
    if (!user) return "System";
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.firstName || "Unknown User";
  };

  const ActionIcon = ({ action }: { action: AuditLogAction }) => {
    const Icon = actionIcons[action];
    return <Icon className="h-4 w-4" />;
  };

  const EntityIcon = ({ entityType }: { entityType: AuditLogEntityType }) => {
    const Icon = entityIcons[entityType] || User;
    return <Icon className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col p-6">
        <div className="mb-6 flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Audit Log</h1>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-audit-log-title">
            Audit Log
          </h1>
          <p className="text-sm text-muted-foreground">
            Track all changes made to your CRM data
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead className="w-[150px]">User</TableHead>
              <TableHead className="w-[100px]">Action</TableHead>
              <TableHead className="w-[120px]">Entity Type</TableHead>
              <TableHead>Entity Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No audit logs yet. Changes to deals, contacts, and companies will appear here.
                </TableCell>
              </TableRow>
            ) : (
              logs?.map((log) => (
                <TableRow key={log.id} data-testid={`row-audit-log-${log.id}`}>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.createdAt
                      ? format(new Date(log.createdAt), "MMM d, yyyy HH:mm")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{formatUserName(log.user)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`gap-1 ${actionColors[log.action as AuditLogAction]}`}
                    >
                      <ActionIcon action={log.action as AuditLogAction} />
                      <span className="capitalize">{log.action}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EntityIcon entityType={log.entityType as AuditLogEntityType} />
                      <span className="text-sm capitalize">
                        {log.entityType.replace("_", " ")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {log.entityName || `#${log.entityId}`}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
