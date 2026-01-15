import { useState, useEffect, useMemo, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/contexts/LanguageContext";
import { pipelinesApi } from "@/lib/api/pipelines";
import { dealsApi } from "@/lib/api/deals";
import { contactsApi } from "@/lib/api/contacts";
import { useDealMutations } from "@/hooks/mutations";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, DollarSign, User, Building2, GripVertical } from "lucide-react";
import { FilterPanel, type PipelineFilters } from "@/components/filter-panel";
import type { Deal, PipelineStage, Contact, Company } from "@shared/schema";
import type { PipelineWithStages } from "@shared/types";
import { DealEditorDialog } from "./deal-editor-dialog";

interface DealWithRelations extends Deal {
  contact?: Contact;
  company?: Company;
  stage?: PipelineStage;
}

export default function PipelinePage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/pipeline/:pipelineId");
  const urlPipelineId = match ? Number(params?.pipelineId) : null;

  const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [draggedDeal, setDraggedDeal] = useState<DealWithRelations | null>(null);
  const [dragOverStage, setDragOverStage] = useState<number | null>(null);
  const [filters, setFilters] = useState<PipelineFilters>({});
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(urlPipelineId);
  // Lost reason modal state
  const [lostReasonModalOpen, setLostReasonModalOpen] = useState(false);
  const [pendingLostDrop, setPendingLostDrop] = useState<{ deal: DealWithRelations; stageId: number } | null>(null);
  const [lostReason, setLostReason] = useState("");
  // Form state for dynamic probability display
  const [probabilityValue, setProbabilityValue] = useState(10);

  // Sync URL parameter with state
  useEffect(() => {
    if (urlPipelineId && urlPipelineId !== selectedPipelineId) {
      setSelectedPipelineId(urlPipelineId);
    }
  }, [urlPipelineId, selectedPipelineId]);

  const { data: allPipelines } = useQuery<PipelineWithStages[]>({
    queryKey: ["/api/pipelines"],
    queryFn: pipelinesApi.list,
  });

  const { data: pipeline, isLoading: pipelineLoading } = useQuery<PipelineWithStages>({
    queryKey: ["/api/pipelines", selectedPipelineId || urlPipelineId],
    queryFn: async () => {
      const idToFetch = selectedPipelineId || urlPipelineId;
      return idToFetch ? pipelinesApi.get(idToFetch) : pipelinesApi.getDefault();
    },
  });

  // Navigate to pipeline URL when selecting a different pipeline
  useEffect(() => {
    if (pipeline && !urlPipelineId) {
      // If on /pipeline without ID, redirect to the default pipeline
      setSelectedPipelineId(pipeline.id);
      setLocation(`/pipeline/${pipeline.id}`);
    }
  }, [pipeline, urlPipelineId, setLocation]);

  const { data: deals, isLoading: dealsLoading } = useQuery<DealWithRelations[]>({
    queryKey: ["/api/deals"],
    queryFn: dealsApi.list,
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    queryFn: contactsApi.list,
  });

  const { moveDeal, createDeal } = useDealMutations();

  // Memoized drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, deal: DealWithRelations) => {
    setDraggedDeal(deal);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stageId: number) => {
    e.preventDefault();
    setDragOverStage(stageId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStage(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, stageId: number) => {
    e.preventDefault();
    setDragOverStage(null);
    if (draggedDeal && draggedDeal.stageId !== stageId) {
      // Check if target stage is a "lost" stage
      const targetStage = pipeline?.stages?.find(s => s.id === stageId);
      if (targetStage?.isLost) {
        // Show lost reason modal
        setPendingLostDrop({ deal: draggedDeal, stageId });
        setLostReason("");
        setLostReasonModalOpen(true);
      } else {
        moveDeal.mutate({ id: draggedDeal.id, data: { stageId } });
      }
    }
    setDraggedDeal(null);
  }, [draggedDeal, moveDeal, pipeline?.stages]);

  const handleConfirmLostDeal = useCallback(() => {
    if (pendingLostDrop) {
      moveDeal.mutate({
        id: pendingLostDrop.deal.id,
        data: {
          stageId: pendingLostDrop.stageId,
          status: "lost",
          lostReason: lostReason || undefined,
        },
      }, {
        onSuccess: () => {
          setLostReasonModalOpen(false);
          setPendingLostDrop(null);
          setLostReason("");
        },
      });
    }
  }, [pendingLostDrop, lostReason, moveDeal]);

  const handleCancelLostDeal = useCallback(() => {
    setLostReasonModalOpen(false);
    setPendingLostDrop(null);
    setLostReason("");
  }, []);

  const handleCreateDeal = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const firstStage = pipeline?.stages?.[0];
    if (!firstStage || !pipeline) return;

    const expectedCloseDateValue = formData.get("expectedCloseDate") as string;
    createDeal.mutate({
      title: formData.get("title") as string,
      value: formData.get("value") as string,
      pipelineId: pipeline.id,
      stageId: firstStage.id,
      contactId: formData.get("contactId") ? Number(formData.get("contactId")) : undefined,
      probability: Number(formData.get("probability")) || 10,
      expectedCloseDate: expectedCloseDateValue?.trim() ? new Date(expectedCloseDateValue) : null,
      source: (formData.get("source") as string) || undefined,
      notes: formData.get("notes") as string,
    }, {
      onSuccess: () => {
        setNewDealOpen(false);
        setProbabilityValue(10);
      },
    });
  }, [pipeline, createDeal]);

  // Memoized filtered deals by stage - prevents recalculation on every render
  const dealsByStage = useMemo(() => {
    if (!deals || !pipeline?.stages) return new Map<number, DealWithRelations[]>();

    const stageDealsMap = new Map<number, DealWithRelations[]>();

    for (const stage of pipeline.stages) {
      const filteredDeals = deals.filter((deal) => {
        if (deal.stageId !== stage.id) return false;

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
      });
      stageDealsMap.set(stage.id, filteredDeals);
    }

    return stageDealsMap;
  }, [deals, pipeline?.stages, filters]);

  // Memoized stage values
  const stageValues = useMemo(() => {
    const valuesMap = new Map<number, number>();
    dealsByStage.forEach((stageDeals, stageId) => {
      const total = stageDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
      valuesMap.set(stageId, total);
    });
    return valuesMap;
  }, [dealsByStage]);

  // Helper functions that use memoized data
  const getDealsByStage = useCallback((stageId: number) => {
    return dealsByStage.get(stageId) || [];
  }, [dealsByStage]);

  const getStageValue = useCallback((stageId: number) => {
    return stageValues.get(stageId) || 0;
  }, [stageValues]);

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
                onValueChange={(val) => setLocation(`/pipeline/${val}`)}
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
          <Dialog open={newDealOpen} onOpenChange={(open) => {
            setNewDealOpen(open);
            if (!open) setProbabilityValue(10); // Reset on close
          }}>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="probability">{t("pipeline.probability")}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="probability"
                        name="probability"
                        type="range"
                        min="0"
                        max="100"
                        value={probabilityValue}
                        onChange={(e) => setProbabilityValue(Number(e.target.value))}
                        className="h-2"
                        data-testid="input-deal-probability"
                      />
                      <span className="text-sm text-muted-foreground w-10 text-right">{probabilityValue}%</span>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="expectedCloseDate">{t("pipeline.expectedCloseDate")}</Label>
                    <Input
                      id="expectedCloseDate"
                      name="expectedCloseDate"
                      type="date"
                      data-testid="input-deal-expectedCloseDate"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="source">{t("contacts.source")}</Label>
                  <Input
                    id="source"
                    name="source"
                    placeholder={t("pipeline.sourcePlaceholder")}
                    data-testid="input-deal-source"
                  />
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
                  disabled={createDeal.isPending}
                  data-testid="button-create-deal-submit"
                >
                  {createDeal.isPending ? t("common.saving") : t("common.create")}
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
                  style={{ backgroundColor: stage.color || "hsl(var(--primary))" }}
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

      <DealEditorDialog
        deal={selectedDeal}
        open={!!selectedDeal}
        onOpenChange={(open) => {
          if (!open) setSelectedDeal(null);
        }}
        contacts={contacts || []}
      />

      {/* Lost Reason Modal */}
      <AlertDialog open={lostReasonModalOpen} onOpenChange={setLostReasonModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pipeline.lostReasonTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pipeline.lostReasonDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="lostReason">
              {t("pipeline.lostReason")} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="lostReason"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder={t("pipeline.lostReasonPlaceholder")}
              className="mt-2"
              rows={3}
              required
            />
            {lostReason.trim() === "" && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("pipeline.lostReasonRequired")}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelLostDeal}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLostDeal}
              disabled={lostReason.trim() === "" || moveDeal.isPending}
            >
              {moveDeal.isPending ? t("common.saving") : t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
