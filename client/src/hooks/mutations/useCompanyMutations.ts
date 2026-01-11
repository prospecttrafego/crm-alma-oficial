/**
 * useCompanyMutations - Mutation hooks for companies
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { companiesApi } from '@/lib/api/companies';
import { useApiError } from '@/hooks/useApiError';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LanguageContext';
import type { CreateCompanyDTO, UpdateCompanyDTO } from '@shared/types';

export function useCompanyMutations() {
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { toast } = useToast();
  const { t } = useTranslation();

  const createCompany = useMutation({
    mutationFn: (data: CreateCompanyDTO) => companiesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({ title: t('toast.created') || 'Criado com sucesso' });
    },
    onError: handleError,
  });

  const updateCompany = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCompanyDTO }) =>
      companiesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({ title: t('toast.updated') || 'Atualizado com sucesso' });
    },
    onError: handleError,
  });

  const deleteCompany = useMutation({
    mutationFn: (id: number) => companiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({ title: t('toast.deleted') || 'Excluído com sucesso' });
    },
    onError: handleError,
  });

  return { createCompany, updateCompany, deleteCompany };
}
