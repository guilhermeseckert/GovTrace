CREATE TABLE "department_expenditures" (
	"id" text PRIMARY KEY NOT NULL,
	"fiscal_year" text NOT NULL,
	"org_id" integer NOT NULL,
	"org_name" text NOT NULL,
	"standard_object" text NOT NULL,
	"expenditures" numeric(15, 2) NOT NULL,
	"source_file_hash" text NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "dept_exp_fy_org_sobj_idx" ON "department_expenditures" USING btree ("fiscal_year","org_id","standard_object");--> statement-breakpoint
CREATE INDEX "dept_exp_fiscal_year_idx" ON "department_expenditures" USING btree ("fiscal_year");--> statement-breakpoint
CREATE INDEX "dept_exp_org_name_idx" ON "department_expenditures" USING btree ("org_name");