CREATE TABLE "hospitality_disclosures" (
	"id" text PRIMARY KEY NOT NULL,
	"ref_number" text NOT NULL,
	"disclosure_group" text,
	"name" text NOT NULL,
	"title_en" text,
	"department" text NOT NULL,
	"department_code" text,
	"description_en" text,
	"location_en" text,
	"vendor_en" text,
	"start_date" date,
	"end_date" date,
	"employee_attendees" integer,
	"guest_attendees" integer,
	"total" numeric(12, 2) NOT NULL,
	"normalized_name" text,
	"entity_id" uuid,
	"source_file_hash" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "travel_disclosures" (
	"id" text PRIMARY KEY NOT NULL,
	"ref_number" text NOT NULL,
	"disclosure_group" text,
	"name" text NOT NULL,
	"title_en" text,
	"department" text NOT NULL,
	"department_code" text,
	"purpose_en" text,
	"destination_en" text,
	"destination_2_en" text,
	"destination_other_en" text,
	"start_date" date,
	"end_date" date,
	"airfare" numeric(12, 2),
	"other_transport" numeric(12, 2),
	"lodging" numeric(12, 2),
	"meals" numeric(12, 2),
	"other_expenses" numeric(12, 2),
	"total" numeric(12, 2) NOT NULL,
	"normalized_name" text,
	"entity_id" uuid,
	"source_file_hash" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "hospitality_disclosures_normalized_name_idx" ON "hospitality_disclosures" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "hospitality_disclosures_entity_id_idx" ON "hospitality_disclosures" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "hospitality_disclosures_department_idx" ON "hospitality_disclosures" USING btree ("department");--> statement-breakpoint
CREATE INDEX "hospitality_disclosures_department_code_idx" ON "hospitality_disclosures" USING btree ("department_code");--> statement-breakpoint
CREATE INDEX "hospitality_disclosures_start_date_idx" ON "hospitality_disclosures" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "travel_disclosures_normalized_name_idx" ON "travel_disclosures" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "travel_disclosures_entity_id_idx" ON "travel_disclosures" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "travel_disclosures_department_idx" ON "travel_disclosures" USING btree ("department");--> statement-breakpoint
CREATE INDEX "travel_disclosures_department_code_idx" ON "travel_disclosures" USING btree ("department_code");--> statement-breakpoint
CREATE INDEX "travel_disclosures_start_date_idx" ON "travel_disclosures" USING btree ("start_date");