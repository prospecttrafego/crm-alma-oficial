/**
 * Hook for managing push notifications
 * Handles permission requests, token management, and foreground messages
 */
import { useState, useEffect, useCallback } from "react";
import { MessagePayload } from "firebase/messaging";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import {
  initializeFirebase,
  isFirebaseConfigured,
  requestNotificationPermission,
  onForegroundMessage,
  getNotificationPermissionStatus,
} from "@/lib/firebase";

export interface UsePushNotificationsResult {
  isSupported: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  permissionStatus: NotificationPermission | "unsupported";
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | "unsupported">("default");

  // Check initial state
  useEffect(() => {
    const status = getNotificationPermissionStatus();
    setPermissionStatus(status);
    setIsEnabled(status === "granted");
  }, []);

  // Initialize Firebase and listen for foreground messages
  useEffect(() => {
    if (!user || !isFirebaseConfigured()) return;

    initializeFirebase();

    // Listen for foreground messages
    const unsubscribe = onForegroundMessage((payload: MessagePayload) => {
      // Show toast for foreground messages
      if (payload.notification) {
        toast({
          title: payload.notification.title || "Nova notificação",
          description: payload.notification.body,
        });
      }
    });

    return unsubscribe;
  }, [user, toast]);

  const enableNotifications = useCallback(async (): Promise<boolean> => {
    if (!isFirebaseConfigured()) {
      console.log("[Push] Firebase not configured");
      return false;
    }

    setIsLoading(true);
    try {
      const token = await requestNotificationPermission();
      if (token) {
        setIsEnabled(true);
        setPermissionStatus("granted");
        toast({
          title: "Notificações ativadas",
          description: "Você receberá notificações push quando estiver offline.",
        });
        return true;
      } else {
        setPermissionStatus(getNotificationPermissionStatus());
        toast({
          title: "Permissão negada",
          description: "Você pode ativar as notificações nas configurações do navegador.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error("[Push] Error enabling notifications:", error);
      toast({
        title: "Erro ao ativar notificações",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const disableNotifications = useCallback(async (): Promise<void> => {
    // Note: We can't actually revoke notification permission programmatically
    // The user needs to do it in browser settings
    toast({
      title: "Desativar notificações",
      description: "Para desativar, vá nas configurações do navegador > Notificações.",
    });
  }, [toast]);

  return {
    isSupported: isFirebaseConfigured() && "Notification" in window,
    isEnabled,
    isLoading,
    permissionStatus,
    enableNotifications,
    disableNotifications,
  };
}
