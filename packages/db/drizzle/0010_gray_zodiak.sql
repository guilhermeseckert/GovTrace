CREATE TABLE IF NOT EXISTS "mp_tenures" (
	"person_id" integer NOT NULL,
	"parliament_number" integer NOT NULL,
	"party_short_name" text,
	"riding_name" text,
	"riding_province" text,
	"start_date" date,
	"end_date" date,
	"is_current" boolean DEFAULT false NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mp_profiles" ADD COLUMN IF NOT EXISTS "parliaments_served" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mp_profiles" ADD COLUMN IF NOT EXISTS "first_elected_date" date;--> statement-breakpoint
ALTER TABLE "mp_profiles" ADD COLUMN IF NOT EXISTS "last_service_end_date" date;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "mp_tenures" ADD CONSTRAINT "mp_tenures_person_id_mp_profiles_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."mp_profiles"("person_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mp_tenures_person_parliament_idx" ON "mp_tenures" USING btree ("person_id","parliament_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mp_tenures_parliament_idx" ON "mp_tenures" USING btree ("parliament_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mp_tenures_party_idx" ON "mp_tenures" USING btree ("party_short_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mp_tenures_is_current_idx" ON "mp_tenures" USING btree ("is_current");
