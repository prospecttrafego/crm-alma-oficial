CREATE INDEX "idx_conversations_org_status" ON "conversations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_conversations_contact_channel" ON "conversations" USING btree ("contact_id","channel");--> statement-breakpoint
CREATE INDEX "idx_files_entity" ON "files" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_files_organization" ON "files" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_messages_conv_created" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_users_org_email" ON "users" USING btree ("organization_id","email");