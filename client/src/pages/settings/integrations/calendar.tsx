/**
 * Google Calendar Integration Page
 * Dedicated page for Google Calendar OAuth integration
 */

import { useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { calendarEventsApi } from "@/lib/api";
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
import { Calendar, CheckCircle, Loader2, ArrowLeft, RefreshCw, Unplug, ExternalLink } from "lucide-react";
import type { GoogleCalendarStatus } from "@shared/types";

export default function CalendarIntegrationPage() {
  const { t } = useTranslation();
  const { toast } = useToast();

  // Google Calendar status
  const { data: gcConfigStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/integrations/google-calendar/configured"],
    queryFn: calendarEventsApi.getGoogleCalendarConfigured,
  });

  const {
    data: gcStatus,
    refetch: refetchGcStatus,
    isLoading,
  } = useQuery<GoogleCalendarStatus>({
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
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
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
      toast({
        title: t("settings.googleCalendar.toast.connectError"),
        description: message || undefined,
        variant: "destructive",
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("google_calendar");
      url.searchParams.delete("message");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [toast, t, refetchGcStatus]);

  const isConnected = gcStatus?.connected;
  const isSyncing = gcSyncMutation.isPending || gcStatus?.syncStatus === "syncing";

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
            <Calendar className="h-5 w-5 text-red-600" />
            Google Calendar
          </h2>
          <p className="text-sm text-muted-foreground">{t("settings.integrations.calendarDescription")}</p>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && gcConfigStatus?.configured && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* Not configured state */}
      {!gcConfigStatus?.configured && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 mb-4">
              <Calendar className="h-6 w-6 text-amber-600" />
            </div>
            <h3 className="font-medium mb-2">{t("settings.googleCalendar.notConfigured")}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              {t("settings.googleCalendar.notConfiguredDescription")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Connected/Disconnected state */}
      {gcConfigStatus?.configured && !isLoading && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                <Calendar className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Google Calendar
                  {isConnected ? (
                    <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {t("settings.integrations.connected")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{t("settings.integrations.notConnected")}</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {isConnected ? gcStatus?.email : t("settings.googleCalendar.subtitle")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected && (
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("settings.googleCalendar.syncStatus")}</span>
                  <span>
                    {gcStatus?.syncStatus === "syncing"
                      ? t("settings.googleCalendar.syncing")
                      : gcStatus?.syncStatus === "success"
                        ? t("settings.googleCalendar.syncSuccess")
                        : gcStatus?.syncStatus === "error"
                          ? t("settings.googleCalendar.syncFailed")
                          : t("settings.googleCalendar.neverSynced")}
                  </span>
                </div>
                {gcStatus?.lastSyncAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("settings.googleCalendar.lastSync")}</span>
                    <span>{new Date(gcStatus.lastSyncAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 border-t pt-4">
              {isConnected ? (
                <>
                  <Button onClick={() => gcSyncMutation.mutate()} disabled={isSyncing}>
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {t("settings.googleCalendar.syncNow")}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="text-amber-600 hover:text-amber-700">
                        <Unplug className="h-4 w-4 mr-2" />
                        {t("settings.googleCalendar.disconnect")}
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
                        <AlertDialogAction
                          onClick={() => gcDisconnectMutation.mutate()}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          {t("settings.googleCalendar.disconnect")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <Button onClick={() => gcConnectMutation.mutate()} disabled={gcConnectMutation.isPending}>
                  {gcConnectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  {t("settings.googleCalendar.connect")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
