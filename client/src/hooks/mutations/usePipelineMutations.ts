/**
 * usePipelineMutations - Mutation hooks for pipelines and stages
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelinesApi } from '@/lib/api/pipelines';
import { useApiError } from '@/hooks/useApiError';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LanguageContext';
import type {
  CreatePipelineDTO,
  UpdatePipelineDTO,
  CreatePipelineStageDTO,
  UpdatePipelineStageDTO,
} from '@shared/types';

export function usePipelineMutations() {
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { toast } = useToast();
  const { t } = useTranslation();

  const createPipeline = useMutation({
    mutationFn: (data: CreatePipelineDTO) => pipelinesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
      toast({ title: t('toast.created') || 'Criado com sucesso' });
    },
    onError: handleError,
  });

  const updatePipeline = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePipelineDTO }) =>
      pipelinesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
      toast({ title: t('toast.updated') || 'Atualizado com sucesso' });
    },
    onError: handleError,
  });

  const deletePipeline = useMutation({
    mutationFn: (id: number) => pipelinesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
      toast({ title: t('toast.deleted') || 'Excluído com sucesso' });
    },
    onError: handleError,
  });

  const setDefaultPipeline = useMutation({
    mutationFn: (id: number) => pipelinesApi.setDefault(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
      toast({ title: t('toast.updated') || 'Pipeline padrão definido' });
    },
    onError: handleError,
  });

  // Stage mutations
  const createStage = useMutation({
    mutationFn: ({
      pipelineId,
      data,
    }: {
      pipelineId: number;
      data: Omit<CreatePipelineStageDTO, 'pipelineId'>;
    }) => pipelinesApi.createStage(pipelineId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
      toast({ title: t('toast.created') || 'Etapa criada' });
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
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
      toast({ title: t('toast.updated') || 'Etapa atualizada' });
    },
    onError: handleError,
  });

  const deleteStage = useMutation({
    mutationFn: ({ pipelineId, stageId }: { pipelineId: number; stageId: number }) =>
      pipelinesApi.deleteStage(pipelineId, stageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
      toast({ title: t('toast.deleted') || 'Etapa excluída' });
    },
    onError: handleError,
  });

  return {
    createPipeline,
    updatePipeline,
    deletePipeline,
    setDefaultPipeline,
    createStage,
    updateStage,
    deleteStage,
  };
}
