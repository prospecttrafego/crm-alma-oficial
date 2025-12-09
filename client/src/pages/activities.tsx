import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Phone, Mail, Calendar, FileText, CheckSquare, Clock, Check } from "lucide-react";
import type { Activity, Contact, Deal } from "@shared/schema";

interface ActivityWithRelations extends Activity {
  contact?: Contact;
  deal?: Deal;
}

const activityIcons = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  task: CheckSquare,
};

export default function ActivitiesPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [newActivityOpen, setNewActivityOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: activities, isLoading } = useQuery<ActivityWithRelations[]>({
    queryKey: ["/api/activities"],
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: deals } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: Partial<Activity>) => {
      await apiRequest("POST", "/api/activities", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      setNewActivityOpen(false);
      toast({ title: "Activity created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create activity", variant: "destructive" });
    },
  });

  const completeActivityMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/activities/${id}`, {
        status: "completed",
        completedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({ title: "Activity marked as complete" });
    },
    onError: () => {
      toast({ title: "Failed to update activity", variant: "destructive" });
    },
  });

  const handleCreateActivity = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createActivityMutation.mutate({
      type: formData.get("type") as Activity["type"],
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      contactId: formData.get("contactId") ? Number(formData.get("contactId")) : undefined,
      dealId: formData.get("dealId") ? Number(formData.get("dealId")) : undefined,
      dueDate: formData.get("dueDate") ? new Date(formData.get("dueDate") as string) : undefined,
    });
  };

  const filteredActivities = activities?.filter((activity) => {
    if (filterType !== "all" && activity.type !== filterType) return false;
    if (filterStatus !== "all" && activity.status !== filterStatus) return false;
    if (!searchQuery) return true;
    return activity.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const isOverdue = (dueDate: Date | string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-activities-title">Activities</h1>
          <p className="text-muted-foreground">
            Track your tasks, calls, and meetings
          </p>
        </div>
        <Dialog open={newActivityOpen} onOpenChange={setNewActivityOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-activity">
              <Plus className="mr-2 h-4 w-4" />
              New Activity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateActivity}>
              <DialogHeader>
                <DialogTitle>Create Activity</DialogTitle>
                <DialogDescription>
                  Add a new task, call, meeting, or note
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">Type</Label>
                  <Select name="type" required>
                    <SelectTrigger data-testid="select-activity-type">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    required
                    data-testid="input-activity-title"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    data-testid="input-activity-description"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    name="dueDate"
                    type="date"
                    data-testid="input-activity-dueDate"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactId">Related Contact</Label>
                  <select
                    id="contactId"
                    name="contactId"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    data-testid="select-activity-contact"
                  >
                    <option value="">Select contact...</option>
                    {contacts?.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.firstName} {contact.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dealId">Related Deal</Label>
                  <select
                    id="dealId"
                    name="dealId"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    data-testid="select-activity-deal"
                  >
                    <option value="">Select deal...</option>
                    {deals?.map((deal) => (
                      <option key={deal.id} value={deal.id}>
                        {deal.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNewActivityOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createActivityMutation.isPending}
                  data-testid="button-create-activity-submit"
                >
                  {createActivityMutation.isPending ? "Creating..." : "Create Activity"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-activities"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-type">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="task">Tasks</SelectItem>
            <SelectItem value="call">Calls</SelectItem>
            <SelectItem value="email">Emails</SelectItem>
            <SelectItem value="meeting">Meetings</SelectItem>
            <SelectItem value="note">Notes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-md border p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : filteredActivities && filteredActivities.length > 0 ? (
          <div className="space-y-3">
            {filteredActivities.map((activity) => {
              const Icon = activityIcons[activity.type as keyof typeof activityIcons] || FileText;
              return (
                <div
                  key={activity.id}
                  className={`flex items-center gap-4 rounded-md border p-4 ${
                    activity.status === "completed" ? "opacity-60" : ""
                  }`}
                  data-testid={`card-activity-${activity.id}`}
                >
                  <button
                    onClick={() => {
                      if (activity.status !== "completed") {
                        completeActivityMutation.mutate(activity.id);
                      }
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:bg-accent"
                    disabled={activity.status === "completed"}
                    data-testid={`button-complete-activity-${activity.id}`}
                  >
                    {activity.status === "completed" ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>

                  <div className="flex-1">
                    <p
                      className={`font-medium ${
                        activity.status === "completed" ? "line-through" : ""
                      }`}
                    >
                      {activity.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline" className="capitalize">
                        {activity.type}
                      </Badge>
                      {activity.contact && (
                        <span>
                          {activity.contact.firstName} {activity.contact.lastName}
                        </span>
                      )}
                      {activity.deal && (
                        <span className="text-primary">{activity.deal.title}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {activity.dueDate && (
                      <div
                        className={`flex items-center gap-1 text-sm ${
                          isOverdue(activity.dueDate) && activity.status !== "completed"
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        {formatDate(activity.dueDate)}
                      </div>
                    )}
                    <Badge
                      variant={activity.status === "completed" ? "secondary" : "default"}
                    >
                      {activity.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-md border">
            <div className="text-center text-muted-foreground">
              <CheckSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No activities found</p>
              <p className="text-sm">Create your first activity to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
