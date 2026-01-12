import type { Express } from "express";
import {
  createContactSchema,
  updateContactSchema,
  idParamSchema,
  paginationQuerySchema,
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

export function registerContactRoutes(app: Express) {
  // GET /api/contacts - Listar contatos (com paginacao opcional)
  app.get(
    "/api/contacts",
    isAuthenticated,
    validateQuery(paginationQuerySchema),
    asyncHandler(async (req: any, res) => {
      const paginationRequested =
        req.query?.page !== undefined ||
        req.query?.limit !== undefined ||
        req.query?.search !== undefined ||
        req.query?.sortBy !== undefined ||
        req.query?.sortOrder !== undefined;

      const org = await storage.getDefaultOrganization();
      if (!org) {
        if (!paginationRequested) return sendSuccess(res, []);
        const page = req.validatedQuery.page ?? 1;
        const limit = req.validatedQuery.limit ?? 20;
        return sendSuccess(res, {
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0, hasMore: false },
        });
      }

      const { page, limit, search, sortBy, sortOrder } = req.validatedQuery;

      // Check if pagination is requested
      if (paginationRequested) {
        const result = await storage.getContactsPaginated(org.id, {
          page,
          limit,
          search,
          sortBy,
          sortOrder,
        });
        return sendSuccess(res, result);
      }

      // Fallback to non-paginated (for backward compatibility)
      const allContacts = await storage.getContacts(org.id);
      sendSuccess(res, allContacts);
    }),
  );

  // GET /api/contacts/:id - Obter contato por ID
  app.get(
    "/api/contacts/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
      const { id } = req.validatedParams;
      const contact = await storage.getContact(id);
      if (!contact) {
        return sendNotFound(res, "Contact not found");
      }
      sendSuccess(res, contact);
    }),
  );

  // POST /api/contacts - Criar contato
  app.post(
    "/api/contacts",
    isAuthenticated,
    validateBody(createContactSchema),
    asyncHandler(async (req: any, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendNotFound(res, "No organization");
      }
      const userId = (req.user as any).id;

      const { companyName, ...contactData } = req.validatedBody;
      let companyId: number | undefined;

      // Buscar ou criar empresa pelo nome
      if (companyName && companyName.trim()) {
        const trimmedName = companyName.trim();
        const existingCompany = await storage.getCompanyByName(trimmedName, org.id);
        if (existingCompany) {
          companyId = existingCompany.id;
        } else {
          const newCompany = await storage.createCompany({
            name: trimmedName,
            organizationId: org.id,
          });
          companyId = newCompany.id;
        }
      }

      const contact = await storage.createContact({
        ...contactData,
        companyId,
        organizationId: org.id,
      });

      await storage.createAuditLog({
        userId,
        action: "create",
        entityType: "contact",
        entityId: contact.id,
        entityName: `${contact.firstName} ${contact.lastName || ""}`.trim(),
        organizationId: org.id,
        changes: { after: contact as unknown as Record<string, unknown> },
      });

      sendSuccess(res, contact, 201);
    }),
  );

  // PATCH /api/contacts/:id - Atualizar contato
  app.patch(
    "/api/contacts/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    validateBody(updateContactSchema),
    asyncHandler(async (req: any, res) => {
      const { id } = req.validatedParams;
      const userId = (req.user as any).id;

      const existingContact = await storage.getContact(id);
      if (!existingContact) {
        return sendNotFound(res, "Contact not found");
      }

      const contact = await storage.updateContact(id, req.validatedBody);
      if (!contact) {
        return sendNotFound(res, "Contact not found");
      }

      const org = await storage.getDefaultOrganization();
      if (org) {
        await storage.createAuditLog({
          userId,
          action: "update",
          entityType: "contact",
          entityId: contact.id,
          entityName: `${contact.firstName} ${contact.lastName || ""}`.trim(),
          organizationId: org.id,
          changes: {
            before: existingContact as unknown as Record<string, unknown>,
            after: contact as unknown as Record<string, unknown>,
          },
        });
      }

      sendSuccess(res, contact);
    }),
  );

  // DELETE /api/contacts/:id - Excluir contato
  app.delete(
    "/api/contacts/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
      const { id } = req.validatedParams;
      const userId = (req.user as any).id;

      const existingContact = await storage.getContact(id);
      await storage.deleteContact(id);

      const org = await storage.getDefaultOrganization();
      if (org && existingContact) {
        await storage.createAuditLog({
          userId,
          action: "delete",
          entityType: "contact",
          entityId: id,
          entityName: `${existingContact.firstName} ${existingContact.lastName || ""}`.trim(),
          organizationId: org.id,
          changes: { before: existingContact as unknown as Record<string, unknown> },
        });
      }

      res.status(204).send();
    }),
  );
}
