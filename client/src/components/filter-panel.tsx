import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import { savedViewsApi } from "@/lib/api/savedViews";
import { usersApi } from "@/lib/api/users";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import type { SavedView, PipelineStage } from "@shared/schema";
import type { SafeUser } from "@shared/types";
import type { CreateSavedViewDTO } from "@shared/types";
import { useTranslation } from "@/contexts/LanguageContext";

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
  const { t, language } = useTranslation();
  const locale = language === "pt-BR" ? ptBR : enUS;
  const [isOpen, setIsOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");

  const { data: savedViews } = useQuery<SavedView[]>({
    queryKey: ["/api/saved-views", type],
    queryFn: () => savedViewsApi.listByType(type),
  });

  const { data: users } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
    queryFn: usersApi.list,
  });

  const saveViewMutation = useMutation({
    mutationFn: async (data: CreateSavedViewDTO) => {
      await savedViewsApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-views", type] });
      setSaveDialogOpen(false);
      setViewName("");
      toast({ title: t("filters.toast.saved") });
    },
    onError: () => {
      toast({ title: t("filters.toast.saveError"), variant: "destructive" });
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: async (id: number) => {
      await savedViewsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-views", type] });
      toast({ title: t("filters.toast.deleted") });
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
            {t("filters.title")}
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
              <h4 className="font-medium">{t("filters.title")}</h4>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  data-testid="button-clear-filters"
                >
                  <X className="mr-1 h-3 w-3" />
                  {t("filters.clear")}
                </Button>
              )}
            </div>

            {type === "pipeline" && (
              <>
                {stages && stages.length > 0 && (
                  <div className="space-y-2">
                    <Label>{t("filters.stage")}</Label>
                    <Select
                      value={pipelineFilters.stageId?.toString() || "all"}
                      onValueChange={(v) =>
                        onFiltersChange({ ...pipelineFilters, stageId: v === "all" ? undefined : parseInt(v) })
                      }
                    >
                      <SelectTrigger data-testid="select-filter-stage">
                        <SelectValue placeholder={t("filters.allStages")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("filters.allStages")}</SelectItem>
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
                  <Label>{t("filters.owner")}</Label>
                  <Select
                    value={pipelineFilters.ownerId || "all"}
                    onValueChange={(v) =>
                      onFiltersChange({ ...pipelineFilters, ownerId: v === "all" ? undefined : v })
                    }
                  >
                    <SelectTrigger data-testid="select-filter-owner">
                      <SelectValue placeholder={t("filters.allOwners")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("filters.allOwners")}</SelectItem>
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("filters.valueRange")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder={t("filters.min")}
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
                      placeholder={t("filters.max")}
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
                  <Label>{t("filters.status")}</Label>
                  <Select
                    value={pipelineFilters.status || "all"}
                    onValueChange={(v) =>
                      onFiltersChange({ ...pipelineFilters, status: v === "all" ? undefined : v })
                    }
                  >
                    <SelectTrigger data-testid="select-filter-status">
                      <SelectValue placeholder={t("filters.allStatuses")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
                      <SelectItem value="open">{t("pipeline.status.open")}</SelectItem>
                      <SelectItem value="won">{t("pipeline.status.won")}</SelectItem>
                      <SelectItem value="lost">{t("pipeline.status.lost")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("filters.expectedCloseDate")}</Label>
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
                            ? format(new Date(pipelineFilters.dateFrom), "MMM dd", { locale })
                            : t("filters.from")}
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
                            ? format(new Date(pipelineFilters.dateTo), "MMM dd", { locale })
                            : t("filters.to")}
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
                  <Label>{t("filters.channel")}</Label>
                  <Select
                    value={inboxFilters.channel || "all"}
                    onValueChange={(v) =>
                      onFiltersChange({ ...inboxFilters, channel: v === "all" ? undefined : v })
                    }
                  >
                    <SelectTrigger data-testid="select-filter-channel">
                      <SelectValue placeholder={t("filters.allChannels")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("filters.allChannels")}</SelectItem>
                      <SelectItem value="email">{t("inbox.channels.email")}</SelectItem>
                      <SelectItem value="whatsapp">{t("inbox.channels.whatsapp")}</SelectItem>
                      <SelectItem value="sms">{t("inbox.channels.sms")}</SelectItem>
                      <SelectItem value="phone">{t("inbox.channels.phone")}</SelectItem>
                      <SelectItem value="internal">{t("inbox.channels.internal")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("filters.status")}</Label>
                  <Select
                    value={inboxFilters.status || "all"}
                    onValueChange={(v) =>
                      onFiltersChange({ ...inboxFilters, status: v === "all" ? undefined : v })
                    }
                  >
                    <SelectTrigger data-testid="select-filter-inbox-status">
                      <SelectValue placeholder={t("filters.allStatuses")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
                      <SelectItem value="open">{t("inbox.status.open")}</SelectItem>
                      <SelectItem value="closed">{t("inbox.status.closed")}</SelectItem>
                      <SelectItem value="pending">{t("inbox.status.pending")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("filters.assignedTo")}</Label>
                  <Select
                    value={inboxFilters.assignedToId || "all"}
                    onValueChange={(v) =>
                      onFiltersChange({ ...inboxFilters, assignedToId: v === "all" ? undefined : v })
                    }
                  >
                    <SelectTrigger data-testid="select-filter-assigned">
                      <SelectValue placeholder={t("filters.anyone")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("filters.anyone")}</SelectItem>
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
                {t("filters.saveAsView")}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {savedViews && savedViews.length > 0 && (
        <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" data-testid="button-saved-views">
            {t("filters.savedViews")}
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
            <DialogTitle>{t("filters.saveViewTitle")}</DialogTitle>
            <DialogDescription>{t("filters.saveViewDescription")}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="viewName">{t("filters.viewName")}</Label>
            <Input
              id="viewName"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder={t("filters.viewNamePlaceholder")}
              data-testid="input-view-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSaveView}
              disabled={!viewName.trim() || saveViewMutation.isPending}
              data-testid="button-confirm-save-view"
            >
              {saveViewMutation.isPending ? t("common.saving") : t("filters.saveView")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
