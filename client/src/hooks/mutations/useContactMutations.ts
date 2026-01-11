/**
 * useContactMutations - Mutation hooks for contacts
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '@/lib/api/contacts';
import { useApiError } from '@/hooks/useApiError';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LanguageContext';
import type { CreateContactDTO, UpdateContactDTO } from '@shared/types';

export function useContactMutations() {
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { toast } = useToast();
  const { t } = useTranslation();

  const createContact = useMutation({
    mutationFn: (data: CreateContactDTO) => contactsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: t('toast.created') || 'Criado com sucesso' });
    },
    onError: handleError,
  });

  const updateContact = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateContactDTO }) =>
      contactsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: t('toast.updated') || 'Atualizado com sucesso' });
    },
    onError: handleError,
  });

  const deleteContact = useMutation({
    mutationFn: (id: number) => contactsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: t('toast.deleted') || 'Excluído com sucesso' });
    },
    onError: handleError,
  });

  return { createContact, updateContact, deleteContact };
}
