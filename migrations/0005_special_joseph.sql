CREATE INDEX "idx_contacts_email_lower" ON "contacts" USING btree (LOWER("email"));--> statement-breakpoint
CREATE INDEX "idx_users_email_lower" ON "users" USING btree (LOWER("email"));--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "chk_deal_probability_range" CHECK ("deals"."probability" >= 0 AND "deals"."probability" <= 100);--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "chk_deal_value_positive" CHECK ("deals"."value" IS NULL OR "deals"."value" >= 0);--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "chk_stage_order_positive" CHECK ("pipeline_stages"."order" >= 0);