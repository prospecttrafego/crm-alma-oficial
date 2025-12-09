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
} from "lucide-react";
import type { Deal, Contact, Conversation, Activity } from "@shared/schema";

interface DashboardStats {
  totalDeals: number;
  totalValue: number;
  openConversations: number;
  newContacts: number;
  pendingActivities: number;
  wonDeals: number;
  lostDeals: number;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: recentDeals, isLoading: dealsLoading } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const { data: recentActivities, isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here&apos;s your overview.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Total Pipeline Value</CardTitle>
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
                  {stats?.totalDeals || 0} open deals
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Open Conversations</CardTitle>
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
                  Awaiting response
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">New Contacts</CardTitle>
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
                  This month
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-win-rate">
                  {stats?.wonDeals && stats?.lostDeals
                    ? Math.round((stats.wonDeals / (stats.wonDeals + stats.lostDeals)) * 100)
                    : 0}%
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center text-green-600 dark:text-green-400">
                    <ArrowUpRight className="h-3 w-3" />
                    {stats?.wonDeals || 0} won
                  </span>
                  <span className="flex items-center text-red-600 dark:text-red-400">
                    <ArrowDownRight className="h-3 w-3" />
                    {stats?.lostDeals || 0} lost
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
            <CardTitle>Recent Deals</CardTitle>
            <CardDescription>Your latest pipeline activity</CardDescription>
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
                      {deal.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                No deals yet. Create your first deal!
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Activities</CardTitle>
            <CardDescription>Tasks and follow-ups due soon</CardDescription>
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
                        <span className="text-lg capitalize">
                          {activity.type === "call" && "📞"}
                          {activity.type === "email" && "📧"}
                          {activity.type === "meeting" && "📅"}
                          {activity.type === "note" && "📝"}
                          {activity.type === "task" && "✓"}
                        </span>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate font-medium">{activity.title}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {activity.type}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                No pending activities.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
