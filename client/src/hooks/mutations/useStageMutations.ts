/**
 * Stage Mutation Hooks
 * Reusable mutations for pipeline stage CRUD operations
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pipelinesApi } from "@/lib/api/pipelines";
import { useApiError } from "@/hooks/useApiError";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import type { CreatePipelineStageDTO, UpdatePipelineStageDTO } from "@shared/types";

export function useStageMutations() {
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { toast } = useToast();
  const { t } = useTranslation();

  const createStage = useMutation({
    mutationFn: ({ pipelineId, data }: { pipelineId: number; data: Omit<CreatePipelineStageDTO, "pipelineId"> }) =>
      pipelinesApi.createStage(pipelineId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: t("toast.created") || "Criado com sucesso" });
    },
    onError: handleError,
  });

  const updateStage = useMutation({
    mutationFn: ({
      pipelineId,
      stageId,
      data,
    }: {
      pipelineId: number;
      stageId: number;
      data: UpdatePipelineStageDTO;
    }) => pipelinesApi.updateStage(pipelineId, stageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: t("toast.updated") || "Atualizado com sucesso" });
    },
    onError: handleError,
  });

  const deleteStage = useMutation({
    mutationFn: ({ pipelineId, stageId }: { pipelineId: number; stageId: number }) =>
      pipelinesApi.deleteStage(pipelineId, stageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: t("toast.deleted") || "Excluído com sucesso" });
    },
    onError: handleError,
  });

  return {
    createStage,
    updateStage,
    deleteStage,
  };
}
