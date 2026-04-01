CREATE TABLE "entity_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_a_id" uuid NOT NULL,
	"entity_b_id" uuid NOT NULL,
	"connection_type" text NOT NULL,
	"total_value" numeric(15, 2),
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"first_seen" date,
	"last_seen" date,
	"source_record_ids" text[],
	"source_table" text NOT NULL,
	"is_stale" boolean DEFAULT false NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"summary_text" text NOT NULL,
	"model" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_stale" boolean DEFAULT false NOT NULL,
	"data_snapshot_hash" text
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"entity_type" text NOT NULL,
	"province" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"raw_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"source_table" text NOT NULL,
	"source_field" text NOT NULL,
	"match_method" text NOT NULL,
	"confidence_score" real,
	"ai_reasoning" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_matches_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_a_id" uuid,
	"entity_b_id" uuid,
	"raw_name_a" text NOT NULL,
	"raw_name_b" text NOT NULL,
	"normalized_name_a" text NOT NULL,
	"normalized_name_b" text NOT NULL,
	"match_method" text NOT NULL,
	"similarity_score" real,
	"ai_model" text,
	"ai_confidence" real,
	"ai_reasoning" text,
	"decision" text NOT NULL,
	"is_flagged_for_review" boolean DEFAULT false NOT NULL,
	"flag_reason" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid,
	"match_log_id" uuid,
	"reporter_email" text,
	"description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"source_file_url" text,
	"source_file_hash" text,
	"detected_encoding" text,
	"records_processed" integer DEFAULT 0 NOT NULL,
	"records_inserted" integer DEFAULT 0 NOT NULL,
	"records_updated" integer DEFAULT 0 NOT NULL,
	"records_skipped" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"audit_data" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text,
	"vendor_name" text NOT NULL,
	"department" text NOT NULL,
	"description" text,
	"value" numeric(15, 2),
	"original_value" numeric(15, 2),
	"start_date" date,
	"end_date" date,
	"award_date" date,
	"procurement_method" text,
	"province" text,
	"normalized_vendor_name" text,
	"entity_id" uuid,
	"source_file_hash" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" text PRIMARY KEY NOT NULL,
	"contributor_name" text NOT NULL,
	"contributor_type" text,
	"amount" numeric(12, 2) NOT NULL,
	"donation_date" date NOT NULL,
	"riding_code" text,
	"riding_name" text,
	"recipient_name" text NOT NULL,
	"recipient_type" text,
	"election_year" integer,
	"province" text,
	"normalized_contributor_name" text,
	"entity_id" uuid,
	"source_file_hash" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grants" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_legal_name" text,
	"department" text NOT NULL,
	"program_name" text,
	"description" text,
	"amount" numeric(15, 2),
	"agreement_date" date,
	"start_date" date,
	"end_date" date,
	"province" text,
	"city" text,
	"grant_type" text,
	"normalized_recipient_name" text,
	"entity_id" uuid,
	"source_file_hash" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lobby_communications" (
	"id" text PRIMARY KEY NOT NULL,
	"registration_number" text NOT NULL,
	"communication_date" date NOT NULL,
	"lobbyist_name" text NOT NULL,
	"client_name" text,
	"public_official_name" text NOT NULL,
	"public_official_title" text,
	"department" text,
	"subject_matter" text,
	"communication_method" text,
	"normalized_lobbyist_name" text,
	"normalized_official_name" text,
	"lobbyist_entity_id" uuid,
	"official_entity_id" uuid,
	"source_file_hash" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lobby_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"registration_number" text NOT NULL,
	"lobbyist_name" text NOT NULL,
	"lobbyist_type" text,
	"client_name" text,
	"subject_matter" text,
	"target_departments" text[],
	"status" text,
	"registration_date" date,
	"last_updated_date" date,
	"province" text,
	"normalized_lobbyist_name" text,
	"normalized_client_name" text,
	"lobbyist_entity_id" uuid,
	"client_entity_id" uuid,
	"source_file_hash" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entity_connections" ADD CONSTRAINT "entity_connections_entity_a_id_entities_id_fk" FOREIGN KEY ("entity_a_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_connections" ADD CONSTRAINT "entity_connections_entity_b_id_entities_id_fk" FOREIGN KEY ("entity_b_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_aliases" ADD CONSTRAINT "entity_aliases_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_match_log_id_entity_matches_log_id_fk" FOREIGN KEY ("match_log_id") REFERENCES "public"."entity_matches_log"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entity_connections_entity_a_id_idx" ON "entity_connections" USING btree ("entity_a_id");--> statement-breakpoint
