CREATE TABLE "senator_profiles" (
	"senator_id" integer PRIMARY KEY NOT NULL,
	"entity_id" uuid,
	"canonical_first_name" text NOT NULL,
	"canonical_last_name" text NOT NULL,
	"normalized_name" text,
	"province" text,
	"group_affiliation" text,
	"match_method" text,
	"match_confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parliament_vote_ballots" ADD COLUMN "chamber" text DEFAULT 'house' NOT NULL;--> statement-breakpoint
ALTER TABLE "parliament_vote_ballots" ADD COLUMN "is_abstention" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "parliament_votes" ADD COLUMN "chamber" text DEFAULT 'house' NOT NULL;--> statement-breakpoint
ALTER TABLE "parliament_votes" ADD COLUMN "abstentions_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "senator_profiles_entity_id_idx" ON "senator_profiles" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "senator_profiles_normalized_name_idx" ON "senator_profiles" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "parliament_vote_ballots_chamber_idx" ON "parliament_vote_ballots" USING btree ("chamber");--> statement-breakpoint
CREATE INDEX "parliament_votes_chamber_idx" ON "parliament_votes" USING btree ("chamber");