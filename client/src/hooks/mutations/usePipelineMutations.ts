/**
 * Pipeline Mutation Hooks
 * Reusable mutations for pipeline CRUD operations with optimistic updates
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pipelinesApi } from "@/lib/api/pipelines";
import { useApiError } from "@/hooks/useApiError";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import type { CreatePipelineDTO, UpdatePipelineDTO } from "@shared/types";

// Type for Pipeline (matches API response - isDefault can be null)
interface Pipeline {
  id: number;
  name: string;
  organizationId: number;
  isDefault: boolean | null;
  createdAt: Date | string;
  stages?: unknown[];
  [key: string]: unknown;
}

export function usePipelineMutations() {
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { toast } = useToast();
  const { t } = useTranslation();

  const createPipeline = useMutation({
    mutationFn: (data: CreatePipelineDTO) => pipelinesApi.create(data),
    onSuccess: (newPipeline) => {
      // Add to cache if not already present (WebSocket might have already added it)
      queryClient.setQueryData<Pipeline[]>(["/api/pipelines"], (old) => {
        if (!old) return [newPipeline as Pipeline];
        if (old.some((p) => p.id === (newPipeline as Pipeline).id)) return old;
        return [...old, newPipeline as Pipeline];
      });
      toast({ title: t("toast.created") || "Criado com sucesso" });
    },
    onError: handleError,
  });

  const updatePipeline = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePipelineDTO }) =>
      pipelinesApi.update(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/pipelines"] });

      // Snapshot previous value
      const previousPipelines = queryClient.getQueryData<Pipeline[]>(["/api/pipelines"]);

      // Optimistically update
      queryClient.setQueryData<Pipeline[]>(["/api/pipelines"], (old) => {
        if (!old) return old;
        return old.map((p) => (p.id === id ? { ...p, ...data } : p));
      });

      return { previousPipelines };
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousPipelines) {
        queryClient.setQueryData(["/api/pipelines"], context.previousPipelines);
      }
      handleError(err);
    },
    onSuccess: () => {
      toast({ title: t("toast.updated") || "Atualizado com sucesso" });
    },
  });

  const deletePipeline = useMutation({
    mutationFn: (id: number) => pipelinesApi.delete(id),
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/pipelines"] });

      // Snapshot previous value
      const previousPipelines = queryClient.getQueryData<Pipeline[]>(["/api/pipelines"]);

      // Optimistically remove from cache
      queryClient.setQueryData<Pipeline[]>(["/api/pipelines"], (old) => {
        if (!old) return old;
        return old.filter((p) => p.id !== id);
      });

      return { previousPipelines };
    },
    onError: (err, _id, context) => {
      // Rollback on error
      if (context?.previousPipelines) {
        queryClient.setQueryData(["/api/pipelines"], context.previousPipelines);
      }
      handleError(err);
    },
    onSuccess: () => {
      toast({ title: t("toast.deleted") || "Excluído com sucesso" });
    },
  });

  const setDefaultPipeline = useMutation({
    mutationFn: (id: number) => pipelinesApi.setDefault(id),
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/pipelines"] });

      // Snapshot previous value
      const previousPipelines = queryClient.getQueryData<Pipeline[]>(["/api/pipelines"]);

      // Optimistically update: set new default, unset old default
      queryClient.setQueryData<Pipeline[]>(["/api/pipelines"], (old) => {
        if (!old) return old;
        return old.map((p) => ({
          ...p,
          isDefault: p.id === id,
        }));
      });

      return { previousPipelines };
    },
    onError: (err, _id, context) => {
      // Rollback on error
      if (context?.previousPipelines) {
        queryClient.setQueryData(["/api/pipelines"], context.previousPipelines);
      }
      handleError(err);
    },
    onSuccess: () => {
      toast({ title: t("toast.updated") || "Atualizado com sucesso" });
    },
  });

  return {
    createPipeline,
    updatePipeline,
    deletePipeline,
    setDefaultPipeline,
  };
}
