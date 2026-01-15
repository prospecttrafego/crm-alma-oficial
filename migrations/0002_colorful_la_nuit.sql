CREATE TABLE "dead_letter_jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "dead_letter_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"original_job_id" varchar(50) NOT NULL,
	"type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"first_failed_at" timestamp DEFAULT now() NOT NULL,
	"last_failed_at" timestamp DEFAULT now() NOT NULL,
	"retried_at" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
