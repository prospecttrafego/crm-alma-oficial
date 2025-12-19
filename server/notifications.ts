/**
 * Firebase Cloud Messaging (FCM) Notification Service
 * Sends push notifications to users when WebSocket is not available
 */
import admin from "firebase-admin";

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.log("[FCM] Firebase not configured - push notifications disabled");
    return false;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    firebaseInitialized = true;
    console.log("[FCM] Firebase Admin SDK initialized");
    return true;
  } catch (error) {
    console.error("[FCM] Failed to initialize Firebase:", error);
    return false;
  }
}

// Initialize on module load
initializeFirebase();

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, string>;
  clickAction?: string;
}

/**
 * Send push notification to a single device
 * @param token - FCM device token
 * @param payload - Notification content
 */
export async function sendPushNotification(
  token: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  if (!firebaseInitialized) {
    console.log("[FCM] Firebase not initialized, skipping push notification");
    return false;
  }

  try {
    const message: admin.messaging.Message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.icon,
      },
      webpush: {
        notification: {
          icon: payload.icon || "/icon-192.png",
          badge: payload.badge || "/icon-72.png",
          vibrate: [100, 50, 100],
          requireInteraction: false,
        },
        fcmOptions: {
          link: payload.clickAction || "/",
        },
      },
      data: payload.data,
    };

    const response = await admin.messaging().send(message);
    console.log("[FCM] Successfully sent message:", response);
    return true;
  } catch (error) {
    console.error("[FCM] Error sending message:", error);
    return false;
  }
}

/**
 * Send push notification to multiple devices
 * @param tokens - Array of FCM device tokens
 * @param payload - Notification content
 */
export async function sendPushNotificationBatch(
  tokens: string[],
  payload: PushNotificationPayload
): Promise<{ successCount: number; failureCount: number }> {
  if (!firebaseInitialized) {
    return { successCount: 0, failureCount: tokens.length };
  }

  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.icon,
      },
      webpush: {
        notification: {
          icon: payload.icon || "/icon-192.png",
          badge: payload.badge || "/icon-72.png",
          vibrate: [100, 50, 100],
          requireInteraction: false,
        },
        fcmOptions: {
          link: payload.clickAction || "/",
        },
      },
      data: payload.data,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(
      `[FCM] Batch sent: ${response.successCount} success, ${response.failureCount} failures`
    );
    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error("[FCM] Error sending batch message:", error);
    return { successCount: 0, failureCount: tokens.length };
  }
}

/**
 * Check if FCM is available
 */
export function isFcmAvailable(): boolean {
  return firebaseInitialized;
}

/**
 * Notification types for the app
 */
export type NotificationType =
  | "message:new"
  | "deal:assigned"
  | "deal:stage_changed"
  | "deal:won"
  | "activity:reminder"
  | "mention";

/**
 * Create notification payload based on type
 */
export function createNotificationPayload(
  type: NotificationType,
  data: Record<string, any>
): PushNotificationPayload {
  switch (type) {
    case "message:new":
      return {
        title: data.senderName || "Nova mensagem",
        body: data.preview || "Você recebeu uma nova mensagem",
        icon: data.senderAvatar,
        clickAction: `/inbox?conversation=${data.conversationId}`,
        data: {
          type: "message:new",
          conversationId: String(data.conversationId),
        },
      };

    case "deal:assigned":
      return {
        title: "Negócio atribuído",
        body: `${data.dealTitle} foi atribuído a você`,
        clickAction: `/pipeline?deal=${data.dealId}`,
        data: {
          type: "deal:assigned",
          dealId: String(data.dealId),
        },
      };

    case "deal:stage_changed":
      return {
        title: "Negócio movido",
        body: `${data.dealTitle} foi movido para ${data.stageName}`,
        clickAction: `/pipeline?deal=${data.dealId}`,
        data: {
          type: "deal:stage_changed",
          dealId: String(data.dealId),
        },
      };

    case "deal:won":
      return {
        title: "Negócio ganho! 🎉",
        body: `${data.dealTitle} - R$ ${data.value}`,
        clickAction: `/pipeline?deal=${data.dealId}`,
        data: {
          type: "deal:won",
          dealId: String(data.dealId),
        },
      };

    case "activity:reminder":
      return {
        title: "Lembrete de atividade",
        body: data.activityTitle,
        clickAction: `/activities?activity=${data.activityId}`,
        data: {
          type: "activity:reminder",
          activityId: String(data.activityId),
        },
      };

    case "mention":
      return {
        title: `${data.mentionedBy} mencionou você`,
        body: data.preview || "Você foi mencionado em uma conversa",
        clickAction: `/inbox?conversation=${data.conversationId}`,
        data: {
          type: "mention",
          conversationId: String(data.conversationId),
        },
      };

    default:
      return {
        title: "Notificação",
        body: data.message || "Você tem uma nova notificação",
        clickAction: "/",
      };
  }
}
