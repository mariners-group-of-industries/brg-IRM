-- CreateEnum
CREATE TYPE "VotingMethod" AS ENUM ('SHARE_WEIGHTED', 'ONE_MEMBER_ONE_VOTE');

-- CreateEnum
CREATE TYPE "BallotChoice" AS ENUM ('FOR', 'AGAINST', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "VoteAuditEventType" AS ENUM ('SESSION_OPENED', 'BALLOT_CAST', 'BALLOT_SUPERSEDED', 'VOTE_REJECTED', 'SESSION_CLOSED', 'RESULTS_RELEASED');

-- CreateEnum
CREATE TYPE "PrivilegedGrantStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

-- CreateTable
CREATE TABLE "voting_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "agenda_item_id" UUID NOT NULL,
    "session_number" INTEGER NOT NULL DEFAULT 1,
    "method" "VotingMethod" NOT NULL,
    "choices" "BallotChoice"[],
    "abstain_counts_in_base" BOOLEAN NOT NULL,
    "allow_change" BOOLEAN NOT NULL,
    "majority_numerator" INTEGER NOT NULL,
    "majority_denominator" INTEGER NOT NULL,
    "opened_by_id" UUID NOT NULL,
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closes_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "closed_by_id" UUID,
    "reopen_reason" VARCHAR(500),

    CONSTRAINT "voting_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ballots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "voting_session_id" UUID NOT NULL,
    "entitlement_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "casting_user_id" UUID NOT NULL,
    "shareholder_id" UUID NOT NULL,
    "acting_as" "ParticipantKind" NOT NULL,
    "method" "VotingMethod" NOT NULL,
    "choice" "BallotChoice" NOT NULL,
    "weight" BIGINT NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "cast_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMPTZ(3),

    CONSTRAINT "ballots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote_idempotency_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "voting_session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote_audit_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "voting_session_id" UUID NOT NULL,
    "sequence_no" INTEGER NOT NULL,
    "event_type" "VoteAuditEventType" NOT NULL,
    "actor_user_id" UUID,
    "entitlement_id" UUID,
    "ballot_id" UUID,
    "reason" VARCHAR(500),
    "prev_hash" VARCHAR(64) NOT NULL,
    "hash" VARCHAR(64) NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voting_results" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "voting_session_id" UUID NOT NULL,
    "resolution_kind" "ResolutionKind" NOT NULL,
    "for_votes" BIGINT NOT NULL,
    "against_votes" BIGINT NOT NULL,
    "abstain_votes" BIGINT NOT NULL,
    "for_count" INTEGER NOT NULL,
    "against_count" INTEGER NOT NULL,
    "abstain_count" INTEGER NOT NULL,
    "ballot_count" INTEGER NOT NULL,
    "base_votes" BIGINT NOT NULL,
    "eligible_votes" BIGINT NOT NULL,
    "abstain_counts_in_base" BOOLEAN NOT NULL,
    "majority_numerator" INTEGER NOT NULL,
    "majority_denominator" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "seal_audit_seq" INTEGER NOT NULL,
    "seal_audit_hash" VARCHAR(64) NOT NULL,
    "input_hash" VARCHAR(64) NOT NULL,
    "sealed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ(3),
    "released_by_id" UUID,

    CONSTRAINT "voting_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privileged_access_grants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "permission" VARCHAR(80) NOT NULL DEFAULT 'ballot.individual.read',
    "grantee_user_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "status" "PrivilegedGrantStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "decision_note" VARCHAR(500),
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_by_id" UUID,
    "revoke_note" VARCHAR(500),

    CONSTRAINT "privileged_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voting_sessions_meeting_id_opened_at_idx" ON "voting_sessions"("meeting_id", "opened_at");

-- CreateIndex
CREATE UNIQUE INDEX "voting_sessions_agenda_item_id_session_number_key" ON "voting_sessions"("agenda_item_id", "session_number");

-- CreateIndex
CREATE INDEX "ballots_voting_session_id_superseded_at_idx" ON "ballots"("voting_session_id", "superseded_at");

-- CreateIndex
CREATE INDEX "ballots_voting_session_id_casting_user_id_idx" ON "ballots"("voting_session_id", "casting_user_id");

-- CreateIndex
CREATE INDEX "ballots_voting_session_id_shareholder_id_idx" ON "ballots"("voting_session_id", "shareholder_id");

-- CreateIndex
CREATE UNIQUE INDEX "vote_idempotency_records_voting_session_id_user_id_idempote_key" ON "vote_idempotency_records"("voting_session_id", "user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "vote_audit_events_voting_session_id_occurred_at_idx" ON "vote_audit_events"("voting_session_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "vote_audit_events_voting_session_id_sequence_no_key" ON "vote_audit_events"("voting_session_id", "sequence_no");

-- CreateIndex
CREATE UNIQUE INDEX "vote_audit_events_voting_session_id_hash_key" ON "vote_audit_events"("voting_session_id", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "voting_results_voting_session_id_key" ON "voting_results"("voting_session_id");

-- CreateIndex
CREATE INDEX "voting_results_meeting_id_sealed_at_idx" ON "voting_results"("meeting_id", "sealed_at");

-- CreateIndex
CREATE INDEX "privileged_access_grants_company_id_meeting_id_grantee_user_idx" ON "privileged_access_grants"("company_id", "meeting_id", "grantee_user_id", "status");

-- AddForeignKey
ALTER TABLE "voting_sessions" ADD CONSTRAINT "voting_sessions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voting_sessions" ADD CONSTRAINT "voting_sessions_agenda_item_id_fkey" FOREIGN KEY ("agenda_item_id") REFERENCES "agenda_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_voting_session_id_fkey" FOREIGN KEY ("voting_session_id") REFERENCES "voting_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "voting_entitlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "meeting_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_idempotency_records" ADD CONSTRAINT "vote_idempotency_records_voting_session_id_fkey" FOREIGN KEY ("voting_session_id") REFERENCES "voting_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_audit_events" ADD CONSTRAINT "vote_audit_events_voting_session_id_fkey" FOREIGN KEY ("voting_session_id") REFERENCES "voting_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voting_results" ADD CONSTRAINT "voting_results_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voting_results" ADD CONSTRAINT "voting_results_voting_session_id_fkey" FOREIGN KEY ("voting_session_id") REFERENCES "voting_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privileged_access_grants" ADD CONSTRAINT "privileged_access_grants_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── Hand-written integrity rules (Phase E) ──────────────────────────────

-- Composite unique targets so child rows cannot cross companies or meetings.
CREATE UNIQUE INDEX "voting_entitlements_id_meeting_key" ON "voting_entitlements" ("id", "meeting_id");
CREATE UNIQUE INDEX "voting_sessions_id_meeting_key" ON "voting_sessions" ("id", "meeting_id");
CREATE UNIQUE INDEX "voting_sessions_id_company_key" ON "voting_sessions" ("id", "company_id");

-- Cross-company and cross-meeting foreign keys.
ALTER TABLE "voting_sessions" ADD CONSTRAINT "voting_sessions_company_tenant_fkey" FOREIGN KEY ("company_id", "tenant_id") REFERENCES "companies"("id", "tenant_id") ON DELETE RESTRICT;
ALTER TABLE "voting_sessions" ADD CONSTRAINT "voting_sessions_meeting_company_fkey" FOREIGN KEY ("meeting_id", "company_id") REFERENCES "meetings"("id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "voting_sessions" ADD CONSTRAINT "voting_sessions_agenda_meeting_fkey" FOREIGN KEY ("agenda_item_id", "meeting_id") REFERENCES "agenda_items"("id", "meeting_id") ON DELETE RESTRICT;

ALTER TABLE "ballots" ADD CONSTRAINT "ballots_company_tenant_fkey" FOREIGN KEY ("company_id", "tenant_id") REFERENCES "companies"("id", "tenant_id") ON DELETE RESTRICT;
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_meeting_company_fkey" FOREIGN KEY ("meeting_id", "company_id") REFERENCES "meetings"("id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_session_meeting_fkey" FOREIGN KEY ("voting_session_id", "meeting_id") REFERENCES "voting_sessions"("id", "meeting_id") ON DELETE RESTRICT;
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_session_company_fkey" FOREIGN KEY ("voting_session_id", "company_id") REFERENCES "voting_sessions"("id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_entitlement_meeting_fkey" FOREIGN KEY ("entitlement_id", "meeting_id") REFERENCES "voting_entitlements"("id", "meeting_id") ON DELETE RESTRICT;
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_participant_meeting_fkey" FOREIGN KEY ("participant_id", "meeting_id") REFERENCES "meeting_participants"("id", "meeting_id") ON DELETE RESTRICT;

ALTER TABLE "vote_idempotency_records" ADD CONSTRAINT "vote_idempotency_company_tenant_fkey" FOREIGN KEY ("company_id", "tenant_id") REFERENCES "companies"("id", "tenant_id") ON DELETE RESTRICT;
ALTER TABLE "vote_idempotency_records" ADD CONSTRAINT "vote_idempotency_meeting_company_fkey" FOREIGN KEY ("meeting_id", "company_id") REFERENCES "meetings"("id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "vote_idempotency_records" ADD CONSTRAINT "vote_idempotency_session_meeting_fkey" FOREIGN KEY ("voting_session_id", "meeting_id") REFERENCES "voting_sessions"("id", "meeting_id") ON DELETE RESTRICT;

ALTER TABLE "vote_audit_events" ADD CONSTRAINT "vote_audit_events_company_tenant_fkey" FOREIGN KEY ("company_id", "tenant_id") REFERENCES "companies"("id", "tenant_id") ON DELETE RESTRICT;
ALTER TABLE "vote_audit_events" ADD CONSTRAINT "vote_audit_events_meeting_company_fkey" FOREIGN KEY ("meeting_id", "company_id") REFERENCES "meetings"("id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "vote_audit_events" ADD CONSTRAINT "vote_audit_events_session_meeting_fkey" FOREIGN KEY ("voting_session_id", "meeting_id") REFERENCES "voting_sessions"("id", "meeting_id") ON DELETE RESTRICT;

ALTER TABLE "voting_results" ADD CONSTRAINT "voting_results_company_tenant_fkey" FOREIGN KEY ("company_id", "tenant_id") REFERENCES "companies"("id", "tenant_id") ON DELETE RESTRICT;
ALTER TABLE "voting_results" ADD CONSTRAINT "voting_results_meeting_company_fkey" FOREIGN KEY ("meeting_id", "company_id") REFERENCES "meetings"("id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "voting_results" ADD CONSTRAINT "voting_results_session_meeting_fkey" FOREIGN KEY ("voting_session_id", "meeting_id") REFERENCES "voting_sessions"("id", "meeting_id") ON DELETE RESTRICT;

ALTER TABLE "privileged_access_grants" ADD CONSTRAINT "privileged_grants_company_tenant_fkey" FOREIGN KEY ("company_id", "tenant_id") REFERENCES "companies"("id", "tenant_id") ON DELETE RESTRICT;
ALTER TABLE "privileged_access_grants" ADD CONSTRAINT "privileged_grants_meeting_company_fkey" FOREIGN KEY ("meeting_id", "company_id") REFERENCES "meetings"("id", "company_id") ON DELETE RESTRICT;

-- Partial unique indexes enforcing single open session and single effective ballot invariants.
CREATE UNIQUE INDEX "voting_sessions_one_open_per_agenda" ON "voting_sessions" ("agenda_item_id") WHERE "closed_at" IS NULL;
CREATE UNIQUE INDEX "ballots_one_effective_per_entitlement" ON "ballots" ("voting_session_id", "entitlement_id") WHERE "superseded_at" IS NULL;
CREATE UNIQUE INDEX "ballots_one_effective_per_shareholder_omov" ON "ballots" ("voting_session_id", "shareholder_id") WHERE "superseded_at" IS NULL AND "method" = 'ONE_MEMBER_ONE_VOTE';
CREATE UNIQUE INDEX "ballots_idempotency_per_entitlement" ON "ballots" ("voting_session_id", "entitlement_id", "idempotency_key");

-- Domain value & four-eyes CHECK constraints.
ALTER TABLE "voting_sessions" ADD CONSTRAINT "voting_sessions_checks" CHECK (
  "session_number" >= 1
  AND cardinality("choices") >= 2
  AND "majority_numerator" >= 1
  AND "majority_denominator" >= "majority_numerator"
);
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_weight_check" CHECK ("weight" > 0);
ALTER TABLE "vote_audit_events" ADD CONSTRAINT "vote_audit_events_seq_check" CHECK ("sequence_no" >= 1);
ALTER TABLE "voting_results" ADD CONSTRAINT "voting_results_counts_check" CHECK (
  "for_votes" >= 0
  AND "against_votes" >= 0
  AND "abstain_votes" >= 0
  AND "base_votes" >= 0
  AND "eligible_votes" >= 0
  AND "for_count" >= 0
  AND "against_count" >= 0
  AND "abstain_count" >= 0
  AND "ballot_count" = "for_count" + "against_count" + "abstain_count"
  AND "seal_audit_seq" >= 1
);
ALTER TABLE "privileged_access_grants" ADD CONSTRAINT "privileged_access_grants_checks" CHECK (
  "duration_minutes" BETWEEN 5 AND 480
  AND "permission" = 'ballot.individual.read'
  AND ("decided_by_id" IS NULL OR ("decided_by_id" <> "requested_by_id" AND "decided_by_id" <> "grantee_user_id"))
);

-- Cryptographic / legal immutability triggers.
CREATE OR REPLACE FUNCTION irm_ballot_supersede_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ballots cannot be deleted' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.superseded_at IS NOT NULL OR NEW.superseded_at IS NULL THEN
    RAISE EXCEPTION 'ballots can only transition superseded_at from NULL to NOT NULL' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.company_id IS DISTINCT FROM OLD.company_id
    OR NEW.meeting_id IS DISTINCT FROM OLD.meeting_id
    OR NEW.voting_session_id IS DISTINCT FROM OLD.voting_session_id
    OR NEW.entitlement_id IS DISTINCT FROM OLD.entitlement_id
    OR NEW.participant_id IS DISTINCT FROM OLD.participant_id
    OR NEW.casting_user_id IS DISTINCT FROM OLD.casting_user_id
    OR NEW.shareholder_id IS DISTINCT FROM OLD.shareholder_id
    OR NEW.acting_as IS DISTINCT FROM OLD.acting_as
    OR NEW.method IS DISTINCT FROM OLD.method
    OR NEW.choice IS DISTINCT FROM OLD.choice
    OR NEW.weight IS DISTINCT FROM OLD.weight
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    OR NEW.cast_at IS DISTINCT FROM OLD.cast_at THEN
    RAISE EXCEPTION 'ballots columns other than superseded_at are immutable' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ballots_supersede_only" BEFORE UPDATE OR DELETE ON "ballots" FOR EACH ROW EXECUTE FUNCTION irm_ballot_supersede_only();

CREATE OR REPLACE FUNCTION irm_voting_session_seal_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'voting_sessions cannot be deleted' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'closed voting_sessions cannot be modified or reopened' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.closed_at IS NULL THEN
    RAISE EXCEPTION 'open voting_sessions can only be updated when closing' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.company_id IS DISTINCT FROM OLD.company_id
    OR NEW.meeting_id IS DISTINCT FROM OLD.meeting_id
    OR NEW.agenda_item_id IS DISTINCT FROM OLD.agenda_item_id
    OR NEW.session_number IS DISTINCT FROM OLD.session_number
    OR NEW.method IS DISTINCT FROM OLD.method
    OR NEW.choices IS DISTINCT FROM OLD.choices
    OR NEW.abstain_counts_in_base IS DISTINCT FROM OLD.abstain_counts_in_base
    OR NEW.allow_change IS DISTINCT FROM OLD.allow_change
    OR NEW.majority_numerator IS DISTINCT FROM OLD.majority_numerator
    OR NEW.majority_denominator IS DISTINCT FROM OLD.majority_denominator
    OR NEW.opened_by_id IS DISTINCT FROM OLD.opened_by_id
    OR NEW.opened_at IS DISTINCT FROM OLD.opened_at
    OR NEW.closes_at IS DISTINCT FROM OLD.closes_at
    OR NEW.reopen_reason IS DISTINCT FROM OLD.reopen_reason THEN
    RAISE EXCEPTION 'voting_sessions configuration is immutable once opened' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "voting_sessions_seal_only" BEFORE UPDATE OR DELETE ON "voting_sessions" FOR EACH ROW EXECUTE FUNCTION irm_voting_session_seal_only();

CREATE OR REPLACE FUNCTION irm_voting_result_release_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'voting_results cannot be deleted' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.released_at IS NOT NULL OR NEW.released_at IS NULL OR NEW.released_by_id IS NULL THEN
    RAISE EXCEPTION 'voting_results can only transition released_at from NULL to NOT NULL once' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.company_id IS DISTINCT FROM OLD.company_id
    OR NEW.meeting_id IS DISTINCT FROM OLD.meeting_id
    OR NEW.voting_session_id IS DISTINCT FROM OLD.voting_session_id
    OR NEW.resolution_kind IS DISTINCT FROM OLD.resolution_kind
    OR NEW.for_votes IS DISTINCT FROM OLD.for_votes
    OR NEW.against_votes IS DISTINCT FROM OLD.against_votes
    OR NEW.abstain_votes IS DISTINCT FROM OLD.abstain_votes
    OR NEW.for_count IS DISTINCT FROM OLD.for_count
    OR NEW.against_count IS DISTINCT FROM OLD.against_count
    OR NEW.abstain_count IS DISTINCT FROM OLD.abstain_count
    OR NEW.ballot_count IS DISTINCT FROM OLD.ballot_count
    OR NEW.base_votes IS DISTINCT FROM OLD.base_votes
    OR NEW.eligible_votes IS DISTINCT FROM OLD.eligible_votes
    OR NEW.abstain_counts_in_base IS DISTINCT FROM OLD.abstain_counts_in_base
    OR NEW.majority_numerator IS DISTINCT FROM OLD.majority_numerator
    OR NEW.majority_denominator IS DISTINCT FROM OLD.majority_denominator
    OR NEW.passed IS DISTINCT FROM OLD.passed
    OR NEW.seal_audit_seq IS DISTINCT FROM OLD.seal_audit_seq
    OR NEW.seal_audit_hash IS DISTINCT FROM OLD.seal_audit_hash
    OR NEW.input_hash IS DISTINCT FROM OLD.input_hash
    OR NEW.sealed_at IS DISTINCT FROM OLD.sealed_at THEN
    RAISE EXCEPTION 'voting_results tally columns are immutable' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "voting_results_release_only" BEFORE UPDATE OR DELETE ON "voting_results" FOR EACH ROW EXECUTE FUNCTION irm_voting_result_release_only();

CREATE TRIGGER "vote_audit_events_immutable" BEFORE UPDATE OR DELETE ON "vote_audit_events" FOR EACH ROW EXECUTE FUNCTION irm_immutable_row();
CREATE TRIGGER "vote_idempotency_records_immutable" BEFORE UPDATE OR DELETE ON "vote_idempotency_records" FOR EACH ROW EXECUTE FUNCTION irm_immutable_row();
CREATE TRIGGER "privileged_access_grants_no_delete" BEFORE DELETE ON "privileged_access_grants" FOR EACH ROW EXECUTE FUNCTION irm_no_delete();

-- ─── Row-level security ──────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO irm_app;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['voting_sessions', 'ballots', 'vote_idempotency_records', 'vote_audit_events', 'voting_results', 'privileged_access_grants'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO irm_app USING (company_id = ANY (irm_company_ids())) WITH CHECK (company_id = ANY (irm_company_ids()))',
      t || '_company_isolation', t
    );
  END LOOP;
END $$;

