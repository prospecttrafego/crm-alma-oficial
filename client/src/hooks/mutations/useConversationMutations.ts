/**
 * useConversationMutations - Mutation hooks for conversations and messages
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '@/lib/api/conversations';
import { useApiError } from '@/hooks/useApiError';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LanguageContext';
import type {
  CreateConversationDTO,
  UpdateConversationDTO,
  CreateMessageDTO,
} from '@shared/types';

export function useConversationMutations() {
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { toast } = useToast();
  const { t } = useTranslation();

  const createConversation = useMutation({
    mutationFn: (data: CreateConversationDTO) => conversationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({ title: t('toast.created') || 'Conversa criada' });
    },
    onError: handleError,
  });

  const updateConversation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateConversationDTO }) =>
      conversationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
    onError: handleError,
  });

  const closeConversation = useMutation({
    mutationFn: (id: number) => conversationsApi.close(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({ title: t('toast.updated') || 'Conversa fechada' });
    },
    onError: handleError,
  });

  const reopenConversation = useMutation({
    mutationFn: (id: number) => conversationsApi.reopen(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({ title: t('toast.updated') || 'Conversa reaberta' });
    },
    onError: handleError,
  });

  const sendMessage = useMutation({
    mutationFn: ({
      conversationId,
      data,
    }: {
      conversationId: number;
      data: CreateMessageDTO;
    }) => conversationsApi.sendMessage(conversationId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/conversations', variables.conversationId, 'messages'],
      });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
    onError: handleError,
  });

  const markAsRead = useMutation({
    mutationFn: (conversationId: number) => conversationsApi.markAsRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
    onError: handleError,
  });

  return {
    createConversation,
    updateConversation,
    closeConversation,
    reopenConversation,
    sendMessage,
    markAsRead,
  };
}
