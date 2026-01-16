import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { pipelinesApi } from "@/lib/api/pipelines";
import { dealsApi } from "@/lib/api/deals";
import { contactsApi } from "@/lib/api/contacts";
import { useDealMutations } from "@/hooks/mutations";
import { PipelineHeader } from "./components/PipelineHeader";
import { PipelineBoard } from "./components/PipelineBoard";
import { LostReasonDialog } from "./components/LostReasonDialog";
import { DealEditorDialog } from "./deal-editor-dialog";
import type { PipelineFilters } from "@/components/filter-panel";
import type { Contact } from "@shared/schema";
import type { PipelineWithStages } from "@shared/types";

import type { DealWithRelations } from "./types";

export default function PipelinePage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/pipeline/:pipelineId");
  const urlPipelineId = match ? Number(params?.pipelineId) : null;

  const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [draggedDeal, setDraggedDeal] = useState<DealWithRelations | null>(null);
  const [dragOverStage, setDragOverStage] = useState<number | null>(null);
  const [filters, setFilters] = useState<PipelineFilters>({});
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(urlPipelineId);
  const [lostReasonModalOpen, setLostReasonModalOpen] = useState(false);
  const [pendingLostDrop, setPendingLostDrop] = useState<{ deal: DealWithRelations; stageId: number } | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [probabilityValue, setProbabilityValue] = useState(10);

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

  useEffect(() => {
    if (pipeline && !urlPipelineId) {
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

  const handleDragStart = useCallback((event: React.DragEvent, deal: DealWithRelations) => {
    setDraggedDeal(deal);
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent, stageId: number) => {
    event.preventDefault();
    setDragOverStage(stageId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStage(null);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent, stageId: number) => {
      event.preventDefault();
      setDragOverStage(null);

      if (draggedDeal && draggedDeal.stageId !== stageId) {
        const targetStage = pipeline?.stages?.find((s) => s.id === stageId);
        if (targetStage?.isLost) {
          setPendingLostDrop({ deal: draggedDeal, stageId });
          setLostReason("");
          setLostReasonModalOpen(true);
        } else {
          moveDeal.mutate({ id: draggedDeal.id, data: { stageId } });
        }
      }

      setDraggedDeal(null);
    },
    [draggedDeal, moveDeal, pipeline?.stages],
  );

  const handleConfirmLostDeal = useCallback(() => {
    if (!pendingLostDrop) return;

    moveDeal.mutate(
      {
        id: pendingLostDrop.deal.id,
        data: {
          stageId: pendingLostDrop.stageId,
          status: "lost",
          lostReason: lostReason || undefined,
        },
      },
      {
        onSuccess: () => {
          setLostReasonModalOpen(false);
          setPendingLostDrop(null);
          setLostReason("");
        },
      },
    );
  }, [pendingLostDrop, lostReason, moveDeal]);

  const handleCancelLostDeal = useCallback(() => {
    setLostReasonModalOpen(false);
    setPendingLostDrop(null);
    setLostReason("");
  }, []);

  const handleCreateDeal = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const firstStage = pipeline?.stages?.[0];
      if (!firstStage || !pipeline) return;

      const expectedCloseDateValue = formData.get("expectedCloseDate") as string;
      createDeal.mutate(
        {
          title: formData.get("title") as string,
          value: formData.get("value") as string,
          pipelineId: pipeline.id,
          stageId: firstStage.id,
          contactId: formData.get("contactId") ? Number(formData.get("contactId")) : undefined,
          probability: Number(formData.get("probability")) || 10,
          expectedCloseDate: expectedCloseDateValue?.trim() ? new Date(expectedCloseDateValue) : null,
          source: (formData.get("source") as string) || undefined,
          notes: formData.get("notes") as string,
        },
        {
          onSuccess: () => {
            setNewDealOpen(false);
            setProbabilityValue(10);
          },
        },
      );
    },
    [pipeline, createDeal],
  );

  const dealsByStage = useMemo(() => {
    if (!deals || !pipeline?.stages) return new Map<number, DealWithRelations[]>();

    const stageDealsMap = new Map<number, DealWithRelations[]>(pipeline.stages.map((stage) => [stage.id, []]));

    for (const deal of deals) {
      if (!stageDealsMap.has(deal.stageId)) continue;
      if (filters.stageId && deal.stageId !== filters.stageId) continue;
      if (filters.ownerId && deal.ownerId !== filters.ownerId) continue;
      if (filters.status && deal.status !== filters.status) continue;
      if (filters.minValue && Number(deal.value || 0) < filters.minValue) continue;
      if (filters.maxValue && Number(deal.value || 0) > filters.maxValue) continue;

      if (filters.dateFrom || filters.dateTo) {
        if (!deal.expectedCloseDate) continue;
        const dealDate = new Date(deal.expectedCloseDate);
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom);
          if (dealDate < fromDate) continue;
        }
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo);
          if (dealDate > toDate) continue;
        }
      }

      stageDealsMap.get(deal.stageId)?.push(deal);
    }

    return stageDealsMap;
  }, [deals, pipeline?.stages, filters]);

  const stageValues = useMemo(() => {
    const valuesMap = new Map<number, number>();
    dealsByStage.forEach((stageDeals, stageId) => {
      const total = stageDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
      valuesMap.set(stageId, total);
    });
    return valuesMap;
  }, [dealsByStage]);

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
      <PipelineHeader
        pipeline={pipeline}
        allPipelines={allPipelines}
        selectedPipelineId={selectedPipelineId}
        onSelectPipelineId={(pipelineId) => {
          setSelectedPipelineId(pipelineId);
          setLocation(`/pipeline/${pipelineId}`);
        }}
        filters={filters}
        onFiltersChange={setFilters}
        stages={pipeline?.stages}
        newDealOpen={newDealOpen}
        onNewDealOpenChange={(open) => {
          setNewDealOpen(open);
          if (!open) setProbabilityValue(10);
        }}
        onCreateDeal={handleCreateDeal}
        contacts={contacts || []}
        probabilityValue={probabilityValue}
        onProbabilityValueChange={setProbabilityValue}
        createDealPending={createDeal.isPending}
      />

      <PipelineBoard
        stages={pipeline?.stages || []}
        dealsByStage={dealsByStage}
        stageValues={stageValues}
        dealsLoading={dealsLoading}
        dragOverStageId={dragOverStage}
        draggedDealId={draggedDeal?.id ?? null}
        onDragOverStage={handleDragOver}
        onDragLeaveStage={handleDragLeave}
        onDropOnStage={handleDrop}
        onDealDragStart={handleDragStart}
        onDealClick={setSelectedDeal}
      />

      <DealEditorDialog
        deal={selectedDeal}
        open={!!selectedDeal}
        onOpenChange={(open) => {
          if (!open) setSelectedDeal(null);
        }}
        contacts={contacts || []}
      />

      <LostReasonDialog
        open={lostReasonModalOpen}
        onOpenChange={setLostReasonModalOpen}
        value={lostReason}
        onChange={setLostReason}
        onCancel={handleCancelLostDeal}
        onConfirm={handleConfirmLostDeal}
        confirmDisabled={lostReason.trim() === "" || moveDeal.isPending}
        confirming={moveDeal.isPending}
      />
    </div>
  );
}
