import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Users,
  Inbox,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Phone,
  Mail,
  Calendar,
  FileText,
  CheckSquare,
} from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import type { Deal, Activity } from "@shared/schema";
import { api } from "@/lib/api";
import { dealsApi } from "@/lib/api/deals";
import { activitiesApi } from "@/lib/api/activities";

interface DashboardStats {
  totalDeals: number;
  openDeals: number;
  totalValue: number;
  openConversations: number;
  newContacts: number;
  pendingActivities: number;
  wonDeals: number;
  lostDeals: number;
}

export default function Dashboard() {
  const { t } = useTranslation();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: () => api.get<DashboardStats>("/api/dashboard/stats"),
  });

  const { data: recentDeals, isLoading: dealsLoading } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
    queryFn: dealsApi.list,
  });

  const { data: recentActivities, isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
    queryFn: activitiesApi.list,
  });

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground">{t("dashboard.welcomeSubtitle")}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.pipelineValue")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-pipeline-value">
                  R$ {(stats?.totalValue || 0).toLocaleString("pt-BR")}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.openDealsCount", { count: stats?.openDeals || 0 })}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.openConversations")}</CardTitle>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-open-conversations">
                  {stats?.openConversations || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.awaitingResponse")}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.newContacts")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-new-contacts">
                  {stats?.newContacts || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.thisMonth")}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.winRate")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-win-rate">
                  {(() => {
                    const won = stats?.wonDeals || 0;
                    const lost = stats?.lostDeals || 0;
                    const total = won + lost;
                    return total > 0 ? Math.round((won / total) * 100) : 0;
                  })()}%
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center text-green-600 dark:text-green-400">
                    <ArrowUpRight className="h-3 w-3" />
                    {stats?.wonDeals || 0} {t("dashboard.won")}
                  </span>
                  <span className="flex items-center text-red-600 dark:text-red-400">
                    <ArrowDownRight className="h-3 w-3" />
                    {stats?.lostDeals || 0} {t("dashboard.lost")}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recentDeals")}</CardTitle>
            <CardDescription>{t("dashboard.latestPipeline")}</CardDescription>
          </CardHeader>
          <CardContent>
            {dealsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : recentDeals && recentDeals.length > 0 ? (
              <div className="space-y-3">
                {recentDeals.slice(0, 5).map((deal) => (
                  <div
                    key={deal.id}
                    className="flex items-center gap-3 rounded-md p-2 hover-elevate"
                    data-testid={`card-deal-${deal.id}`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate font-medium">{deal.title}</p>
                      <p className="text-sm text-muted-foreground">
                        R$ {Number(deal.value || 0).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {t(`pipeline.status.${deal.status}`)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                {t("dashboard.noDeals")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.pendingActivities")}</CardTitle>
            <CardDescription>{t("dashboard.tasksDueSoon")}</CardDescription>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivities && recentActivities.length > 0 ? (
              <div className="space-y-3">
                {recentActivities
                  .filter((a) => a.status === "pending")
                  .slice(0, 5)
                  .map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-3 rounded-md p-2 hover-elevate"
                      data-testid={`card-activity-${activity.id}`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent">
                        {activity.type === "call" && <Phone className="h-5 w-5 text-muted-foreground" />}
                        {activity.type === "email" && <Mail className="h-5 w-5 text-muted-foreground" />}
                        {activity.type === "meeting" && <Calendar className="h-5 w-5 text-muted-foreground" />}
                        {activity.type === "note" && <FileText className="h-5 w-5 text-muted-foreground" />}
                        {activity.type === "task" && <CheckSquare className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate font-medium">{activity.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {t(`activities.types.${activity.type}`)}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                {t("dashboard.noPendingActivities")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
