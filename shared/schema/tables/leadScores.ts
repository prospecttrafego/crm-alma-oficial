import { integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import type { LeadScoreEntityType } from "../enums";
import { organizations } from "./organizations";

// Lead scores table for AI scoring history
export const leadScores = pgTable("lead_scores", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  entityType: varchar("entity_type", { length: 20 }).$type<LeadScoreEntityType>().notNull(),
  entityId: integer("entity_id").notNull(),
  score: integer("score").notNull(),
  factors: jsonb("factors").$type<{
    engagement: number;
    dealValue: number;
    activityLevel: number;
    recency: number;
    completeness: number;
  }>(),
  recommendation: text("recommendation"),
  nextBestAction: text("next_best_action"),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

