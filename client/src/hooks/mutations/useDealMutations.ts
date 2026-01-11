/**
 * useDealMutations - Mutation hooks for deals
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dealsApi } from '@/lib/api/deals';
import { useApiError } from '@/hooks/useApiError';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LanguageContext';
import type { CreateDealDTO, UpdateDealDTO, MoveDealDTO } from '@shared/types';

export function useDealMutations() {
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { toast } = useToast();
  const { t } = useTranslation();

  const createDeal = useMutation({
    mutationFn: (data: CreateDealDTO) => dealsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
      toast({ title: t('toast.created') || 'Criado com sucesso' });
    },
    onError: handleError,
  });

  const updateDeal = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDealDTO }) =>
      dealsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
      toast({ title: t('toast.updated') || 'Atualizado com sucesso' });
    },
    onError: handleError,
  });

  const deleteDeal = useMutation({
    mutationFn: (id: number) => dealsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
      toast({ title: t('toast.deleted') || 'Excluído com sucesso' });
    },
    onError: handleError,
  });

  const moveDeal = useMutation({
    mutationFn: ({ id, data }: { id: number; data: MoveDealDTO }) =>
      dealsApi.move(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
      toast({ title: t('toast.updated') || 'Movido com sucesso' });
    },
    onError: handleError,
  });

  return { createDeal, updateDeal, deleteDeal, moveDeal };
}
