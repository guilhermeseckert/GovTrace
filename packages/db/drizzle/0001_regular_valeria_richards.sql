CREATE TABLE "fiscal_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"series" text NOT NULL,
	"ref_date" date NOT NULL,
	"value_millions_cad" numeric(15, 2),
	"source_table" text NOT NULL,
	"source_url" text NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "international_aid" (
	"id" text PRIMARY KEY NOT NULL,
	"project_title" text,
	"description" text,
	"implementer_name" text,
	"funding_department" text,
	"recipient_country" text,
	"recipient_region" text,
	"activity_status" text,
	"start_date" date,
	"end_date" date,
	"total_budget_cad" numeric(15, 2),
	"total_disbursed_cad" numeric(15, 2),
	"total_committed_cad" numeric(15, 2),
	"currency" text DEFAULT 'CAD',
	"normalized_implementer_name" text,
	"entity_id" uuid,
	"source_file_hash" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_snapshots_series_date_idx" ON "fiscal_snapshots" USING btree ("series","ref_date");--> statement-breakpoint
CREATE INDEX "fiscal_snapshots_ref_date_idx" ON "fiscal_snapshots" USING btree ("ref_date");--> statement-breakpoint
CREATE INDEX "international_aid_normalized_implementer_name_idx" ON "international_aid" USING btree ("normalized_implementer_name");--> statement-breakpoint
CREATE INDEX "international_aid_entity_id_idx" ON "international_aid" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "international_aid_recipient_country_idx" ON "international_aid" USING btree ("recipient_country");--> statement-breakpoint
CREATE INDEX "international_aid_start_date_idx" ON "international_aid" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "international_aid_activity_status_idx" ON "international_aid" USING btree ("activity_status");