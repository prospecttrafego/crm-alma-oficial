/**
 * Deal Auto-Creator Service
 * Handles automatic deal creation from WhatsApp leads with race condition protection
 */

import { db } from "../db";
import { deals } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { storage } from "../storage";
import { createServiceLogger } from "../logger";

const dealLogger = createServiceLogger("deal-auto-creator");

export interface DealAutoCreationOptions {
  contactId: number;
  contactName: string;
  organizationId: number;
  source: string;
}

export interface DealAutoCreationResult {
  deal: Awaited<ReturnType<typeof storage.createDeal>> | null;
  created: boolean;
  reason?: string;
}

/**
 * Automatically create a deal for a contact if they don't have an open deal.
 * Uses advisory lock to prevent race conditions when multiple messages arrive simultaneously.
 */
export async function autoCreateDealForContact(
  options: DealAutoCreationOptions
): Promise<DealAutoCreationResult> {
  const { contactId, contactName, organizationId, source } = options;

  try {
    // Use transaction with advisory lock to prevent race conditions
    const newDeal = await db.transaction(async (tx) => {
      // Acquire advisory lock based on contact ID (prevents concurrent deal creation for same contact)
      // This lock is automatically released when the transaction commits/rollbacks
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${contactId})`);

      // Check for open deals within the transaction (after acquiring lock)
      const existingOpenDeals = await tx
        .select({ id: deals.id })
        .from(deals)
        .where(and(
          eq(deals.contactId, contactId),
          eq(deals.status, "open")
        ))
        .limit(1);

      if (existingOpenDeals.length > 0) {
        dealLogger.info(`Contact ${contactId} already has open deal, skipping creation`);
        return null;
      }

      // Get or create default pipeline
      let defaultPipeline = await storage.getDefaultPipeline(organizationId);

      if (!defaultPipeline) {
        dealLogger.info(`Creating default pipeline for organization ${organizationId}`);
        defaultPipeline = await storage.createPipeline({
          name: "Pipeline Padrão",
          organizationId,
          isDefault: true,
        });

        // Create initial stage
        await storage.createPipelineStage({
          name: "Novo Lead",
          pipelineId: defaultPipeline.id,
          order: 0,
          color: "#3B82F6",
          isWon: false,
          isLost: false,
        });

        dealLogger.info(`Created default pipeline: ${defaultPipeline.id}`);
      }

      // Get stages for pipeline (sorted by order)
      const stages = await storage.getPipelineStages(defaultPipeline.id);
      const firstStage = stages.sort((a, b) => a.order - b.order)[0];

      if (!firstStage) {
        dealLogger.error("No stages found even after creating pipeline");
        return null;
      }

      const dealTitle = `Lead ${source.charAt(0).toUpperCase() + source.slice(1)}: ${contactName}`;

      const createdDeal = await storage.createDeal({
        title: dealTitle,
        pipelineId: defaultPipeline.id,
        stageId: firstStage.id,
        contactId,
        organizationId,
        source,
        probability: 10,
        status: "open",
      });

      dealLogger.info(`Auto-created deal: ${createdDeal.id} for contact: ${contactId}`);
      return createdDeal;
    });

    if (newDeal) {
      return { deal: newDeal, created: true };
    }

    return { deal: null, created: false, reason: "Contact already has open deal" };
  } catch (error) {
    dealLogger.error("Error auto-creating deal", {
      error: error instanceof Error ? error.message : String(error),
      contactId,
    });
    return { deal: null, created: false, reason: "Error during creation" };
  }
}
