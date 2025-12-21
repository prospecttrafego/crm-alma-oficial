import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, DollarSign, User, Building2, GripVertical, ChevronDown } from "lucide-react";
import { FilterPanel, type PipelineFilters } from "@/components/filter-panel";
import { EntityHistory } from "@/components/entity-history";
import { LeadScorePanel } from "@/components/LeadScorePanel";
import type { Deal, PipelineStage, Pipeline, Contact, Company } from "@shared/schema";

interface DealWithRelations extends Deal {
  contact?: Contact;
  company?: Company;
  stage?: PipelineStage;
}

interface PipelineWithStages extends Pipeline {
  stages: PipelineStage[];
}

export default function PipelinePage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [draggedDeal, setDraggedDeal] = useState<DealWithRelations | null>(null);
  const [dragOverStage, setDragOverStage] = useState<number | null>(null);
  const [filters, setFilters] = useState<PipelineFilters>({});
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);

  const { data: allPipelines } = useQuery<PipelineWithStages[]>({
    queryKey: ["/api/pipelines"],
  });

  const { data: pipeline, isLoading: pipelineLoading } = useQuery<PipelineWithStages>({
    queryKey: ["/api/pipelines", selectedPipelineId],
    queryFn: async () => {
      if (selectedPipelineId) {
        const res = await fetch(`/api/pipelines/${selectedPipelineId}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch pipeline");
        return res.json();
      }
      const res = await fetch("/api/pipelines/default", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pipeline");
      return res.json();
    },
  });

  useEffect(() => {
    if (pipeline && !selectedPipelineId) {
      setSelectedPipelineId(pipeline.id);
    }
  }, [pipeline, selectedPipelineId]);

  const { data: deals, isLoading: dealsLoading } = useQuery<DealWithRelations[]>({
    queryKey: ["/api/deals"],
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const moveDealMutation = useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: number; stageId: number }) => {
      await apiRequest("PATCH", `/api/deals/${dealId}`, { stageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({ title: t("toast.updated") });
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "destructive" });
    },
  });

  const createDealMutation = useMutation({
    mutationFn: async (data: Partial<Deal>) => {
      await apiRequest("POST", "/api/deals", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      setNewDealOpen(false);
      toast({ title: t("toast.created") });
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "destructive" });
    },
  });

  const handleDragStart = (e: React.DragEvent, deal: DealWithRelations) => {
    setDraggedDeal(deal);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, stageId: number) => {
    e.preventDefault();
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, stageId: number) => {
    e.preventDefault();
    setDragOverStage(null);
    if (draggedDeal && draggedDeal.stageId !== stageId) {
      moveDealMutation.mutate({ dealId: draggedDeal.id, stageId });
    }
    setDraggedDeal(null);
  };

  const handleCreateDeal = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const firstStage = pipeline?.stages?.[0];
    if (!firstStage || !pipeline) return;

    createDealMutation.mutate({
      title: formData.get("title") as string,
      value: formData.get("value") as string,
      pipelineId: pipeline.id,
      stageId: firstStage.id,
      contactId: formData.get("contactId") ? Number(formData.get("contactId")) : undefined,
      notes: formData.get("notes") as string,
    });
  };

  const getDealsByStage = (stageId: number) => {
    return deals?.filter((deal) => {
      if (deal.stageId !== stageId) return false;
      
      if (filters.stageId && deal.stageId !== filters.stageId) return false;
      if (filters.ownerId && deal.ownerId !== filters.ownerId) return false;
      if (filters.status && deal.status !== filters.status) return false;
      if (filters.minValue && Number(deal.value || 0) < filters.minValue) return false;
      if (filters.maxValue && Number(deal.value || 0) > filters.maxValue) return false;
      
      if (filters.dateFrom || filters.dateTo) {
        if (!deal.expectedCloseDate) return false;
        const dealDate = new Date(deal.expectedCloseDate);
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom);
          if (dealDate < fromDate) return false;
        }
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo);
          if (dealDate > toDate) return false;
        }
      }
      
      return true;
    }) || [];
  };

  const getStageValue = (stageId: number) => {
    const stageDeals = getDealsByStage(stageId);
    return stageDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  };

  if (pipelineLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Skeleton className="mx-auto h-8 w-32" />
          <Skeleton className="mx-auto mt-2 h-4 w-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 border-b p-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold" data-testid="text-pipeline-title">
              {t("pipeline.title")}
            </h1>
            {allPipelines && allPipelines.length > 1 && (
              <Select
                value={selectedPipelineId?.toString() || ""}
                onValueChange={(val) => setSelectedPipelineId(Number(val))}
              >
                <SelectTrigger
                  className="w-[200px]"
                  data-testid="select-pipeline"
                >
                  <SelectValue placeholder={t("settings.pipelines.pipelineName")}>
                    {pipeline?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {allPipelines.map((p) => (
                    <SelectItem
                      key={p.id}
                      value={p.id.toString()}
                      data-testid={`select-pipeline-option-${p.id}`}
                    >
                      {p.name} {p.isDefault && `(${t("settings.pipelines.default")})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(!allPipelines || allPipelines.length <= 1) && (
              <span className="text-lg font-semibold text-muted-foreground">
                {pipeline?.name}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("pipeline.dragToMove")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterPanel
            type="pipeline"
            filters={filters}
            onFiltersChange={(f) => setFilters(f as PipelineFilters)}
            stages={pipeline?.stages}
          />
          <Dialog open={newDealOpen} onOpenChange={setNewDealOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto" data-testid="button-new-deal">
              <Plus className="mr-2 h-4 w-4" />
              {t("pipeline.newDeal")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateDeal}>
              <DialogHeader>
                <DialogTitle>{t("pipeline.newDeal")}</DialogTitle>
                <DialogDescription>
                  {t("pipeline.noDeals")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">{t("pipeline.dealTitle")}</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder={t("pipeline.dealTitlePlaceholder")}
                    required
                    data-testid="input-deal-title"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="value">{t("pipeline.dealValue")} (R$)</Label>
                  <Input
                    id="value"
                    name="value"
                    type="number"
                    placeholder="10000"
                    data-testid="input-deal-value"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactId">{t("pipeline.contact")} ({t("common.optional")})</Label>
                  <select
                    id="contactId"
                    name="contactId"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    data-testid="select-deal-contact"
                  >
                    <option value="">{t("common.search")}...</option>
                    {contacts?.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.firstName} {contact.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">{t("common.notes")}</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder={t("common.description")}
                    data-testid="input-deal-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNewDealOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={createDealMutation.isPending}
                  data-testid="button-create-deal-submit"
                >
                  {createDealMutation.isPending ? t("common.saving") : t("common.create")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {pipeline?.stages?.map((stage) => (
          <div
            key={stage.id}
            className={`flex w-72 flex-shrink-0 flex-col rounded-lg border bg-card ${
              dragOverStage === stage.id ? "ring-2 ring-primary" : ""
            }`}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage.id)}
            data-testid={`column-stage-${stage.id}`}
          >
            <div className="flex items-center justify-between border-b p-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: stage.color || "#605be5" }}
                />
                <h3 className="font-semibold">{stage.name}</h3>
                <Badge variant="secondary" className="text-xs">
                  {getDealsByStage(stage.id).length}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                R$ {getStageValue(stage.id).toLocaleString("pt-BR")}
              </span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {dealsLoading ? (
                [...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))
              ) : (
                getDealsByStage(stage.id).map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, deal)}
                    onClick={() => setSelectedDeal(deal)}
                    className={`cursor-pointer rounded-md border bg-background p-3 shadow-sm transition-all hover:shadow-md ${
                      draggedDeal?.id === deal.id ? "opacity-50" : ""
                    }`}
                    data-testid={`card-deal-${deal.id}`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <GripVertical className="h-4 w-4 flex-shrink-0 cursor-grab text-muted-foreground" />
                      <h4 className="flex-1 truncate text-sm font-medium">
                        {deal.title}
                      </h4>
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
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!selectedDeal} onOpenChange={() => setSelectedDeal(null)}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>{selectedDeal?.title}</SheetTitle>
            </div>
            <SheetDescription>{t("common.details")}</SheetDescription>
          </SheetHeader>

          {selectedDeal && (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{t("pipeline.dealValue")}</p>
                  <p className="text-lg font-semibold">
                    R$ {Number(selectedDeal.value || 0).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{t("pipeline.probability")}</p>
                  <p className="text-lg font-semibold">
                    {selectedDeal.probability || 0}%
                  </p>
                </div>
              </div>

              {selectedDeal.contact && (
                <div className="rounded-md border p-4">
                  <h4 className="mb-2 text-sm font-medium">{t("pipeline.contact")}</h4>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {selectedDeal.contact.firstName} {selectedDeal.contact.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedDeal.contact.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedDeal.notes && (
                <div className="rounded-md border p-4">
                  <h4 className="mb-2 text-sm font-medium">{t("common.notes")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedDeal.notes}
                  </p>
                </div>
              )}

              <div className="rounded-md border p-4">
                <h4 className="mb-2 text-sm font-medium">{t("common.status")}</h4>
                <Badge>{t(`pipeline.status.${selectedDeal.status}`)}</Badge>
              </div>

              <LeadScorePanel entityType="deal" entityId={selectedDeal.id} />

              <div className="rounded-md border">
                <EntityHistory entityType="deal" entityId={selectedDeal.id} />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
