/**
 * useActivityMutations - Mutation hooks for activities
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { activitiesApi } from '@/lib/api/activities';
import { useApiError } from '@/hooks/useApiError';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LanguageContext';
import type { CreateActivityDTO, UpdateActivityDTO } from '@shared/types';

export function useActivityMutations() {
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { toast } = useToast();
  const { t } = useTranslation();

  const createActivity = useMutation({
    mutationFn: (data: CreateActivityDTO) => activitiesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      toast({ title: t('toast.created') || 'Atividade criada' });
    },
    onError: handleError,
  });

  const updateActivity = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateActivityDTO }) =>
      activitiesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      toast({ title: t('toast.updated') || 'Atividade atualizada' });
    },
    onError: handleError,
  });

  const deleteActivity = useMutation({
    mutationFn: (id: number) => activitiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      toast({ title: t('toast.deleted') || 'Atividade excluída' });
    },
    onError: handleError,
  });

  const completeActivity = useMutation({
    mutationFn: (id: number) => activitiesApi.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      toast({ title: t('toast.updated') || 'Atividade concluída' });
    },
    onError: handleError,
  });

  return { createActivity, updateActivity, deleteActivity, completeActivity };
}
