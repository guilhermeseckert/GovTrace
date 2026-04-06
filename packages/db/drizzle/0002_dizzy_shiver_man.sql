ALTER TABLE "international_aid" ADD COLUMN "sector_code" text;--> statement-breakpoint
CREATE INDEX "international_aid_sector_code_idx" ON "international_aid" USING btree ("sector_code");