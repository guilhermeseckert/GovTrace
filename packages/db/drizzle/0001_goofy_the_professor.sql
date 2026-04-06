CREATE TABLE "pattern_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"pattern_type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"related_entity_id" uuid,
	"evidence_record_ids" text[],
	"evidence_tables" text[],
	"time_window_start" date,
	"time_window_end" date,
	"detected_value" numeric(15, 2),
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" text NOT NULL,
	"summary_text" text NOT NULL,
	"model" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_stale" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_profiles" (
	"person_id" integer PRIMARY KEY NOT NULL,
	"entity_id" uuid,
	"canonical_first_name" text NOT NULL,
	"canonical_last_name" text NOT NULL,
	"normalized_name" text,
	"match_method" text,
	"match_confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parliament_bills" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_number" text NOT NULL,
	"bill_number_formatted" text NOT NULL,
	"parliament_number" integer NOT NULL,
	"session_number" integer NOT NULL,
	"parl_session_code" text NOT NULL,
	"short_title_en" text,
	"short_title_fr" text,
	"long_title_en" text,
	"long_title_fr" text,
	"bill_type_en" text,
	"sponsor_en" text,
	"current_status_en" text,
	"received_royal_assent_at" timestamp with time zone,
	"passed_house_third_reading_at" timestamp with time zone,
	"legis_info_url" text,
	"raw_data" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parliament_vote_ballots" (
	"id" text PRIMARY KEY NOT NULL,
	"vote_id" text NOT NULL,
	"person_id" integer NOT NULL,
	"entity_id" uuid,
	"parliament_number" integer NOT NULL,
	"session_number" integer NOT NULL,
	"division_number" integer NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"constituency" text,
	"province" text,
	"caucus_short_name" text,
	"ballot_value" text NOT NULL,
	"is_yea" boolean DEFAULT false NOT NULL,
	"is_nay" boolean DEFAULT false NOT NULL,
	"is_paired" boolean DEFAULT false NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parliament_votes" (
	"id" text PRIMARY KEY NOT NULL,
	"parliament_number" integer NOT NULL,
	"session_number" integer NOT NULL,
	"parl_session_code" text NOT NULL,
	"division_number" integer NOT NULL,
	"vote_date" date NOT NULL,
	"vote_date_time" timestamp with time zone,
	"subject" text NOT NULL,
	"result_name" text NOT NULL,
	"yeas_total" integer DEFAULT 0 NOT NULL,
	"nays_total" integer DEFAULT 0 NOT NULL,
	"paired_total" integer DEFAULT 0 NOT NULL,
	"document_type_name" text,
	"bill_id" text,
	"bill_number" text,
	"ballots_ingested" boolean DEFAULT false NOT NULL,
	"source_file_hash" text,
	"raw_data" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
ALTER TABLE "pattern_flags" ADD CONSTRAINT "pattern_flags_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_flags" ADD CONSTRAINT "pattern_flags_related_entity_id_entities_id_fk" FOREIGN KEY ("related_entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_summaries" ADD CONSTRAINT "bill_summaries_bill_id_parliament_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."parliament_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parliament_vote_ballots" ADD CONSTRAINT "parliament_vote_ballots_vote_id_parliament_votes_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."parliament_votes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parliament_votes" ADD CONSTRAINT "parliament_votes_bill_id_parliament_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."parliament_bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pattern_flags_entity_id_idx" ON "pattern_flags" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "pattern_flags_pattern_type_idx" ON "pattern_flags" USING btree ("pattern_type");--> statement-breakpoint
CREATE INDEX "pattern_flags_related_entity_id_idx" ON "pattern_flags" USING btree ("related_entity_id");--> statement-breakpoint
CREATE INDEX "pattern_flags_severity_idx" ON "pattern_flags" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "pattern_flags_detected_at_idx" ON "pattern_flags" USING btree ("detected_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bill_summaries_bill_id_idx" ON "bill_summaries" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "mp_profiles_entity_id_idx" ON "mp_profiles" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "mp_profiles_normalized_name_idx" ON "mp_profiles" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "parliament_bills_bill_number_idx" ON "parliament_bills" USING btree ("bill_number");--> statement-breakpoint
CREATE INDEX "parliament_bills_parl_session_idx" ON "parliament_bills" USING btree ("parl_session_code");--> statement-breakpoint
CREATE INDEX "parliament_bills_bill_number_gin_idx" ON "parliament_bills" USING gin ("bill_number_formatted" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "parliament_vote_ballots_vote_id_idx" ON "parliament_vote_ballots" USING btree ("vote_id");--> statement-breakpoint
CREATE INDEX "parliament_vote_ballots_entity_id_idx" ON "parliament_vote_ballots" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "parliament_vote_ballots_person_id_idx" ON "parliament_vote_ballots" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "parliament_vote_ballots_caucus_idx" ON "parliament_vote_ballots" USING btree ("caucus_short_name");--> statement-breakpoint
CREATE INDEX "parliament_vote_ballots_ballot_value_idx" ON "parliament_vote_ballots" USING btree ("ballot_value");--> statement-breakpoint
CREATE UNIQUE INDEX "parliament_votes_session_division_idx" ON "parliament_votes" USING btree ("parl_session_code","division_number");--> statement-breakpoint
CREATE INDEX "parliament_votes_vote_date_idx" ON "parliament_votes" USING btree ("vote_date");--> statement-breakpoint
CREATE INDEX "parliament_votes_bill_id_idx" ON "parliament_votes" USING btree ("bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_snapshots_series_date_idx" ON "fiscal_snapshots" USING btree ("series","ref_date");--> statement-breakpoint
CREATE INDEX "fiscal_snapshots_ref_date_idx" ON "fiscal_snapshots" USING btree ("ref_date");--> statement-breakpoint
CREATE INDEX "international_aid_normalized_implementer_name_idx" ON "international_aid" USING btree ("normalized_implementer_name");--> statement-breakpoint
CREATE INDEX "international_aid_entity_id_idx" ON "international_aid" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "international_aid_recipient_country_idx" ON "international_aid" USING btree ("recipient_country");--> statement-breakpoint
CREATE INDEX "international_aid_start_date_idx" ON "international_aid" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "international_aid_activity_status_idx" ON "international_aid" USING btree ("activity_status");