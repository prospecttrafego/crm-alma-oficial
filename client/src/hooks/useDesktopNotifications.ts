/**
 * Hook for Web Notifications API (Desktop Notifications)
 * Shows native browser notifications when the tab is not focused
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface DesktopNotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  tag?: string;
  onClick?: () => void;
}

export function useDesktopNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [isTabFocused, setIsTabFocused] = useState(true);
  const pendingNotifications = useRef<DesktopNotificationOptions[]>([]);

  // Check if notifications are supported
  useEffect(() => {
    const supported = "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Track tab focus state
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabFocused(!document.hidden);
    };

    const handleFocus = () => setIsTabFocused(true);
    const handleBlur = () => setIsTabFocused(false);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Request permission
  const requestPermission = useCallback(async () => {
    if (!isSupported) return "denied" as NotificationPermission;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (error) {
      console.error("[DesktopNotifications] Error requesting permission:", error);
      return "denied" as NotificationPermission;
    }
  }, [isSupported]);

  // Show notification
  const showNotification = useCallback(
    (options: DesktopNotificationOptions) => {
      // Only show if tab is not focused and permission is granted
      if (!isSupported || permission !== "granted" || isTabFocused) {
        return null;
      }

      try {
        const notification = new Notification(options.title, {
          body: options.body,
          icon: options.icon || "/favicon.ico",
          tag: options.tag,
          requireInteraction: false,
        });

        notification.onclick = () => {
          window.focus();
          options.onClick?.();
          notification.close();
        };

        // Auto close after 5 seconds
        setTimeout(() => {
          notification.close();
        }, 5000);

        return notification;
      } catch (error) {
        console.error("[DesktopNotifications] Error showing notification:", error);
        return null;
      }
    },
    [isSupported, permission, isTabFocused]
  );

  // Queue notification for when tab loses focus
  const queueNotification = useCallback((options: DesktopNotificationOptions) => {
    if (!isTabFocused) {
      showNotification(options);
    } else {
      pendingNotifications.current.push(options);
    }
  }, [isTabFocused, showNotification]);

  // Show pending notifications when tab loses focus
  useEffect(() => {
    if (!isTabFocused && pendingNotifications.current.length > 0) {
      pendingNotifications.current.forEach((notification) => {
        showNotification(notification);
      });
      pendingNotifications.current = [];
    }
  }, [isTabFocused, showNotification]);

  return {
    isSupported,
    permission,
    isTabFocused,
    requestPermission,
    showNotification,
    queueNotification,
  };
}
