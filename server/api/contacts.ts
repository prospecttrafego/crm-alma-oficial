import type { Express } from "express";
import { insertContactSchema } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";

const updateContactSchema = insertContactSchema.partial().omit({ organizationId: true });

export function registerContactRoutes(app: Express) {
  // Contacts - supports pagination via query params (?page=1&limit=20&search=...)
  app.get("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return res.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } });
      }

      // Check if pagination is requested
      const { page, limit, search, sortBy, sortOrder } = req.query;
      if (page || limit || search) {
        const result = await storage.getContactsPaginated(org.id, {
          page: page ? parseInt(page) : undefined,
          limit: limit ? parseInt(limit) : undefined,
          search: search as string,
          sortBy: sortBy as string,
          sortOrder: sortOrder as "asc" | "desc",
        });
        return res.json(result);
      }

      // Fallback to non-paginated (for backward compatibility)
      const allContacts = await storage.getContacts(org.id);
      res.json(allContacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.get("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const contact = await storage.getContact(id);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      res.json(contact);
    } catch (error) {
      console.error("Error fetching contact:", error);
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.post("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(400).json({ message: "No organization" });
      const userId = (req.user as any).id;

      const parsed = insertContactSchema.safeParse({ ...req.body, organizationId: org.id });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const contact = await storage.createContact(parsed.data);

      await storage.createAuditLog({
        userId,
        action: "create",
        entityType: "contact",
        entityId: contact.id,
        entityName: `${contact.firstName} ${contact.lastName || ""}`.trim(),
        organizationId: org.id,
        changes: { after: contact as unknown as Record<string, unknown> },
      });

      res.status(201).json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.patch("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const userId = (req.user as any).id;

      const existingContact = await storage.getContact(id);
      const parsed = updateContactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const contact = await storage.updateContact(id, parsed.data);
      if (!contact) return res.status(404).json({ message: "Contact not found" });

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

      res.json(contact);
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
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
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });
}

