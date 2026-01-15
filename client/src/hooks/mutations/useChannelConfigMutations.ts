/**
 * Channel Config Mutation Hooks
 * Reusable mutations for channel configuration CRUD operations
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { channelConfigsApi } from "@/lib/api/channelConfigs";
import { useApiError } from "@/hooks/useApiError";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import type { CreateChannelConfigDTO, UpdateChannelConfigDTO } from "@shared/types";

export function useChannelConfigMutations() {
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { toast } = useToast();
  const { t } = useTranslation();

  const createChannelConfig = useMutation({
    mutationFn: (data: CreateChannelConfigDTO) => channelConfigsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
      toast({ title: t("toast.created") || "Criado com sucesso" });
    },
    onError: handleError,
  });

  const updateChannelConfig = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateChannelConfigDTO }) =>
      channelConfigsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
      toast({ title: t("toast.updated") || "Atualizado com sucesso" });
    },
    onError: handleError,
  });

  const deleteChannelConfig = useMutation({
    mutationFn: (id: number) => channelConfigsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
      toast({ title: t("toast.deleted") || "Excluído com sucesso" });
    },
    onError: handleError,
  });

  const connectWhatsApp = useMutation({
    mutationFn: (id: number) => channelConfigsApi.connectWhatsApp(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
    },
    onError: handleError,
  });

  const disconnectWhatsApp = useMutation({
    mutationFn: (id: number) => channelConfigsApi.disconnectWhatsApp(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
      toast({ title: t("toast.updated") || "Atualizado com sucesso" });
    },
    onError: handleError,
  });

  const testConnection = useMutation({
    mutationFn: (id: number) => channelConfigsApi.testConnection(id),
    onError: handleError,
  });

  return {
    createChannelConfig,
    updateChannelConfig,
    deleteChannelConfig,
    connectWhatsApp,
    disconnectWhatsApp,
    testConnection,
  };
}
