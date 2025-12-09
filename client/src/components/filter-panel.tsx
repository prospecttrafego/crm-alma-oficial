import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Filter, Save, X, ChevronDown, Trash2, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import type { SavedView, User, PipelineStage } from "@shared/schema";

export interface PipelineFilters {
  stageId?: number;
  ownerId?: string;
  minValue?: number;
  maxValue?: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface InboxFilters {
  channel?: string;
  status?: string;
  assignedToId?: string;
}

interface FilterPanelProps {
  type: "pipeline" | "inbox";
  filters: PipelineFilters | InboxFilters;
  onFiltersChange: (filters: PipelineFilters | InboxFilters) => void;
  stages?: PipelineStage[];
}

export function FilterPanel({ type, filters, onFiltersChange, stages }: FilterPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");

  const { data: savedViews } = useQuery<SavedView[]>({
    queryKey: ["/api/saved-views", type],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/saved-views?type=${type}`);
      return res.json();
    },
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const saveViewMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; filters: Record<string, unknown> }) => {
      await apiRequest("POST", "/api/saved-views", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-views", type] });
      setSaveDialogOpen(false);
      setViewName("");
      toast({ title: "View saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save view", variant: "destructive" });
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/saved-views/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-views", type] });
      toast({ title: "View deleted" });
    },
  });

  const handleSaveView = () => {
    if (!viewName.trim()) return;
    saveViewMutation.mutate({
      name: viewName,
      type,
      filters: filters as Record<string, unknown>,
    });
  };

  const handleLoadView = (view: SavedView) => {
    onFiltersChange(view.filters as PipelineFilters | InboxFilters);
    setIsOpen(false);
  };

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== "");
  const activeFilterCount = Object.values(filters).filter((v) => v !== undefined && v !== "").length;

  const pipelineFilters = filters as PipelineFilters;
  const inboxFilters = filters as InboxFilters;

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" data-testid="button-filter">
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge className="ml-2" variant="secondary">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filters</h4>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  data-testid="button-clear-filters"
                >
                  <X className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>

            {type === "pipeline" && (
              <>
                {stages && stages.length > 0 && (
                  <div className="space-y-2">
                    <Label>Stage</Label>
                    <Select
                      value={pipelineFilters.stageId?.toString() || "all"}
                      onValueChange={(v) =>
                        onFiltersChange({ ...pipelineFilters, stageId: v === "all" ? undefined : parseInt(v) })
                      }
                    >
                      <SelectTrigger data-testid="select-filter-stage">
                        <SelectValue placeholder="All stages" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All stages</SelectItem>
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id.toString()}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Owner</Label>
                  <Select
                    value={pipelineFilters.ownerId || "all"}
                    onValueChange={(v) =>
                      onFiltersChange({ ...pipelineFilters, ownerId: v === "all" ? undefined : v })
                    }
                  >
                    <SelectTrigger data-testid="select-filter-owner">
                      <SelectValue placeholder="All owners" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All owners</SelectItem>
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Value Range</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={pipelineFilters.minValue || ""}
                      onChange={(e) =>
                        onFiltersChange({
                          ...pipelineFilters,
                          minValue: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      data-testid="input-filter-min-value"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={pipelineFilters.maxValue || ""}
                      onChange={(e) =>
                        onFiltersChange({
                          ...pipelineFilters,
                          maxValue: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      data-testid="input-filter-max-value"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={pipelineFilters.status || "all"}
                    onValueChange={(v) =>
                      onFiltersChange({ ...pipelineFilters, status: v === "all" ? undefined : v })
                    }
                  >
                    <SelectTrigger data-testid="select-filter-status">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Expected Close Date</Label>
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 justify-start text-left font-normal"
                          data-testid="button-filter-date-from"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {pipelineFilters.dateFrom
                            ? format(new Date(pipelineFilters.dateFrom), "MMM dd")
                            : "From"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={pipelineFilters.dateFrom ? new Date(pipelineFilters.dateFrom) : undefined}
                          onSelect={(date) =>
                            onFiltersChange({
                              ...pipelineFilters,
                              dateFrom: date ? date.toISOString() : undefined,
                            })
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="text-muted-foreground">-</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 justify-start text-left font-normal"
                          data-testid="button-filter-date-to"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {pipelineFilters.dateTo
                            ? format(new Date(pipelineFilters.dateTo), "MMM dd")
                            : "To"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={pipelineFilters.dateTo ? new Date(pipelineFilters.dateTo) : undefined}
                          onSelect={(date) =>
                            onFiltersChange({
                              ...pipelineFilters,
                              dateTo: date ? date.toISOString() : undefined,
                            })
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </>
            )}

            {type === "inbox" && (
              <>
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select
                    value={inboxFilters.channel || "all"}
                    onValueChange={(v) =>
                      onFiltersChange({ ...inboxFilters, channel: v === "all" ? undefined : v })
                    }
                  >
                    <SelectTrigger data-testid="select-filter-channel">
                      <SelectValue placeholder="All channels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All channels</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={inboxFilters.status || "all"}
                    onValueChange={(v) =>
                      onFiltersChange({ ...inboxFilters, status: v === "all" ? undefined : v })
                    }
                  >
                    <SelectTrigger data-testid="select-filter-inbox-status">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assigned To</Label>
                  <Select
                    value={inboxFilters.assignedToId || "all"}
                    onValueChange={(v) =>
                      onFiltersChange({ ...inboxFilters, assignedToId: v === "all" ? undefined : v })
                    }
                  >
                    <SelectTrigger data-testid="select-filter-assigned">
                      <SelectValue placeholder="Anyone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Anyone</SelectItem>
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setIsOpen(false);
                  setSaveDialogOpen(true);
                }}
                disabled={!hasActiveFilters}
                data-testid="button-save-view"
              >
                <Save className="mr-2 h-4 w-4" />
                Save as View
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {savedViews && savedViews.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-saved-views">
              Saved Views
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <div className="space-y-1">
              {savedViews.map((view) => (
                <div
                  key={view.id}
                  className="flex items-center justify-between rounded-md p-2 hover-elevate"
                >
                  <button
                    className="flex-1 text-left text-sm"
                    onClick={() => handleLoadView(view)}
                    data-testid={`saved-view-${view.id}`}
                  >
                    {view.name}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => deleteViewMutation.mutate(view.id)}
                    data-testid={`delete-view-${view.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
            <DialogDescription>
              Give your filter configuration a name to save it for quick access.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="viewName">View Name</Label>
            <Input
              id="viewName"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="e.g., High Value Deals"
              data-testid="input-view-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveView}
              disabled={!viewName.trim() || saveViewMutation.isPending}
              data-testid="button-confirm-save-view"
            >
              {saveViewMutation.isPending ? "Saving..." : "Save View"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
