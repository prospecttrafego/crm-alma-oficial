/**
 * Email Integration Page
 * Dedicated page for Email IMAP/SMTP configuration
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
import { Mail, Plus, Pencil, Trash2, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import type { ChannelConfigPublic } from "@shared/types";
import { ChannelConfigDialog } from "../channels/channel-config-dialog";

export default function EmailIntegrationPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ChannelConfigPublic | undefined>();
  const [testingId, setTestingId] = useState<number | null>(null);

  const { data: configs, isLoading } = useQuery<ChannelConfigPublic[]>({
    queryKey: ["/api/channel-configs"],
    queryFn: channelConfigsApi.list,
  });

  const emailConfigs = configs?.filter((c) => c.type === "email") || [];

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

  const handleCreate = () => {
    setEditingConfig(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (config: ChannelConfigPublic) => {
    setEditingConfig(config);
    setDialogOpen(true);
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
            <Mail className="h-5 w-5 text-blue-600" />
            Email
          </h2>
          <p className="text-sm text-muted-foreground">{t("settings.integrations.emailDescription")}</p>
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
      {!isLoading && emailConfigs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 mb-4">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-medium mb-2">{t("settings.channels.email.noConfigs")}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              {t("settings.channels.email.noConfigsDescription")}
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t("settings.channels.addChannel")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Config list */}
      {!isLoading && emailConfigs.length > 0 && (
        <div className="space-y-4">
          {emailConfigs.map((config) => {
            const ec = config.emailConfig;
            const isActive = config.isActive;
            const isTesting = testingId === config.id;

            return (
              <Card key={config.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <Mail className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {config.name}
                        {isActive ? (
                          <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
                            <CheckCircle className="h-3 w-3" />
                            {t("settings.integrations.connected")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{t("settings.integrations.inactive")}</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{ec?.email || t("settings.channels.email.noEmailSet")}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testMutation.mutate(config.id)}
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      {t("settings.channels.testConnection")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-muted-foreground">
                      {ec?.imapHost && (
                        <span>
                          IMAP: {ec.imapHost}:{ec.imapPort} | SMTP: {ec.smtpHost}:{ec.smtpPort}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(config)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        {t("common.edit")}
                      </Button>
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
        channelType="email"
        open={dialogOpen}
        onOpenChange={handleDialogChange}
      />
    </div>
  );
}
