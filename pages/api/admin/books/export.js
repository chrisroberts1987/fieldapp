import { verifyAdmin } from '../../../../lib/adminAuth';

// CSV export for the admin Books feature. Drop-in friendly for any
// CPA: standard column order, ISO dates, plain UTF-8.
//
// GET /api/admin/books/export?type=expenses&year=2026
// GET /api/admin/books/export?type=tax-payments&year=2026
// GET /api/admin/books/export?type=1099-summary&year=2026
//
// Returns a text/csv response with a Content-Disposition that suggests
// a sensible filename for the browser's download dialog.

const TYPES = new Set(['expenses', 'tax-payments', '1099-summary']);

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const { sb } = ctx;

  const type = String(req.query.type || 'expenses');
  if (!TYPES.has(type)) return res.status(400).json({ error: `type must be one of: ${[...TYPES].join(', ')}` });
  const year = Number(req.query.year) || new Date().getUTCFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year}-12-31`;

  let csv, filename;

  if (type === 'expenses') {
    const { data } = await sb.from('platform_expenses')
      .select('occurred_on, category, vendor, amount, source, notes, receipt_url')
      .gte('occurred_on', yearStart).lte('occurred_on', yearEnd)
      .order('occurred_on');
    csv = toCsv(
      ['Date','Category','Vendor','Amount','Source','Notes','Receipt URL'],
      (data || []).map(r => [r.occurred_on, r.category, r.vendor || '', r.amount, r.source, r.notes || '', r.receipt_url || ''])
    );
    filename = `myforeman-expenses-${year}.csv`;
  } else if (type === 'tax-payments') {
    const { data } = await sb.from('platform_tax_payments')
      .select('paid_on, tax_type, period, amount, notes')
      .gte('paid_on', yearStart).lte('paid_on', yearEnd)
      .order('paid_on');
    csv = toCsv(
      ['Paid','Type','Period','Amount','Notes'],
      (data || []).map(r => [r.paid_on, r.tax_type, r.period, r.amount, r.notes || ''])
    );
    filename = `myforeman-tax-payments-${year}.csv`;
  } else {
    // 1099 summary: one row per vendor with totals + flag if ≥ $600
    const [{ data: vendors }, { data: expenseRows }] = await Promise.all([
      sb.from('vendors_1099').select('id, name, business_name, email, tax_id, address').order('name'),
      sb.from('platform_expenses').select('vendor_1099_id, amount')
        .gte('occurred_on', yearStart).lte('occurred_on', yearEnd)
        .not('vendor_1099_id', 'is', null),
    ]);
    const totals = {};
    for (const r of expenseRows || []) {
      totals[r.vendor_1099_id] = (totals[r.vendor_1099_id] || 0) + Number(r.amount || 0);
    }
    csv = toCsv(
      ['Name','Business Name','Email','Tax ID','Address','Total Paid','Requires 1099-NEC'],
      (vendors || []).map(v => {
        const tot = totals[v.id] || 0;
        return [v.name, v.business_name || '', v.email || '', v.tax_id || '', v.address || '',
                tot.toFixed(2), tot >= 600 ? 'YES' : 'no'];
      })
    );
    filename = `myforeman-1099-summary-${year}.csv`;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
}

// Minimal CSV serializer. Quotes any field containing a comma, quote,
// or newline; doubles embedded quotes per RFC 4180. UTF-8 BOM at the
// start keeps Excel from mangling accented characters.
function toCsv(headers, rows) {
  const lines = [headers, ...rows].map(line =>
    line.map(field => {
      const s = String(field ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  );
  return '﻿' + lines.join('\r\n') + '\r\n';
}
