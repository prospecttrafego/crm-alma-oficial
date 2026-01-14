/**
 * Integrations Section
 * Manages Google Calendar, Email, and WhatsApp integrations
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { calendarEventsApi, channelConfigsApi } from "@/lib/api";
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
  Calendar,
  Mail,
  MessageSquare,
  Link2,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  Loader2,
  RefreshCw,
  Unplug,
  Wifi,
} from "lucide-react";
import type { ChannelConfigPublic, GoogleCalendarStatus } from "@shared/types";
import { ChannelConfigDialog } from "./channel-config-dialog";

export function IntegrationsSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [channelType, setChannelType] = useState<"email" | "whatsapp">("email");
  const [editingConfig, setEditingConfig] = useState<ChannelConfigPublic | undefined>();
  const [testingId, setTestingId] = useState<number | null>(null);

  // Channel configs (Email & WhatsApp)
  const { data: configs } = useQuery<ChannelConfigPublic[]>({
    queryKey: ["/api/channel-configs"],
    queryFn: channelConfigsApi.list,
  });

  // Google Calendar status
  const { data: gcConfigStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/integrations/google-calendar/configured"],
    queryFn: calendarEventsApi.getGoogleCalendarConfigured,
  });

  const { data: gcStatus, refetch: refetchGcStatus } = useQuery<GoogleCalendarStatus>({
    queryKey: ["/api/integrations/google-calendar/status"],
    queryFn: calendarEventsApi.getGoogleCalendarStatus,
    enabled: gcConfigStatus?.configured,
    refetchInterval: 30000,
  });

  // Google Calendar mutations
  const gcConnectMutation = useMutation({
    mutationFn: async () => {
      const data = await calendarEventsApi.authorizeGoogleCalendar();
      return data.authUrl;
    },
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
    },
    onError: () => {
      toast({ title: t("settings.googleCalendar.toast.connectError"), variant: "destructive" });
    },
  });

  const gcDisconnectMutation = useMutation({
    mutationFn: async () => {
      await calendarEventsApi.disconnectGoogleCalendar();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google-calendar/status"] });
      toast({ title: t("settings.googleCalendar.toast.disconnected") });
    },
    onError: () => {
      toast({ title: t("settings.googleCalendar.toast.disconnectError"), variant: "destructive" });
    },
  });

  const gcSyncMutation = useMutation({
    mutationFn: async () => {
      return calendarEventsApi.syncGoogleCalendar();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google-calendar/status"] });
      toast({ title: t("settings.googleCalendar.toast.syncSuccess", { count: data.imported || 0 }) });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google-calendar/status"] });
      toast({ title: t("settings.googleCalendar.toast.syncError"), variant: "destructive" });
    },
  });

  // Check for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gcResult = params.get("google_calendar");
    if (gcResult === "success") {
      toast({ title: t("settings.googleCalendar.toast.connected") });
      const url = new URL(window.location.href);
      url.searchParams.delete("google_calendar");
      window.history.replaceState({}, "", url.pathname);
      refetchGcStatus();
    } else if (gcResult === "error") {
      const message = params.get("message");
      toast({ title: t("settings.googleCalendar.toast.connectError"), description: message || undefined, variant: "destructive" });
      const url = new URL(window.location.href);
      url.searchParams.delete("google_calendar");
      url.searchParams.delete("message");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [toast, t, refetchGcStatus]);

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

  const testMutation = useMutation({
    mutationFn: async (id: number) => {
      setTestingId(id);
      return channelConfigsApi.testConnection(id);
    },
    onSuccess: (data) => {
      setTestingId(null);
      toast({ title: data.message || t("settings.channels.toast.testSuccess") });
    },
    onError: () => {
      setTestingId(null);
      toast({ title: t("settings.channels.toast.testError"), variant: "destructive" });
    },
  });

  const handleCreate = (type: "email" | "whatsapp") => {
    setChannelType(type);
    setEditingConfig(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (config: ChannelConfigPublic) => {
    setChannelType(config.type as "email" | "whatsapp");
    setEditingConfig(config);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingConfig(undefined);
    }
  };

  const emailConfigs = configs?.filter(c => c.type === "email") || [];
  const whatsappConfigs = configs?.filter(c => c.type === "whatsapp") || [];
  const firstEmail = emailConfigs[0];
  const firstWhatsapp = whatsappConfigs[0];

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <CardTitle>{t("settings.integrations.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings.integrations.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Google Calendar Integration */}
        <GoogleCalendarIntegration
          status={gcStatus}
          onConnect={() => gcConnectMutation.mutate()}
          onDisconnect={() => gcDisconnectMutation.mutate()}
          onSync={() => gcSyncMutation.mutate()}
          isConnectPending={gcConnectMutation.isPending}
          isSyncPending={gcSyncMutation.isPending}
          t={t}
        />

        {/* Email Integration */}
        <EmailIntegration
          config={firstEmail}
          onConnect={() => handleCreate("email")}
          onEdit={() => firstEmail && handleEdit(firstEmail)}
          onDelete={() => firstEmail && deleteMutation.mutate(firstEmail.id)}
          onTest={() => firstEmail && testMutation.mutate(firstEmail.id)}
          isTesting={testingId === firstEmail?.id}
          t={t}
        />

        {/* WhatsApp Integration */}
        <WhatsAppIntegration
          config={firstWhatsapp}
          onConnect={() => handleCreate("whatsapp")}
          onEdit={() => firstWhatsapp && handleEdit(firstWhatsapp)}
          onDelete={() => firstWhatsapp && deleteMutation.mutate(firstWhatsapp.id)}
          onTest={() => firstWhatsapp && testMutation.mutate(firstWhatsapp.id)}
          isTesting={testingId === firstWhatsapp?.id}
          t={t}
        />
      </CardContent>
      <ChannelConfigDialog
        key={editingConfig?.id ?? "new"}
        config={editingConfig}
        channelType={channelType}
        open={dialogOpen}
        onOpenChange={handleDialogChange}
      />
    </Card>
  );
}

