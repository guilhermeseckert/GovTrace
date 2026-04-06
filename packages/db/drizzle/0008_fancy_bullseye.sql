CREATE TABLE "gazette_regulations" (
	"id" text PRIMARY KEY NOT NULL,
	"sor_number" text,
	"title" text NOT NULL,
	"gazette_part" text NOT NULL,
	"publication_date" date NOT NULL,
	"registration_date" date,
	"responsible_department" text,
	"enabling_act" text,
	"gazette_url" text NOT NULL,
	"lobbying_subject_categories" text[],
	"source_file_hash" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "gazette_regulations_publication_date_idx" ON "gazette_regulations" USING btree ("publication_date");--> statement-breakpoint
CREATE INDEX "gazette_regulations_responsible_department_idx" ON "gazette_regulations" USING btree ("responsible_department");--> statement-breakpoint
CREATE INDEX "gazette_regulations_gazette_part_idx" ON "gazette_regulations" USING btree ("gazette_part");--> statement-breakpoint
CREATE INDEX "gazette_regulations_sor_number_idx" ON "gazette_regulations" USING btree ("sor_number");