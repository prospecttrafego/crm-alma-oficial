/**
 * Channel Config Mutation Hooks
 * Reusable mutations for channel configuration CRUD operations with optimistic updates
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { channelConfigsApi } from "@/lib/api/channelConfigs";
import { useApiError } from "@/hooks/useApiError";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import type { CreateChannelConfigDTO, UpdateChannelConfigDTO } from "@shared/types";

// Type for Channel Config (matches API response - isActive can be null)
interface ChannelConfig {
  id: number;
  name: string;
  type: string;
  organizationId: number;
  isActive: boolean | null;
  createdAt: Date | string;
  [key: string]: unknown;
}

export function useChannelConfigMutations() {
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { toast } = useToast();
  const { t } = useTranslation();

  const createChannelConfig = useMutation({
    mutationFn: (data: CreateChannelConfigDTO) => channelConfigsApi.create(data),
    onSuccess: (newConfig) => {
      // Add to cache if not already present (WebSocket might have already added it)
      queryClient.setQueryData<ChannelConfig[]>(["/api/channel-configs"], (old) => {
        if (!old) return [newConfig as ChannelConfig];
        if (old.some((c) => c.id === (newConfig as ChannelConfig).id)) return old;
        return [...old, newConfig as ChannelConfig];
      });
      toast({ title: t("toast.created") || "Criado com sucesso" });
    },
    onError: handleError,
  });

  const updateChannelConfig = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateChannelConfigDTO }) =>
      channelConfigsApi.update(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/channel-configs"] });

      // Snapshot previous value
      const previousConfigs = queryClient.getQueryData<ChannelConfig[]>(["/api/channel-configs"]);

      // Optimistically update
      queryClient.setQueryData<ChannelConfig[]>(["/api/channel-configs"], (old) => {
        if (!old) return old;
        return old.map((c) => (c.id === id ? { ...c, ...data } : c));
      });

      return { previousConfigs };
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousConfigs) {
        queryClient.setQueryData(["/api/channel-configs"], context.previousConfigs);
      }
      handleError(err);
    },
    onSuccess: () => {
      toast({ title: t("toast.updated") || "Atualizado com sucesso" });
    },
  });

  const deleteChannelConfig = useMutation({
    mutationFn: (id: number) => channelConfigsApi.delete(id),
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/channel-configs"] });

      // Snapshot previous value
      const previousConfigs = queryClient.getQueryData<ChannelConfig[]>(["/api/channel-configs"]);

      // Optimistically remove from cache
      queryClient.setQueryData<ChannelConfig[]>(["/api/channel-configs"], (old) => {
        if (!old) return old;
        return old.filter((c) => c.id !== id);
      });

      return { previousConfigs };
    },
    onError: (err, _id, context) => {
      // Rollback on error
      if (context?.previousConfigs) {
        queryClient.setQueryData(["/api/channel-configs"], context.previousConfigs);
      }
      handleError(err);
    },
    onSuccess: () => {
      toast({ title: t("toast.deleted") || "Excluído com sucesso" });
    },
  });

  const connectWhatsApp = useMutation({
    mutationFn: (id: number) => channelConfigsApi.connectWhatsApp(id),
    onSuccess: (result, id) => {
      // Update connection status in cache
      queryClient.setQueryData<ChannelConfig[]>(["/api/channel-configs"], (old) => {
        if (!old) return old;
        return old.map((c) =>
          c.id === id
            ? {
                ...c,
                whatsappConfig: {
                  ...(c.whatsappConfig as Record<string, unknown> || {}),
                  connectionStatus: (result as { connectionStatus?: string })?.connectionStatus || "connecting",
                  qrCode: (result as { qrCode?: string })?.qrCode,
                },
              }
            : c
        );
      });
    },
    onError: handleError,
  });

  const disconnectWhatsApp = useMutation({
    mutationFn: (id: number) => channelConfigsApi.disconnectWhatsApp(id),
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/channel-configs"] });

      // Snapshot previous value
      const previousConfigs = queryClient.getQueryData<ChannelConfig[]>(["/api/channel-configs"]);

      // Optimistically update connection status
      queryClient.setQueryData<ChannelConfig[]>(["/api/channel-configs"], (old) => {
        if (!old) return old;
        return old.map((c) =>
          c.id === id
            ? {
                ...c,
                whatsappConfig: {
                  ...(c.whatsappConfig as Record<string, unknown> || {}),
                  connectionStatus: "disconnected",
                  qrCode: undefined,
                },
              }
            : c
        );
      });

      return { previousConfigs };
    },
    onError: (err, _id, context) => {
      // Rollback on error
      if (context?.previousConfigs) {
        queryClient.setQueryData(["/api/channel-configs"], context.previousConfigs);
      }
      handleError(err);
    },
    onSuccess: () => {
      toast({ title: t("toast.updated") || "Atualizado com sucesso" });
    },
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
