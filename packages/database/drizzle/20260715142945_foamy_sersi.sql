CREATE TYPE "public"."alert_status" AS ENUM('queued', 'delivered', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."execution_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."execution_trigger" AS ENUM('manual', 'scheduled', 'preview');--> statement-breakpoint
CREATE TYPE "public"."field_value_type" AS ENUM('text', 'number', 'currency', 'date', 'url', 'boolean');--> statement-breakpoint
CREATE TYPE "public"."monitor_status" AS ENUM('healthy', 'changed', 'failing', 'paused', 'pending');--> statement-breakpoint
CREATE TYPE "public"."render_mode" AS ENUM('auto', 'static', 'browser');--> statement-breakpoint
CREATE TYPE "public"."renderer_used" AS ENUM('cheerio', 'playwright');--> statement-breakpoint
CREATE TYPE "public"."schedule_preset" AS ENUM('manual', 'every_15m', 'hourly', 'every_6h', 'daily');--> statement-breakpoint
CREATE TABLE "alert_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"status" "alert_status" DEFAULT 'queued' NOT NULL,
	"destination_host" varchar(253) NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"response_status" integer,
	"error_message" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(60) NOT NULL,
	"entity_id" uuid,
	"request_id" varchar(80),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"previous_execution_id" uuid,
	"has_changes" boolean NOT NULL,
	"change_count" integer NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid,
	"user_id" uuid NOT NULL,
	"trigger" "execution_trigger" NOT NULL,
	"status" "execution_status" DEFAULT 'queued' NOT NULL,
	"renderer" "renderer_used",
	"input" jsonb,
	"output" jsonb,
	"normalized_hash" char(64),
	"screenshot_key" text,
	"screenshot_content_type" varchar(80),
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"attempt" integer DEFAULT 0 NOT NULL,
	"http_status" integer,
	"final_url" text,
	"error_code" varchar(80),
	"error_message" text,
	"blocked_reason" text,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"logs" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extraction_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"key" varchar(64) NOT NULL,
	"label" varchar(80) NOT NULL,
	"selector" varchar(500) NOT NULL,
	"value_type" "field_value_type" DEFAULT 'text' NOT NULL,
	"attribute" varchar(80),
	"required" boolean DEFAULT false NOT NULL,
	"multiple" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"url" text NOT NULL,
	"hostname" varchar(253) NOT NULL,
	"render_mode" "render_mode" DEFAULT 'auto' NOT NULL,
	"schedule" "schedule_preset" DEFAULT 'manual' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"status" "monitor_status" DEFAULT 'pending' NOT NULL,
	"webhook_url" text,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_changed_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" char(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" varchar(300),
	"ip_hash" char(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changes" ADD CONSTRAINT "changes_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changes" ADD CONSTRAINT "changes_previous_execution_id_executions_id_fk" FOREIGN KEY ("previous_execution_id") REFERENCES "public"."executions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_fields" ADD CONSTRAINT "extraction_fields_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_deliveries_execution_idx" ON "alert_deliveries" USING btree ("execution_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_user_created_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "changes_execution_unique" ON "changes" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "changes_previous_execution_idx" ON "changes" USING btree ("previous_execution_id");--> statement-breakpoint
CREATE INDEX "executions_monitor_requested_idx" ON "executions" USING btree ("monitor_id","requested_at");--> statement-breakpoint
CREATE INDEX "executions_user_requested_idx" ON "executions" USING btree ("user_id","requested_at");--> statement-breakpoint
CREATE INDEX "executions_status_idx" ON "executions" USING btree ("status","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "extraction_fields_monitor_key_unique" ON "extraction_fields" USING btree ("monitor_id","key");--> statement-breakpoint
CREATE INDEX "extraction_fields_monitor_position_idx" ON "extraction_fields" USING btree ("monitor_id","position");--> statement-breakpoint
CREATE INDEX "monitors_user_updated_idx" ON "monitors" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "monitors_user_status_idx" ON "monitors" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "monitors_hostname_idx" ON "monitors" USING btree ("hostname");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");