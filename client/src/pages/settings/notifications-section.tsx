/**
 * Notifications Settings Section
 * Manages push notifications and sound preferences
 */

import { useState, useEffect } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Bell, BellRing, BellOff } from "lucide-react";

export function NotificationsSection() {
  const { t } = useTranslation();
  const {
    isSupported,
    isEnabled,
    isLoading,
    permissionStatus,
    enableNotifications,
  } = usePushNotifications();

  const {
    isEnabled: soundEnabled,
    setEnabled: setSoundEnabled,
    playNotification,
  } = useNotificationSound();

  const [soundEnabledState, setSoundEnabledState] = useState(soundEnabled);

  // Sync state with hook
  useEffect(() => {
    setSoundEnabledState(soundEnabled);
  }, [soundEnabled]);

  const handleSoundToggle = (checked: boolean) => {
    setSoundEnabledState(checked);
    setSoundEnabled(checked);
    if (checked) {
      // Play a test sound when enabling
      playNotification();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle>{t("settings.notifications.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings.notifications.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t("settings.notifications.email")}</p>
              <p className="text-sm text-muted-foreground">
                {t("settings.notifications.emailDescription")}
              </p>
            </div>
            <Badge variant="secondary">{t("settings.notifications.comingSoon")}</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isEnabled ? (
                <BellRing className="h-5 w-5 text-green-500" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">{t("settings.notifications.push")}</p>
                <p className="text-sm text-muted-foreground">
                  {!isSupported
                    ? t("settings.notifications.pushNotAvailable")
                    : permissionStatus === "denied"
                    ? t("settings.notifications.pushNotAvailable")
                    : isEnabled
                    ? t("settings.notifications.pushDescription")
                    : t("settings.notifications.pushDescription")}
                </p>
              </div>
            </div>
            {isSupported && permissionStatus !== "denied" && (
              <Switch
                checked={isEnabled}
                onCheckedChange={(checked) => {
                  if (checked) {
                    enableNotifications();
                  }
                }}
                disabled={isLoading || isEnabled}
                data-testid="switch-push-notifications"
              />
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t("settings.notifications.sounds")}</p>
              <p className="text-sm text-muted-foreground">
                {t("settings.notifications.soundsDescription")}
              </p>
            </div>
            <Switch
              checked={soundEnabledState}
              onCheckedChange={handleSoundToggle}
              data-testid="switch-notification-sounds"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
