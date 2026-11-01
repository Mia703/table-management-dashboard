-- Attendee self-registration and payment links (2026-11-01). Additive only; safe to re-run.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "payment_url" text;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "event_id" uuid REFERENCES "events"("id") ON DELETE CASCADE;
ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "user_id" text REFERENCES "user"("id") ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS "attendee_events" (
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  PRIMARY KEY ("event_id", "user_id")
);
