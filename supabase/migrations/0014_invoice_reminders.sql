-- Track which automated overdue reminders have fired for each invoice.
-- One timestamp per stage (7d, 14d, 30d) so the audit trail shows
-- exactly when each nudge went out. The cron at /api/cron/overdue-reminders
-- queries WHERE status='unpaid' AND issued_date <= today - N days AND
-- reminder_Nd_sent_at IS NULL, picks the most-overdue eligible stage,
-- fires the email, and marks all earlier stages "sent" with the same
-- timestamp so an invoice that's been overdue 31 days doesn't get all
-- three reminders in one run.

alter table public.invoices
  add column if not exists reminder_7d_sent_at  timestamptz,
  add column if not exists reminder_14d_sent_at timestamptz,
  add column if not exists reminder_30d_sent_at timestamptz;

create index if not exists invoices_overdue_scan_idx
  on public.invoices (status, issued_date)
  where status = 'unpaid';