CREATE INDEX "entity_connections_entity_b_id_idx" ON "entity_connections" USING btree ("entity_b_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_connections_a_b_type_idx" ON "entity_connections" USING btree ("entity_a_id","entity_b_id","connection_type");--> statement-breakpoint
CREATE INDEX "entity_connections_stale_idx" ON "entity_connections" USING btree ("is_stale");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_summaries_entity_id_idx" ON "ai_summaries" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "entities_normalized_name_gin_idx" ON "entities" USING gin ("normalized_name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "entities_canonical_name_type_idx" ON "entities" USING btree ("canonical_name","entity_type");--> statement-breakpoint
CREATE INDEX "entity_aliases_entity_id_idx" ON "entity_aliases" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "entity_aliases_normalized_name_idx" ON "entity_aliases" USING btree ("normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_aliases_raw_name_source_idx" ON "entity_aliases" USING btree ("raw_name","source_table","source_field");--> statement-breakpoint
CREATE INDEX "entity_matches_log_entity_a_id_idx" ON "entity_matches_log" USING btree ("entity_a_id");--> statement-breakpoint
CREATE INDEX "entity_matches_log_entity_b_id_idx" ON "entity_matches_log" USING btree ("entity_b_id");--> statement-breakpoint
CREATE INDEX "entity_matches_log_flagged_idx" ON "entity_matches_log" USING btree ("is_flagged_for_review");--> statement-breakpoint
CREATE INDEX "flags_entity_id_idx" ON "flags" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "flags_status_idx" ON "flags" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ingestion_runs_source_idx" ON "ingestion_runs" USING btree ("source");--> statement-breakpoint
CREATE INDEX "ingestion_runs_started_at_idx" ON "ingestion_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "contracts_normalized_vendor_name_idx" ON "contracts" USING btree ("normalized_vendor_name");--> statement-breakpoint
CREATE INDEX "contracts_entity_id_idx" ON "contracts" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "contracts_department_idx" ON "contracts" USING btree ("department");--> statement-breakpoint
CREATE INDEX "contracts_award_date_idx" ON "contracts" USING btree ("award_date");--> statement-breakpoint
CREATE INDEX "donations_normalized_contributor_name_idx" ON "donations" USING btree ("normalized_contributor_name");--> statement-breakpoint
CREATE INDEX "donations_entity_id_idx" ON "donations" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "donations_donation_date_idx" ON "donations" USING btree ("donation_date");--> statement-breakpoint
CREATE INDEX "donations_election_year_idx" ON "donations" USING btree ("election_year");--> statement-breakpoint
CREATE INDEX "grants_normalized_recipient_name_idx" ON "grants" USING btree ("normalized_recipient_name");--> statement-breakpoint
CREATE INDEX "grants_entity_id_idx" ON "grants" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "grants_department_idx" ON "grants" USING btree ("department");--> statement-breakpoint
CREATE INDEX "lobby_communications_registration_number_idx" ON "lobby_communications" USING btree ("registration_number");--> statement-breakpoint
CREATE INDEX "lobby_communications_normalized_lobbyist_name_idx" ON "lobby_communications" USING btree ("normalized_lobbyist_name");--> statement-breakpoint
CREATE INDEX "lobby_communications_normalized_official_name_idx" ON "lobby_communications" USING btree ("normalized_official_name");--> statement-breakpoint
CREATE INDEX "lobby_communications_communication_date_idx" ON "lobby_communications" USING btree ("communication_date");--> statement-breakpoint
CREATE UNIQUE INDEX "lobby_registrations_registration_number_idx" ON "lobby_registrations" USING btree ("registration_number");--> statement-breakpoint
CREATE INDEX "lobby_registrations_normalized_lobbyist_name_idx" ON "lobby_registrations" USING btree ("normalized_lobbyist_name");--> statement-breakpoint
CREATE INDEX "lobby_registrations_normalized_client_name_idx" ON "lobby_registrations" USING btree ("normalized_client_name");--> statement-breakpoint
CREATE INDEX "lobby_registrations_lobbyist_entity_id_idx" ON "lobby_registrations" USING btree ("lobbyist_entity_id");--> statement-breakpoint
CREATE INDEX "lobby_registrations_client_entity_id_idx" ON "lobby_registrations" USING btree ("client_entity_id");