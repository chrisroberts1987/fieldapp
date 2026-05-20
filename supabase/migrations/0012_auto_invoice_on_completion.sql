-- A completed job ALWAYS has an invoice. Enforce this at the database
-- level so it holds regardless of which client path (job edit sheet,
-- crew completion screen, future mobile shortcut, a server-side script)
-- moves the job into the completed state.
--
-- The client-side auto-create that previously lived in pages/jobs/index.js
-- is removed; the trigger here replaces it.

create or replace function public.auto_invoice_on_job_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_invoice_id uuid;
  acting_user uuid;
begin
  if NEW.status <> 'completed' then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and OLD.status = 'completed' then
    return NEW;
  end if;

  select id into existing_invoice_id
  from public.invoices
  where job_id = NEW.id
  limit 1;
  if existing_invoice_id is not null then
    return NEW;
  end if;

  acting_user := coalesce(auth.uid(), NEW.owner_id);

  insert into public.invoices (
    org_id, owner_id, job_id, customer_id, amount, status, issued_date, notes
  ) values (
    NEW.org_id,
    coalesce(acting_user, NEW.owner_id),
    NEW.id,
    NEW.customer_id,
    coalesce(NEW.price, 0),
    'unpaid',
    current_date,
    NEW.description
  );

  if acting_user is not null then
    insert into public.notifications (org_id, user_id, kind, title, body, link)
    values (
      NEW.org_id,
      acting_user,
      'job_completed',
      'Job completed → invoice created',
      '"' || NEW.title || '" is marked complete. Invoice drafted for $' || to_char(coalesce(NEW.price, 0), 'FM999,999,990.00') || '.',
      '/invoices'
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_auto_invoice_on_job_completion on public.jobs;
create trigger trg_auto_invoice_on_job_completion
  after insert or update of status on public.jobs
  for each row
  execute function public.auto_invoice_on_job_completion();

-- ============================================================
-- One-time backfill: existing completed jobs without invoices.
-- Inserts a draft unpaid invoice using whatever the job's price is.
-- No notification (we don't want to spam the bell with historical noise).
-- ============================================================
insert into public.invoices (org_id, owner_id, job_id, customer_id, amount, status, issued_date, notes)
select
  j.org_id,
  j.owner_id,
  j.id,
  j.customer_id,
  coalesce(j.price, 0),
  'unpaid',
  current_date,
  j.description
from public.jobs j
left join public.invoices i on i.job_id = j.id
where j.status = 'completed' and i.id is null;
