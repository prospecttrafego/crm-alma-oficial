/**
 * WhatsApp Integration Page
 * Dedicated page for WhatsApp configuration via Evolution API
 */

import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { channelConfigsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Wifi,
  ArrowLeft,
  QrCode,
  RefreshCw,
} from "lucide-react";
import type { ChannelConfigPublic } from "@shared/types";
import { ChannelConfigDialog } from "../channels/channel-config-dialog";
import { WhatsAppQRModal } from "@/components/whatsapp-qr-modal";

export default function WhatsAppIntegrationPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ChannelConfigPublic | undefined>();
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrChannelId, setQrChannelId] = useState<number | null>(null);

  const { data: configs, isLoading } = useQuery<ChannelConfigPublic[]>({
    queryKey: ["/api/channel-configs"],
    queryFn: channelConfigsApi.list,
  });

  const whatsappConfigs = configs?.filter((c) => c.type === "whatsapp") || [];

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await channelConfigsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
      toast({ title: t("settings.channels.toast.deleted") });
    },
    onError: () => {
      toast({ title: t("settings.channels.toast.deleteError"), variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (id: number) => {
      await channelConfigsApi.disconnectWhatsApp(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
      toast({ title: t("settings.channels.whatsapp.disconnected") });
    },
    onError: () => {
      toast({ title: t("settings.channels.toast.disconnectError"), variant: "destructive" });
    },
  });

  const handleCreate = () => {
    setEditingConfig(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (config: ChannelConfigPublic) => {
    setEditingConfig(config);
    setDialogOpen(true);
  };

  const handleConnect = (configId: number) => {
    setQrChannelId(configId);
    setQrModalOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingConfig(undefined);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link href="/settings/integrations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground">{t("settings.integrations.whatsappDescription")}</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t("settings.channels.addChannel")}
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && whatsappConfigs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 mb-4">
              <MessageSquare className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-medium mb-2">{t("settings.channels.whatsapp.noConfigs")}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              {t("settings.channels.whatsapp.noConfigsDescription")}
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t("settings.channels.addChannel")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Config list */}
      {!isLoading && whatsappConfigs.length > 0 && (
        <div className="space-y-4">
          {whatsappConfigs.map((config) => {
            const wc = config.whatsappConfig;
            const connectionStatus = wc?.connectionStatus;
            const isConnected = connectionStatus === "connected";
            const isPending = connectionStatus === "qr_pending" || connectionStatus === "connecting";

            return (
              <Card key={config.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                      <MessageSquare className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {config.name}
                        {isConnected && (
                          <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
                            <Wifi className="h-3 w-3" />
                            {t("settings.channels.whatsapp.connected")}
                          </Badge>
                        )}
                        {isPending && (
                          <Badge variant="outline" className="text-amber-600 border-amber-600 gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t("settings.channels.whatsapp.waitingQr")}
                          </Badge>
                        )}
                        {!isConnected && !isPending && (
                          <Badge variant="secondary">{t("settings.channels.whatsapp.disconnected")}</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {isConnected
                          ? t("settings.channels.whatsapp.connectedVia")
                          : t("settings.channels.whatsapp.viaEvolution")}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isConnected && (
                      <Button variant="outline" size="sm" onClick={() => handleConnect(config.id)}>
                        <QrCode className="h-4 w-4 mr-2" />
                        {t("settings.channels.whatsapp.scanQr")}
                      </Button>
                    )}
                    {isConnected && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConnect(config.id)}
                        title={t("settings.channels.whatsapp.reconnect")}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {t("settings.channels.whatsapp.reconnect")}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-muted-foreground">
                      {wc?.lastConnectedAt && (
                        <span>
                          {t("settings.channels.whatsapp.lastConnected")}:{" "}
                          {new Date(wc.lastConnectedAt as string).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(config)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        {t("common.edit")}
                      </Button>
                      {isConnected && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-amber-600 hover:text-amber-700">
                              {t("settings.channels.whatsapp.disconnect")}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("settings.channels.whatsapp.disconnectConfirm.title")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("settings.channels.whatsapp.disconnectConfirm.description")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => disconnectMutation.mutate(config.id)}
                                className="bg-amber-600 hover:bg-amber-700"
                              >
                                {t("settings.channels.whatsapp.disconnect")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t("common.delete")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("settings.channels.deleteChannel")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("settings.channels.deleteChannelDescription", { name: config.name })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(config.id)}>
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ChannelConfigDialog
        key={editingConfig?.id ?? "new"}
        config={editingConfig}
        channelType="whatsapp"
        open={dialogOpen}
        onOpenChange={handleDialogChange}
      />

      {qrChannelId && (
        <WhatsAppQRModal
          open={qrModalOpen}
          onOpenChange={setQrModalOpen}
          channelConfigId={qrChannelId}
          onConnected={() => {
            setQrModalOpen(false);
            setQrChannelId(null);
            queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
          }}
        />
      )}
    </div>
  );
}
