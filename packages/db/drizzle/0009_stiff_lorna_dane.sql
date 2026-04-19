CREATE TABLE IF NOT EXISTS "press_releases" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"published_date" date NOT NULL,
	"department" text NOT NULL,
	"content_type" text,
	"summary" text,
	"ministers" text[],
	"keywords" text[],
	"subjects" text[],
	"spatial" text,
	"body_text" text,
	"mentioned_entities" jsonb,
	"dollar_amounts" jsonb,
	"source_url" text NOT NULL,
	"source_file_hash" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "press_releases_published_date_idx" ON "press_releases" USING btree ("published_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "press_releases_department_idx" ON "press_releases" USING btree ("department");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "press_releases_content_type_idx" ON "press_releases" USING btree ("content_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "press_releases_url_idx" ON "press_releases" USING btree ("url");--> statement-breakpoint
CREATE INDEX "donations_recipient_name_idx" ON "donations" USING btree ("recipient_name");--> statement-breakpoint
CREATE INDEX "lobby_communications_lobbyist_entity_id_idx" ON "lobby_communications" USING btree ("lobbyist_entity_id");--> statement-breakpoint
CREATE INDEX "lobby_communications_official_entity_id_idx" ON "lobby_communications" USING btree ("official_entity_id");