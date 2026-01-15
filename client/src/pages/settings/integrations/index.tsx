/**
 * Integrations Hub Page
 * Visual hub with cards for each integration type
 */

import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MessageCircle,
  Mail,
  Calendar,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { channelConfigsApi } from "@/lib/api/channelConfigs";

type IntegrationStatus = "connected" | "disconnected" | "partial" | "loading";

interface IntegrationCardProps {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  status: IntegrationStatus;
  statusText: string;
}

function IntegrationCard({ href, icon: Icon, title, description, status, statusText }: IntegrationCardProps) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-sm">{description}</CardDescription>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {status === "loading" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {status === "connected" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {status === "disconnected" && <XCircle className="h-4 w-4 text-muted-foreground" />}
            {status === "partial" && <CheckCircle2 className="h-4 w-4 text-yellow-500" />}
            <Badge
              variant="secondary"
              className={cn(
                status === "connected" && "bg-green-500/10 text-green-600",
                status === "partial" && "bg-yellow-500/10 text-yellow-600",
                status === "disconnected" && "bg-muted text-muted-foreground"
              )}
            >
              {statusText}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function IntegrationsPage() {
  const { t } = useTranslation();

  const { data: channelConfigs, isLoading } = useQuery({
    queryKey: ["/api/channel-configs"],
    queryFn: () => channelConfigsApi.list(),
  });

  // Determine WhatsApp status
  const whatsappConfigs = channelConfigs?.filter((c) => c.type === "whatsapp") ?? [];
  const connectedWhatsapp = whatsappConfigs.filter(
    (c) => (c.whatsappConfig as Record<string, unknown>)?.connectionStatus === "connected"
  );
  const whatsappStatus: IntegrationStatus = isLoading
    ? "loading"
    : connectedWhatsapp.length > 0
      ? connectedWhatsapp.length === whatsappConfigs.length
        ? "connected"
        : "partial"
      : "disconnected";

  // Determine Email status
  const emailConfigs = channelConfigs?.filter((c) => c.type === "email") ?? [];
  const connectedEmail = emailConfigs.filter((c) => c.isActive);
  const emailStatus: IntegrationStatus = isLoading
    ? "loading"
    : connectedEmail.length > 0
      ? connectedEmail.length === emailConfigs.length
        ? "connected"
        : "partial"
      : "disconnected";

  // Determine Calendar status (check via localStorage or API)
  const calendarStatus: IntegrationStatus = "disconnected"; // TODO: Check Google Calendar connection

  const getStatusText = (status: IntegrationStatus, _type: string): string => {
    if (status === "loading") return t("common.loading");
    if (status === "connected") return t("settings.integrations.connected");
    if (status === "partial") return t("settings.integrations.partiallyConnected");
    return t("settings.integrations.notConfigured");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t("settings.integrations.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.integrations.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <IntegrationCard
          href="/settings/integrations/whatsapp"
          icon={MessageCircle}
          title="WhatsApp"
          description={t("settings.integrations.whatsappDescription")}
          status={whatsappStatus}
          statusText={getStatusText(whatsappStatus, "whatsapp")}
        />
        <IntegrationCard
          href="/settings/integrations/email"
          icon={Mail}
          title="Email"
          description={t("settings.integrations.emailDescription")}
          status={emailStatus}
          statusText={getStatusText(emailStatus, "email")}
        />
        <IntegrationCard
          href="/settings/integrations/calendar"
          icon={Calendar}
          title="Google Calendar"
          description={t("settings.integrations.calendarDescription")}
          status={calendarStatus}
          statusText={getStatusText(calendarStatus, "calendar")}
        />
      </div>
    </div>
  );
}
