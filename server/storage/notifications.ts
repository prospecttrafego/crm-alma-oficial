import { notifications, type Notification, type InsertNotification } from "@shared/schema";
import { db } from "../db";
import { and, count, desc, eq } from "drizzle-orm";

export async function getNotifications(userId: string): Promise<Notification[]> {
  return await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result?.count || 0;
}

export async function createNotification(
  notification: InsertNotification,
): Promise<Notification> {
  const [created] = await db.insert(notifications).values(notification).returning();
  return created;
}

export async function markNotificationRead(
  id: number,
  userId: string,
): Promise<Notification | undefined> {
  const [updated] = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning();
  return updated;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}
