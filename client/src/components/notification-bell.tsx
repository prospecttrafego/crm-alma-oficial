import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bell,
  MessageSquare,
  TrendingUp,
  Trophy,
  XCircle,
  Clock,
  AtSign,
  UserPlus,
  Check,
  BellRing,
} from "lucide-react";
import type { Notification } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { useTranslation } from "@/contexts/LanguageContext";
import { notificationsApi } from "@/lib/api/notifications";
import { useToast } from "@/hooks/use-toast";
import { useDesktopNotifications } from "@/hooks/useDesktopNotifications";
import { getGlobalWebSocket, type WebSocketMessage } from "@/hooks/useWebSocket";

const notificationIcons: Record<string, typeof Bell> = {
  new_message: MessageSquare,
  deal_moved: TrendingUp,
  deal_won: Trophy,
  deal_lost: XCircle,
  task_due: Clock,
  mention: AtSign,
  activity_assigned: UserPlus,
  conversation_assigned: MessageSquare,
};

// Types that should show toast notifications
const toastNotificationTypes = new Set([
  "deal_won",
  "deal_lost",
  "mention",
  "task_due",
]);

// Types that should show desktop notifications
const desktopNotificationTypes = new Set([
  "new_message",
  "deal_won",
  "deal_lost",
  "mention",
  "task_due",
  "activity_assigned",
]);

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const locale = language === "pt-BR" ? ptBR : enUS;
  const {
    isSupported: desktopNotificationsSupported,
    permission: desktopPermission,
    requestPermission,
    showNotification: showDesktopNotification,
  } = useDesktopNotifications();

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: notificationsApi.list,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: notificationsApi.unreadCount,
    // WebSocket handles real-time updates, but keep a fallback interval for safety
    refetchInterval: 60000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const unreadCount = unreadData?.count || 0;

  const getIcon = (type: string) => {
    const Icon = notificationIcons[type] || Bell;
    return Icon;
  };

  // Handle incoming WebSocket notifications
  const handleNewNotification = useCallback(
    (notification: { type: string; title: string; message?: string }) => {
      // Show toast for important notifications
      if (toastNotificationTypes.has(notification.type)) {
        const Icon = notificationIcons[notification.type] || Bell;
        toast({
          title: notification.title,
          description: notification.message,
          action: (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          ),
        });
      }

      // Show desktop notification if tab is not focused
      if (
        desktopNotificationsSupported &&
        desktopPermission === "granted" &&
        desktopNotificationTypes.has(notification.type)
      ) {
        showDesktopNotification({
          title: notification.title,
          body: notification.message,
          tag: `notification-${Date.now()}`,
          onClick: () => {
            setOpen(true);
          },
        });
      }

      // Update unread count optimistically
      queryClient.setQueryData<{ count: number }>(
        ["/api/notifications/unread-count"],
        (old) => ({
          count: (old?.count || 0) + 1,
        })
      );
    },
    [toast, desktopNotificationsSupported, desktopPermission, showDesktopNotification]
  );

  // Listen for WebSocket notification events
  useEffect(() => {
    const checkWebSocket = () => {
      const ws = getGlobalWebSocket();
      if (!ws) return;

      // We can't directly add event listeners to WebSocket,
      // but we can use the cache update that happens in useWebSocket
      // The notification:new event already invalidates the queries
      // This effect is for showing toasts/desktop notifications
    };

    // Check immediately and on interval (WebSocket might not be initialized yet)
    checkWebSocket();
    const interval = setInterval(checkWebSocket, 1000);

    // Listen for cache updates as a proxy for new notifications
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        event.query.queryKey[0] === "/api/notifications" &&
        event.action?.type === "success"
      ) {
        const newData = event.action.data as Notification[] | undefined;
        const oldData = event.query.state.data as Notification[] | undefined;

        if (newData && oldData) {
          // Find new notifications
          const oldIds = new Set(oldData.map((n) => n.id));
          const newNotifications = newData.filter((n) => !oldIds.has(n.id) && !n.isRead);

          newNotifications.forEach((notification) => {
            handleNewNotification({
              type: notification.type,
              title: notification.title,
              message: notification.message || undefined,
            });
          });
        }
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [handleNewNotification]);

  // Request desktop notification permission on first interaction
  const handleBellClick = async () => {
    setOpen(true);

    if (desktopNotificationsSupported && desktopPermission === "default") {
      await requestPermission();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
          aria-label={t("a11y.notifications")}
          onClick={handleBellClick}
        >
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5 animate-pulse" aria-hidden="true" />
          ) : (
            <Bell className="h-5 w-5" aria-hidden="true" />
          )}
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center px-1 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="font-semibold">{t("notifications.title")}</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <Check className="mr-1 h-3 w-3" />
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : !notifications?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">{t("notifications.empty")}</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = getIcon(notification.type);
                return (
                  <div
                    key={notification.id}
                    className={`flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
                      !notification.isRead ? "bg-muted/30" : ""
                    }`}
                    onClick={() => {
                      if (!notification.isRead) {
                        markReadMutation.mutate(notification.id);
                      }
                    }}
                    data-testid={`notification-item-${notification.id}`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-tight">
                        {notification.title}
                      </p>
                      {notification.message && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {notification.createdAt
                          ? formatDistanceToNow(new Date(notification.createdAt), {
                              addSuffix: true,
                              locale,
                            })
                          : t("notifications.justNow")}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
