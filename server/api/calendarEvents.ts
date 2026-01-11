import type { Express } from "express";
import { z } from "zod";
import {
  insertCalendarEventSchema,
  updateCalendarEventSchema,
  idParamSchema,
} from "../validation";
import {
  isAuthenticated,
  validateBody,
  validateParams,
  validateQuery,
  asyncHandler,
} from "../middleware";
import { sendSuccess, sendNotFound } from "../response";
import { storage } from "../storage";
import { broadcast } from "../ws/index";

// Schema para query de eventos do calendario
const calendarEventsQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export function registerCalendarEventRoutes(app: Express) {
  // GET /api/calendar-events - Listar eventos do calendario
  app.get(
    "/api/calendar-events",
    isAuthenticated,
    validateQuery(calendarEventsQuerySchema),
    asyncHandler(async (req: any, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) return sendSuccess(res, []);

      const { startDate, endDate } = req.validatedQuery;
      const start = startDate || new Date();
      const end = endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const events = await storage.getCalendarEvents(org.id, start, end);
      sendSuccess(res, events);
    }),
  );

  // GET /api/calendar-events/:id - Obter evento por ID
  app.get(
    "/api/calendar-events/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
      const { id } = req.validatedParams;
      const event = await storage.getCalendarEvent(id);
      if (!event) {
        return sendNotFound(res, "Event not found");
      }
      sendSuccess(res, event);
    }),
  );

  // POST /api/calendar-events - Criar evento no calendario
  app.post(
    "/api/calendar-events",
    isAuthenticated,
    validateBody(insertCalendarEventSchema),
    asyncHandler(async (req: any, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendNotFound(res, "No organization");
      }
      const userId = (req.user as any).id;

      const event = await storage.createCalendarEvent({
        ...req.validatedBody,
        organizationId: org.id,
        userId,
      });
      broadcast("calendar:event:created", event);
      sendSuccess(res, event, 201);
    }),
  );

  // PATCH /api/calendar-events/:id - Atualizar evento do calendario
  app.patch(
    "/api/calendar-events/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    validateBody(updateCalendarEventSchema),
    asyncHandler(async (req: any, res) => {
      const { id } = req.validatedParams;

      const event = await storage.updateCalendarEvent(id, req.validatedBody);
      if (!event) {
        return sendNotFound(res, "Event not found");
      }
      broadcast("calendar:event:updated", event);
      sendSuccess(res, event);
    }),
  );

  // DELETE /api/calendar-events/:id - Excluir evento do calendario
  app.delete(
    "/api/calendar-events/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
      const { id } = req.validatedParams;

      await storage.deleteCalendarEvent(id);
      broadcast("calendar:event:deleted", { id });
      res.status(204).send();
    }),
  );
}
