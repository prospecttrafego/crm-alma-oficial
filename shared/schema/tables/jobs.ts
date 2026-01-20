import { integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

// Dead letter queue for failed background jobs
export const deadLetterJobs = pgTable("dead_letter_jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  originalJobId: varchar("original_job_id", { length: 50 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  payload: jsonb("payload").notNull(),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  firstFailedAt: timestamp("first_failed_at").notNull().defaultNow(),
  lastFailedAt: timestamp("last_failed_at").notNull().defaultNow(),
  retriedAt: timestamp("retried_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

