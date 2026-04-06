CREATE TABLE "gic_appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"appointee_name" text NOT NULL,
	"normalized_appointee_name" text,
	"position_title" text NOT NULL,
	"organization_name" text NOT NULL,
	"organization_code" text NOT NULL,
	"appointment_type" text,
	"tenure_type" text,
	"appointment_date" date,
	"expiry_date" date,
	"is_vacant" boolean DEFAULT false NOT NULL,
	"entity_id" uuid,
	"source_url" text NOT NULL,
	"source_file_hash" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "international_aid" ADD COLUMN "sector_code" text;--> statement-breakpoint
CREATE INDEX "gic_appointments_normalized_appointee_name_idx" ON "gic_appointments" USING btree ("normalized_appointee_name");--> statement-breakpoint
CREATE INDEX "gic_appointments_entity_id_idx" ON "gic_appointments" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "gic_appointments_organization_code_idx" ON "gic_appointments" USING btree ("organization_code");--> statement-breakpoint
CREATE INDEX "gic_appointments_appointment_date_idx" ON "gic_appointments" USING btree ("appointment_date");--> statement-breakpoint
CREATE UNIQUE INDEX "gic_appointments_org_name_title_idx" ON "gic_appointments" USING btree ("organization_code","appointee_name","position_title");--> statement-breakpoint
CREATE INDEX "international_aid_sector_code_idx" ON "international_aid" USING btree ("sector_code");