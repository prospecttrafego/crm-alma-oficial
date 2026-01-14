import {
  calendarEvents,
  contacts,
  deals,
  activities,
  type CalendarEvent,
  type InsertCalendarEvent,
} from "@shared/schema";
import { db } from "../db";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getTenantOrganizationId } from "./helpers";

export async function getCalendarEvents(
  _organizationId: number,
  startDate: Date,
  endDate: Date,
): Promise<CalendarEvent[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.organizationId, tenantOrganizationId),
        gte(calendarEvents.startTime, startDate),
        lte(calendarEvents.endTime, endDate),
      ),
    )
    .orderBy(calendarEvents.startTime);
}

export async function getCalendarEvent(id: number): Promise<CalendarEvent | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.organizationId, tenantOrganizationId)));
  return event;
}

export async function createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent> {
  const tenantOrganizationId = await getTenantOrganizationId();

  if (event.contactId) {
    const [contact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, event.contactId), eq(contacts.organizationId, tenantOrganizationId)))
      .limit(1);
    if (!contact) throw new Error("Contact not found");
  }

  if (event.dealId) {
    const [deal] = await db
      .select({ id: deals.id })
      .from(deals)
      .where(and(eq(deals.id, event.dealId), eq(deals.organizationId, tenantOrganizationId)))
      .limit(1);
    if (!deal) throw new Error("Deal not found");
  }

  if (event.activityId) {
    const [activity] = await db
      .select({ id: activities.id })
      .from(activities)
      .where(and(eq(activities.id, event.activityId), eq(activities.organizationId, tenantOrganizationId)))
      .limit(1);
    if (!activity) throw new Error("Activity not found");
  }

  const [created] = await db
    .insert(calendarEvents)
    .values({ ...event, organizationId: tenantOrganizationId })
    .returning();
  return created;
}

export async function updateCalendarEvent(
  id: number,
  event: Partial<InsertCalendarEvent>,
): Promise<CalendarEvent | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const { organizationId: _organizationId, ...updateData } = event as Partial<
    InsertCalendarEvent & { organizationId?: number }
  >;
  const [updated] = await db
    .update(calendarEvents)
    .set({ ...updateData, updatedAt: new Date() })
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.organizationId, tenantOrganizationId)))
    .returning();
  return updated;
}

export async function deleteCalendarEvent(id: number): Promise<void> {
  const tenantOrganizationId = await getTenantOrganizationId();
  await db
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.organizationId, tenantOrganizationId)));
}

// Calendar sync helpers
export async function getCalendarEventByGoogleId(
  googleEventId: string,
  userId: string,
): Promise<CalendarEvent | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.googleEventId, googleEventId),
        eq(calendarEvents.userId, userId),
        eq(calendarEvents.organizationId, tenantOrganizationId),
      ),
    );
  return event;
}

export async function getCalendarEventsForSync(
  userId: string,
  _organizationId: number,
): Promise<CalendarEvent[]> {
  // Get events that were created locally (syncSource = 'local') and need to be synced to Google
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.userId, userId),
        eq(calendarEvents.organizationId, tenantOrganizationId),
        eq(calendarEvents.syncSource, "local"),
      ),
    )
    .orderBy(desc(calendarEvents.startTime));
}
