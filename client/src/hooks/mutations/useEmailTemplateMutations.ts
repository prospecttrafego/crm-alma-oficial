/**
 * Email Template Mutation Hooks
 * Reusable mutations for email template CRUD operations
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { emailTemplatesApi } from "@/lib/api/emailTemplates";
import { useApiError } from "@/hooks/useApiError";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import type { CreateEmailTemplateDTO, UpdateEmailTemplateDTO } from "@shared/types";

export function useEmailTemplateMutations() {
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { toast } = useToast();
  const { t } = useTranslation();

  const createEmailTemplate = useMutation({
    mutationFn: (data: CreateEmailTemplateDTO) => emailTemplatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: t("toast.created") || "Criado com sucesso" });
    },
    onError: handleError,
  });

  const updateEmailTemplate = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateEmailTemplateDTO }) =>
      emailTemplatesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: t("toast.updated") || "Atualizado com sucesso" });
    },
    onError: handleError,
  });

  const deleteEmailTemplate = useMutation({
    mutationFn: (id: number) => emailTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: t("toast.deleted") || "Excluído com sucesso" });
    },
    onError: handleError,
  });

  return {
    createEmailTemplate,
    updateEmailTemplate,
    deleteEmailTemplate,
  };
}
