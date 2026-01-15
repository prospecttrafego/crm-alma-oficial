ALTER TABLE "messages" ADD COLUMN "reply_to_id" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "original_content" text;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_messages_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_messages_reply_to" ON "messages" USING btree ("reply_to_id");--> statement-breakpoint
CREATE INDEX "idx_messages_deleted_at" ON "messages" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_messages_content_search" ON "messages" USING gin (to_tsvector('portuguese', coalesce("content", '')));