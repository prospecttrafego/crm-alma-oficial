CREATE UNIQUE INDEX "idx_messages_external_id_unique" ON "messages" USING btree ("external_id") WHERE "external_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_org_created_at" ON "audit_logs" USING btree ("organization_id", "created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_org_entity" ON "audit_logs" USING btree ("organization_id", "entity_type", "entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_org_user" ON "audit_logs" USING btree ("organization_id", "user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_org_action" ON "audit_logs" USING btree ("organization_id", "action");--> statement-breakpoint
CREATE INDEX "idx_push_tokens_user_id" ON "push_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_channel_configs_org_type_active" ON "channel_configs" USING btree ("organization_id", "type", "is_active");--> statement-breakpoint
CREATE INDEX "idx_activities_org_due_date" ON "activities" USING btree ("organization_id", "due_date");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_org_start_time" ON "calendar_events" USING btree ("organization_id", "start_time");
