-- CreateEnum
CREATE TYPE "MotionKind" AS ENUM ('PROPOSAL', 'SECONDING');

-- CreateEnum
CREATE TYPE "MotionStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttendanceRole" AS ENUM ('PARTICIPANT', 'BOARD', 'MODERATOR', 'STAFF');

-- CreateEnum
CREATE TYPE "QuestionKind" AS ENUM ('TEXT', 'AUDIO');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FORWARDED');

-- CreateEnum
CREATE TYPE "ModerationActionKind" AS ENUM ('APPROVE', 'REJECT', 'FORWARD');

-- AlterEnum
ALTER TYPE "FileKind" ADD VALUE 'AUDIO_QUESTION';


























-- AlterTable
ALTER TABLE "agenda_items" ADD COLUMN     "poll_demand_open" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "proposal_open" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seconding_open" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "active_agenda_item_id" UUID,
ADD COLUMN     "video_room_id" VARCHAR(40);

-- CreateTable
CREATE TABLE "motions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "agenda_item_id" UUID NOT NULL,
    "kind" "MotionKind" NOT NULL,
    "participant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "shareholder_id" UUID NOT NULL,
    "acting_as" "ParticipantKind" NOT NULL,
    "status" "MotionStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(3),
    "decided_by_id" UUID,

    CONSTRAINT "motions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_demands" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "agenda_item_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "shareholder_id" UUID NOT NULL,
    "acting_as" "ParticipantKind" NOT NULL,
    "votes" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_demands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_attendance" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "AttendanceRole" NOT NULL,
    "participant_ids" UUID[],
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(3),
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(400),

    CONSTRAINT "meeting_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_questions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "agenda_item_id" UUID,
    "participant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "shareholder_id" UUID NOT NULL,
    "acting_as" "ParticipantKind" NOT NULL,
    "kind" "QuestionKind" NOT NULL,
    "text" VARCHAR(2000),
    "file_id" UUID,
    "duration_seconds" INTEGER,
    "status" "QuestionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meeting_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" "ModerationActionKind" NOT NULL,
    "note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_announcements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retracted_at" TIMESTAMPTZ(3),

    CONSTRAINT "meeting_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "motions_meeting_id_agenda_item_id_idx" ON "motions"("meeting_id", "agenda_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "motions_agenda_item_id_kind_participant_id_key" ON "motions"("agenda_item_id", "kind", "participant_id");

