import type { Express } from "express";
import {
  insertEmailTemplateSchema,
  updateEmailTemplateSchema,
  idParamSchema,
} from "../validation";
import {
  isAuthenticated,
  validateBody,
  validateParams,
  asyncHandler,
} from "../middleware";
import { sendSuccess, sendNotFound } from "../response";
import { storage } from "../storage";

export function registerEmailTemplateRoutes(app: Express) {
  // GET /api/email-templates - Listar templates de email
  app.get(
    "/api/email-templates",
    isAuthenticated,
    asyncHandler(async (_req: any, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) return sendSuccess(res, []);
      const templates = await storage.getEmailTemplates(org.id);
      sendSuccess(res, templates);
    }),
  );

  // GET /api/email-templates/:id - Obter template por ID
  app.get(
    "/api/email-templates/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendNotFound(res, "Organization not found");
      }
      const { id } = req.validatedParams;
      const template = await storage.getEmailTemplate(id, org.id);
      if (!template) {
        return sendNotFound(res, "Template not found");
      }
      sendSuccess(res, template);
    }),
  );

  // POST /api/email-templates - Criar template de email
  app.post(
    "/api/email-templates",
    isAuthenticated,
    validateBody(insertEmailTemplateSchema),
    asyncHandler(async (req: any, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendNotFound(res, "No organization");
      }
      const userId = (req.user as any).id;

      const template = await storage.createEmailTemplate({
        ...req.validatedBody,
        organizationId: org.id,
        createdBy: userId,
      });
      sendSuccess(res, template, 201);
    }),
  );

  // PATCH /api/email-templates/:id - Atualizar template de email
  app.patch(
    "/api/email-templates/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    validateBody(updateEmailTemplateSchema),
    asyncHandler(async (req: any, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendNotFound(res, "Organization not found");
      }
      const { id } = req.validatedParams;

      const template = await storage.updateEmailTemplate(id, org.id, req.validatedBody);
      if (!template) {
        return sendNotFound(res, "Template not found");
      }
      sendSuccess(res, template);
    }),
  );

  // DELETE /api/email-templates/:id - Excluir template de email
  app.delete(
    "/api/email-templates/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendNotFound(res, "Organization not found");
      }
      const { id } = req.validatedParams;
      await storage.deleteEmailTemplate(id, org.id);
      res.status(204).send();
    }),
  );
}
