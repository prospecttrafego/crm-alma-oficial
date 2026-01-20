/**
 * useDealMutations - Mutation hooks for deals with optimistic updates
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dealsApi } from '@/lib/api/deals';
import { useApiError } from '@/hooks/useApiError';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LanguageContext';
import type { CreateDealDTO, UpdateDealDTO, MoveDealDTO } from '@shared/types';

// Type for Deal (matches API response - some fields can be null)
interface Deal {
  id: number;
  title: string;
  value: string | number | null;
  currency: string | null;
  pipelineId: number;
  stageId: number;
  contactId: number | null;
  companyId: number | null;
  organizationId: number;
  ownerId: string | null;
  probability: number | null;
  expectedCloseDate: Date | string | null;
  status: string | null;
  source: string | null;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  [key: string]: unknown;
}

export function useDealMutations() {
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { toast } = useToast();
  const { t } = useTranslation();

  const createDeal = useMutation({
    mutationFn: (data: CreateDealDTO) => dealsApi.create(data),
    onSuccess: (newDeal) => {
      // Add to cache if not already present (WebSocket might have already added it)
      queryClient.setQueryData<Deal[]>(['/api/deals'], (old) => {
        if (!old) return [newDeal as Deal];
        if (old.some((d) => d.id === (newDeal as Deal).id)) return old;
        return [...old, newDeal as Deal];
      });
      toast({ title: t('toast.created') || 'Criado com sucesso' });
    },
    onError: handleError,
  });

  const updateDeal = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDealDTO }) =>
      dealsApi.update(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/deals'] });

      // Snapshot previous value
      const previousDeals = queryClient.getQueryData<Deal[]>(['/api/deals']);

      // Optimistically update
      queryClient.setQueryData<Deal[]>(['/api/deals'], (old) => {
        if (!old) return old;
        return old.map((d) => (d.id === id ? { ...d, ...data } : d));
      });

      return { previousDeals };
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousDeals) {
        queryClient.setQueryData(['/api/deals'], context.previousDeals);
      }
      handleError(err);
    },
    onSuccess: () => {
      toast({ title: t('toast.updated') || 'Atualizado com sucesso' });
    },
  });

  const deleteDeal = useMutation({
    mutationFn: (id: number) => dealsApi.delete(id),
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/deals'] });

      // Snapshot previous value
      const previousDeals = queryClient.getQueryData<Deal[]>(['/api/deals']);

      // Optimistically remove from cache
      queryClient.setQueryData<Deal[]>(['/api/deals'], (old) => {
        if (!old) return old;
        return old.filter((d) => d.id !== id);
      });

      return { previousDeals };
    },
    onError: (err, _id, context) => {
      // Rollback on error
      if (context?.previousDeals) {
        queryClient.setQueryData(['/api/deals'], context.previousDeals);
      }
      handleError(err);
    },
    onSuccess: () => {
      toast({ title: t('toast.deleted') || 'Excluído com sucesso' });
    },
  });

  const moveDeal = useMutation({
    mutationFn: ({ id, data }: { id: number; data: MoveDealDTO }) =>
      dealsApi.move(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/deals'] });

      // Snapshot previous value
      const previousDeals = queryClient.getQueryData<Deal[]>(['/api/deals']);

      // Optimistically update stageId and status
      queryClient.setQueryData<Deal[]>(['/api/deals'], (old) => {
        if (!old) return old;
        return old.map((d) =>
          d.id === id
            ? {
                ...d,
                stageId: data.stageId,
                ...(data.status && { status: data.status }),
              }
            : d
        );
      });

      return { previousDeals };
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousDeals) {
        queryClient.setQueryData(['/api/deals'], context.previousDeals);
      }
      handleError(err);
    },
    onSuccess: () => {
      toast({ title: t('toast.updated') || 'Movido com sucesso' });
    },
  });

  return { createDeal, updateDeal, deleteDeal, moveDeal };
}
