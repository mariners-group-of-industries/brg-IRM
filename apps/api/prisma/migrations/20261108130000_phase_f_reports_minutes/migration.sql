-- CreateEnum
CREATE TYPE "MeetingMinutesStatus" AS ENUM ('DRAFT', 'FINAL', 'PUBLISHED');

-- CreateTable
CREATE TABLE "meeting_minutes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "status" "MeetingMinutesStatus" NOT NULL DEFAULT 'DRAFT',
    "signed_by" VARCHAR(200),
    "finalized_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meeting_minutes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_minutes_meeting_id_key" ON "meeting_minutes"("meeting_id");

-- CreateIndex
CREATE INDEX "meeting_minutes_company_id_meeting_id_idx" ON "meeting_minutes"("company_id", "meeting_id");

-- AddForeignKey
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-crafted integrity constraints and RLS
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_company_fkey" FOREIGN KEY ("company_id", "tenant_id") REFERENCES "companies"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-level security
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO irm_app;

ALTER TABLE "meeting_minutes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meeting_minutes_company_isolation" ON "meeting_minutes" FOR ALL TO irm_app USING (company_id = ANY (irm_company_ids())) WITH CHECK (company_id = ANY (irm_company_ids()));
