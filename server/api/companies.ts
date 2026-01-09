import type { Express } from "express";
import { insertCompanySchema } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";

const updateCompanySchema = insertCompanySchema.partial().omit({ organizationId: true });

export function registerCompanyRoutes(app: Express) {
  // Companies - supports pagination via query params (?page=1&limit=20&search=...)
  app.get("/api/companies", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return res.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } });
      }

      // Check if pagination is requested
      const { page, limit, search, sortBy, sortOrder } = req.query;
      if (page || limit || search) {
        const result = await storage.getCompaniesPaginated(org.id, {
          page: page ? parseInt(page) : undefined,
          limit: limit ? parseInt(limit) : undefined,
          search: search as string,
          sortBy: sortBy as string,
          sortOrder: sortOrder as "asc" | "desc",
        });
        return res.json(result);
      }

      // Fallback to non-paginated (for backward compatibility)
      const allCompanies = await storage.getCompanies(org.id);
      res.json(allCompanies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.get("/api/companies/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const company = await storage.getCompany(id);
      if (!company) return res.status(404).json({ message: "Company not found" });
      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.post("/api/companies", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(400).json({ message: "No organization" });
      const userId = (req.user as any).id;

      const parsed = insertCompanySchema.safeParse({ ...req.body, organizationId: org.id });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const company = await storage.createCompany(parsed.data);

      await storage.createAuditLog({
        userId,
        action: "create",
        entityType: "company",
        entityId: company.id,
        entityName: company.name,
        organizationId: org.id,
        changes: { after: company as unknown as Record<string, unknown> },
      });

      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.patch("/api/companies/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const userId = (req.user as any).id;

      const existingCompany = await storage.getCompany(id);
      const parsed = updateCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const company = await storage.updateCompany(id, parsed.data);
      if (!company) return res.status(404).json({ message: "Company not found" });

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

      res.json(company);
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  app.delete("/api/companies/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
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
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ message: "Failed to delete company" });
    }
  });
}

