/**
 * useApiError - Hook for handling API errors with structured error messages
 */

import { ApiRequestError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LanguageContext';

export function useApiError() {
  const { toast } = useToast();
  const { t } = useTranslation();

  /**
   * Handle API errors with appropriate toast messages
   */
  const handleError = (error: unknown) => {
    if (error instanceof ApiRequestError) {
      if (error.isValidationError() && error.details && error.details.length > 0) {
        // Show first validation error with field path
        const firstError = error.details[0];
        const path = Array.isArray(firstError.path)
          ? firstError.path.join('.')
          : firstError.path;
        toast({
          title: t('toast.validationError') || 'Erro de validação',
          description: path ? `${path}: ${firstError.message}` : firstError.message,
          variant: 'destructive',
        });
      } else if (error.isNotFound()) {
        toast({
          title: t('toast.notFound') || 'Não encontrado',
          description: error.message,
          variant: 'destructive',
        });
      } else if (error.isUnauthorized()) {
        toast({
          title: t('toast.unauthorized') || 'Não autorizado',
          description: error.message,
          variant: 'destructive',
        });
      } else if (error.isForbidden()) {
        toast({
          title: t('toast.forbidden') || 'Acesso negado',
          description: error.message,
          variant: 'destructive',
        });
      } else if (error.isConflict()) {
        toast({
          title: t('toast.conflict') || 'Conflito',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        // Generic error
        toast({
          title: t('toast.error') || 'Erro',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else if (error instanceof Error) {
      toast({
        title: t('toast.error') || 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('toast.error') || 'Erro',
        description: t('toast.unknownError') || 'Ocorreu um erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  return { handleError };
}