-- CreateIndex
CREATE INDEX "poll_demands_meeting_id_agenda_item_id_idx" ON "poll_demands"("meeting_id", "agenda_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "poll_demands_agenda_item_id_participant_id_key" ON "poll_demands"("agenda_item_id", "participant_id");

-- CreateIndex
CREATE INDEX "meeting_attendance_meeting_id_left_at_idx" ON "meeting_attendance"("meeting_id", "left_at");

-- CreateIndex
CREATE INDEX "meeting_questions_meeting_id_status_created_at_idx" ON "meeting_questions"("meeting_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "moderation_actions_question_id_idx" ON "moderation_actions"("question_id");

-- CreateIndex
CREATE INDEX "meeting_announcements_meeting_id_created_at_idx" ON "meeting_announcements"("meeting_id", "created_at");

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "meeting_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── Hand-written integrity rules (Phase D) ──────────────────────────────

-- Composite targets so child rows cannot point across meetings or companies.
CREATE UNIQUE INDEX "agenda_items_id_meeting_key" ON "agenda_items" ("id", "meeting_id");
CREATE UNIQUE INDEX "meeting_participants_id_meeting_key" ON "meeting_participants" ("id", "meeting_id");
CREATE UNIQUE INDEX "meeting_questions_id_company_key" ON "meeting_questions" ("id", "company_id");

-- The active agenda item must belong to the same meeting.
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_active_agenda_fkey" FOREIGN KEY ("active_agenda_item_id", "id") REFERENCES "agenda_items"("id", "meeting_id") ON DELETE RESTRICT;

ALTER TABLE "motions" ADD CONSTRAINT "motions_meeting_company_fkey" FOREIGN KEY ("meeting_id", "company_id") REFERENCES "meetings"("id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "motions" ADD CONSTRAINT "motions_agenda_meeting_fkey" FOREIGN KEY ("agenda_item_id", "meeting_id") REFERENCES "agenda_items"("id", "meeting_id") ON DELETE RESTRICT;
ALTER TABLE "motions" ADD CONSTRAINT "motions_participant_meeting_fkey" FOREIGN KEY ("participant_id", "meeting_id") REFERENCES "meeting_participants"("id", "meeting_id") ON DELETE RESTRICT;

ALTER TABLE "poll_demands" ADD CONSTRAINT "poll_demands_meeting_company_fkey" FOREIGN KEY ("meeting_id", "company_id") REFERENCES "meetings"("id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "poll_demands" ADD CONSTRAINT "poll_demands_agenda_meeting_fkey" FOREIGN KEY ("agenda_item_id", "meeting_id") REFERENCES "agenda_items"("id", "meeting_id") ON DELETE RESTRICT;
ALTER TABLE "poll_demands" ADD CONSTRAINT "poll_demands_participant_meeting_fkey" FOREIGN KEY ("participant_id", "meeting_id") REFERENCES "meeting_participants"("id", "meeting_id") ON DELETE RESTRICT;

ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_meeting_company_fkey" FOREIGN KEY ("meeting_id", "company_id") REFERENCES "meetings"("id", "company_id") ON DELETE RESTRICT;

ALTER TABLE "meeting_questions" ADD CONSTRAINT "meeting_questions_meeting_company_fkey" FOREIGN KEY ("meeting_id", "company_id") REFERENCES "meetings"("id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "meeting_questions" ADD CONSTRAINT "meeting_questions_agenda_meeting_fkey" FOREIGN KEY ("agenda_item_id", "meeting_id") REFERENCES "agenda_items"("id", "meeting_id") ON DELETE RESTRICT;
ALTER TABLE "meeting_questions" ADD CONSTRAINT "meeting_questions_participant_meeting_fkey" FOREIGN KEY ("participant_id", "meeting_id") REFERENCES "meeting_participants"("id", "meeting_id") ON DELETE RESTRICT;
ALTER TABLE "meeting_questions" ADD CONSTRAINT "meeting_questions_file_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT;
ALTER TABLE "meeting_questions" ADD CONSTRAINT "meeting_questions_shape_check" CHECK (
  ("kind" = 'TEXT' AND "text" IS NOT NULL AND "file_id" IS NULL) OR
  ("kind" = 'AUDIO' AND "file_id" IS NOT NULL AND "duration_seconds" > 0 AND "duration_seconds" <= 180)
);

ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_question_company_fkey" FOREIGN KEY ("question_id", "company_id") REFERENCES "meeting_questions"("id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "meeting_announcements" ADD CONSTRAINT "meeting_announcements_meeting_company_fkey" FOREIGN KEY ("meeting_id", "company_id") REFERENCES "meetings"("id", "company_id") ON DELETE RESTRICT;

-- One accepted proposer and one accepted seconder per agenda item. This index is what
-- makes "first accepted wins" safe under concurrent submissions.
CREATE UNIQUE INDEX "motions_one_accepted" ON "motions" ("agenda_item_id", "kind") WHERE "status" = 'ACCEPTED';

ALTER TABLE "poll_demands" ADD CONSTRAINT "poll_demands_votes_check" CHECK ("votes" >= 0);

-- Append-only records.
CREATE TRIGGER "poll_demands_immutable" BEFORE UPDATE OR DELETE ON "poll_demands" FOR EACH ROW EXECUTE FUNCTION irm_immutable_row();
CREATE TRIGGER "moderation_actions_immutable" BEFORE UPDATE OR DELETE ON "moderation_actions" FOR EACH ROW EXECUTE FUNCTION irm_immutable_row();

CREATE OR REPLACE FUNCTION irm_no_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% rows cannot be deleted', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "motions_no_delete" BEFORE DELETE ON "motions" FOR EACH ROW EXECUTE FUNCTION irm_no_delete();
CREATE TRIGGER "meeting_questions_no_delete" BEFORE DELETE ON "meeting_questions" FOR EACH ROW EXECUTE FUNCTION irm_no_delete();
CREATE TRIGGER "meeting_attendance_no_delete" BEFORE DELETE ON "meeting_attendance" FOR EACH ROW EXECUTE FUNCTION irm_no_delete();

-- ─── Row-level security ──────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO irm_app;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['motions', 'poll_demands', 'meeting_attendance', 'meeting_questions', 'moderation_actions', 'meeting_announcements'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO irm_app USING (company_id = ANY (irm_company_ids())) WITH CHECK (company_id = ANY (irm_company_ids()))',
      t || '_company_isolation', t
    );
  END LOOP;
END $$;
