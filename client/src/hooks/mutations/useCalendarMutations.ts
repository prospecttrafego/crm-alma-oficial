/**
 * useCalendarMutations - Mutation hooks for calendar events
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarEventsApi } from '@/lib/api/calendarEvents';
import { useApiError } from '@/hooks/useApiError';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LanguageContext';
import type { CreateCalendarEventDTO, UpdateCalendarEventDTO } from '@shared/types';

export function useCalendarMutations() {
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { toast } = useToast();
  const { t } = useTranslation();

  const createEvent = useMutation({
    mutationFn: (data: CreateCalendarEventDTO) => calendarEventsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-events'] });
      toast({ title: t('toast.created') || 'Evento criado' });
    },
    onError: handleError,
  });

  const updateEvent = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCalendarEventDTO }) =>
      calendarEventsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-events'] });
      toast({ title: t('toast.updated') || 'Evento atualizado' });
    },
    onError: handleError,
  });

  const deleteEvent = useMutation({
    mutationFn: (id: number) => calendarEventsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-events'] });
      toast({ title: t('toast.deleted') || 'Evento excluído' });
    },
    onError: handleError,
  });

  return { createEvent, updateEvent, deleteEvent };
}
