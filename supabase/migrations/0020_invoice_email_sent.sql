-- Tracks when (and whether) the customer was emailed the invoice with
-- the pay link. NULL means never sent. We set it from
-- /api/invoices/[id]/send so the UI can label the button "Send Invoice"
-- vs "Resend" and show "Last sent {date}" without a separate join.
alter table invoices
  add column if not exists last_emailed_at timestamptz;

comment on column invoices.last_emailed_at is
  'Timestamp of the most recent /api/invoices/[id]/send call. NULL = never sent. Distinct from last_reminder_at, which tracks the overdue-reminder cron.';