interface GoogleCalendarIntegrationProps {
  status?: GoogleCalendarStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
  isConnectPending: boolean;
  isSyncPending: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function GoogleCalendarIntegration({
  status,
  onConnect,
  onDisconnect,
  onSync,
  isConnectPending,
  isSyncPending,
  t,
}: GoogleCalendarIntegrationProps) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-md border">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-md bg-red-500/10">
          <Calendar className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium">{t("settings.googleCalendar.title")}</h4>
            {status?.connected ? (
              <Badge variant="outline" className="text-green-600 border-green-600 text-xs gap-1">
                <CheckCircle className="h-3 w-3" />
                {t("settings.integrations.connected")}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                {t("settings.integrations.notConnected")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {status?.connected ? status.email : t("settings.googleCalendar.subtitle")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {status?.connected ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              onClick={onSync}
              disabled={isSyncPending || status.syncStatus === "syncing"}
              title={t("settings.googleCalendar.syncNow")}
            >
              {isSyncPending || status.syncStatus === "syncing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" title={t("settings.googleCalendar.disconnect")}>
                  <Unplug className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("settings.googleCalendar.disconnectConfirm.title")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("settings.googleCalendar.disconnectConfirm.description")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={onDisconnect} className="bg-red-600 hover:bg-red-700">
                    {t("settings.googleCalendar.disconnect")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={onConnect} disabled={isConnectPending}>
            {isConnectPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {t("settings.integrations.connect")}
          </Button>
        )}
      </div>
    </div>
  );
}

interface EmailIntegrationProps {
  config?: ChannelConfigPublic;
  onConnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  isTesting: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function EmailIntegration({
  config,
  onConnect,
  onEdit,
  onDelete,
  onTest,
  isTesting,
  t,
}: EmailIntegrationProps) {
  const hasEmail = !!config;

  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-md border">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-md bg-blue-500/10">
          <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium">E-mail</h4>
            {hasEmail ? (
              <Badge variant="outline" className="text-green-600 border-green-600 text-xs gap-1">
                <CheckCircle className="h-3 w-3" />
                {t("settings.integrations.connected")}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                {t("settings.integrations.notConnected")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {hasEmail ? config.emailConfig?.email || "" : t("settings.channels.dialog.emailDescription")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {hasEmail ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              onClick={onTest}
              disabled={isTesting}
              title="Testar conexão"
            >
              {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={onEdit} title={t("common.edit")}>
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" title={t("common.delete")}>
                  <Trash2 className="h-4 w-4" />
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
                  <AlertDialogAction onClick={onDelete}>{t("common.delete")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={onConnect}>
            <Plus className="h-4 w-4 mr-2" />
            {t("settings.integrations.connect")}
          </Button>
        )}
      </div>
    </div>
  );
}

interface WhatsAppIntegrationProps {
  config?: ChannelConfigPublic;
  onConnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  isTesting: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function WhatsAppIntegration({
  config,
  onConnect,
  onEdit,
  onDelete,
  onTest,
  isTesting,
  t,
}: WhatsAppIntegrationProps) {
  const hasWhatsapp = !!config;
  const wc = config?.whatsappConfig;
  const connectionStatus = wc?.connectionStatus;

  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-md border">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-md bg-green-500/10">
          <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium">WhatsApp</h4>
            {hasWhatsapp ? (
              connectionStatus === "connected" ? (
                <Badge variant="outline" className="text-green-600 border-green-600 text-xs gap-1">
                  <Wifi className="h-3 w-3" />
                  {t("settings.channels.whatsapp.connected")}
                </Badge>
              ) : connectionStatus === "connecting" || connectionStatus === "qr_pending" ? (
                <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {connectionStatus === "qr_pending" ? t("settings.channels.whatsapp.waitingQr") : t("settings.channels.whatsapp.connecting")}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  {t("settings.channels.whatsapp.disconnected")}
                </Badge>
              )
            ) : (
              <Badge variant="secondary" className="text-xs">
                {t("settings.integrations.notConnected")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {hasWhatsapp
              ? connectionStatus === "connected"
                ? t("settings.channels.whatsapp.connectedVia")
                : connectionStatus === "qr_pending"
                  ? t("settings.channels.whatsapp.waitingQrScan")
                  : t("settings.channels.whatsapp.viaEvolution")
              : t("settings.channels.dialog.whatsappDescription")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {hasWhatsapp ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              onClick={onTest}
              disabled={isTesting}
              title="Testar conexão"
            >
              {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={onEdit} title={t("common.edit")}>
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" title={t("common.delete")}>
                  <Trash2 className="h-4 w-4" />
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
                  <AlertDialogAction onClick={onDelete}>{t("common.delete")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={onConnect}>
            <Plus className="h-4 w-4 mr-2" />
            {t("settings.integrations.connect")}
          </Button>
        )}
      </div>
    </div>
  );
}
