import type { Express } from "express";
import {
  createCompanySchema,
  updateCompanySchema,
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

export function registerCompanyRoutes(app: Express) {
  // GET /api/companies - Listar empresas (com paginacao opcional)
  app.get(
    "/api/companies",
    isAuthenticated,
    validateQuery(paginationQuerySchema),
    asyncHandler(async (req: any, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendSuccess(res, { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } });
      }

      const { page, limit, search, sortBy, sortOrder } = req.validatedQuery;

      // Check if pagination is requested
      if (page || limit || search) {
        const result = await storage.getCompaniesPaginated(org.id, {
          page,
          limit,
          search,
          sortBy,
          sortOrder,
        });
        return sendSuccess(res, result);
      }

      // Fallback to non-paginated (for backward compatibility)
      const allCompanies = await storage.getCompanies(org.id);
      sendSuccess(res, allCompanies);
    }),
  );

  // GET /api/companies/:id - Obter empresa por ID
  app.get(
    "/api/companies/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
      const { id } = req.validatedParams;
      const company = await storage.getCompany(id);
      if (!company) {
        return sendNotFound(res, "Company not found");
      }
      sendSuccess(res, company);
    }),
  );

  // POST /api/companies - Criar empresa
  app.post(
    "/api/companies",
    isAuthenticated,
    validateBody(createCompanySchema),
    asyncHandler(async (req: any, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendNotFound(res, "No organization");
      }
      const userId = (req.user as any).id;

      const company = await storage.createCompany({
        ...req.validatedBody,
        organizationId: org.id,
      });

      await storage.createAuditLog({
        userId,
        action: "create",
        entityType: "company",
        entityId: company.id,
        entityName: company.name,
        organizationId: org.id,
        changes: { after: company as unknown as Record<string, unknown> },
      });

      sendSuccess(res, company, 201);
    }),
  );

  // PATCH /api/companies/:id - Atualizar empresa
  app.patch(
    "/api/companies/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    validateBody(updateCompanySchema),
    asyncHandler(async (req: any, res) => {
      const { id } = req.validatedParams;
      const userId = (req.user as any).id;

      const existingCompany = await storage.getCompany(id);
      if (!existingCompany) {
        return sendNotFound(res, "Company not found");
      }

      const company = await storage.updateCompany(id, req.validatedBody);
      if (!company) {
        return sendNotFound(res, "Company not found");
      }

      const org = await storage.getDefaultOrganization();
      if (org) {
        await storage.createAuditLog({
          userId,
          action: "update",
          entityType: "company",
          entityId: company.id,
          entityName: company.name,
          organizationId: org.id,
          changes: {
            before: existingCompany as unknown as Record<string, unknown>,
            after: company as unknown as Record<string, unknown>,
          },
        });
      }

      sendSuccess(res, company);
    }),
  );

  // DELETE /api/companies/:id - Excluir empresa
  app.delete(
    "/api/companies/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
      const { id } = req.validatedParams;
      const userId = (req.user as any).id;

      const existingCompany = await storage.getCompany(id);
      await storage.deleteCompany(id);

      const org = await storage.getDefaultOrganization();
      if (org && existingCompany) {
        await storage.createAuditLog({
          userId,
          action: "delete",
          entityType: "company",
          entityId: id,
          entityName: existingCompany.name,
          organizationId: org.id,
          changes: { before: existingCompany as unknown as Record<string, unknown> },
        });
      }

      res.status(204).send();
    }),
  );
}
