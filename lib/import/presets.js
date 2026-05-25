// Format presets for known field-service platforms. Each preset maps
// our target fields (the columns we store) to the source columns
// that platform's CSV export uses. Multiple aliases per target —
// platforms shift their export headers over time, and contractors
// often add columns or rename them.
//
// detect(headers) returns the preset whose required columns are all
// present (case-insensitive match), so the import page can pre-fill
// the mapping UI without making the contractor pick from a list.

const NORMALIZE = (s) => String(s || '').trim().toLowerCase().replace(/[\s_\-]+/g, ' ');

// Target schemas — the union of fields we accept for each entity.
// 'required' fields block the import if not mapped.
export const TARGET_SCHEMAS = {
  customers: [
    { key: 'name',    label: 'Name',    required: true },
    { key: 'email',   label: 'Email' },
    { key: 'phone',   label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'notes',   label: 'Notes' },
  ],
  jobs: [
    { key: 'title',          label: 'Title',         required: true },
    { key: 'customer_name',  label: 'Customer name', required: true },
    { key: 'status',         label: 'Status' },
    { key: 'scheduled_date', label: 'Scheduled date' },
    { key: 'price',          label: 'Price' },
    { key: 'description',    label: 'Description' },
  ],
  invoices: [
    { key: 'amount',         label: 'Amount',        required: true },
    { key: 'customer_name',  label: 'Customer name', required: true },
    { key: 'status',         label: 'Status' },
    { key: 'issued_date',    label: 'Issued date' },
    { key: 'paid_date',      label: 'Paid date' },
    { key: 'notes',          label: 'Notes' },
  ],
};

// Aliases are lists of header strings (case-insensitive, normalized).
// First match wins.
const JOBBER = {
  id: 'jobber',
  label: 'Jobber',
  customers: {
    name:    ['name', 'client name', 'company name', 'first name'],
    email:   ['email', 'client email'],
    phone:   ['phone', 'mobile phone', 'home phone', 'work phone'],
    address: ['address line 1', 'street 1', 'street address'],
    notes:   ['notes', 'client notes'],
  },
  jobs: {
    title:          ['title', 'job title', 'description'],
    customer_name:  ['client name', 'client', 'customer'],
    status:         ['status', 'job status'],
    scheduled_date: ['start date', 'scheduled date', 'visit date'],
    price:          ['total', 'job total'],
    description:    ['description', 'work description', 'notes'],
  },
  invoices: {
    amount:         ['amount', 'total', 'invoice total'],
    customer_name:  ['client name', 'client', 'bill to'],
    status:         ['status', 'invoice status'],
    issued_date:    ['issued date', 'date issued', 'invoice date'],
    paid_date:      ['paid date', 'date paid'],
    notes:          ['notes', 'memo', 'description'],
  },
};

const HOUSECALL = {
  id: 'housecall',
  label: 'Housecall Pro',
  customers: {
    name:    ['customer name', 'name', 'first name'],
    email:   ['email', 'customer email'],
    phone:   ['phone number', 'phone', 'mobile', 'mobile phone'],
    address: ['street address', 'service address', 'billing address'],
    notes:   ['notes', 'customer notes'],
  },
  jobs: {
    title:          ['job name', 'job title', 'service'],
    customer_name:  ['customer name', 'customer'],
    status:         ['job status', 'status'],
    scheduled_date: ['scheduled date', 'service date'],
    price:          ['total', 'price', 'job total'],
    description:    ['description', 'job description', 'notes'],
  },
  invoices: {
    amount:         ['total', 'amount', 'invoice total'],
    customer_name:  ['customer name', 'customer'],
    status:         ['status', 'payment status'],
    issued_date:    ['invoice date', 'date'],
    paid_date:      ['paid date', 'date paid'],
    notes:          ['notes', 'description'],
  },
};

const QUICKBOOKS = {
  id: 'quickbooks',
  label: 'QuickBooks',
  customers: {
    name:    ['customer', 'customer display name', 'display name', 'name'],
    email:   ['email', 'main email', 'email address'],
    phone:   ['phone', 'main phone', 'phone number'],
    address: ['billing address', 'bill to address', 'shipping address'],
    notes:   ['notes', 'memo'],
  },
  jobs: {
    title:          ['memo', 'description', 'service'],
    customer_name:  ['customer'],
    status:         ['status'],
    scheduled_date: ['service date', 'date'],
    price:          ['amount', 'total'],
    description:    ['memo', 'description'],
  },
  invoices: {
    amount:         ['amount', 'total', 'balance'],
    customer_name:  ['customer'],
    status:         ['status', 'balance'],
    issued_date:    ['date', 'transaction date'],
    paid_date:      ['paid date'],
    notes:          ['memo', 'description'],
  },
};

export const PRESETS = [JOBBER, HOUSECALL, QUICKBOOKS];

// Best-effort format detection. Returns the preset id whose customer
// header aliases best match the file's headers, or 'generic' when
// nothing matches strongly. We use the customer aliases as the
// fingerprint because customers is the most common starting export.
export function detectFormat(headers, entity = 'customers') {
  const norm = headers.map(NORMALIZE);
  let best = { id: 'generic', score: 0 };
  for (const preset of PRESETS) {
    const aliases = preset[entity] || preset.customers;
    let score = 0;
    for (const fieldAliases of Object.values(aliases)) {
      for (const a of fieldAliases) {
        if (norm.includes(NORMALIZE(a))) { score += 1; break; }
      }
    }
    if (score > best.score) best = { id: preset.id, score, preset };
  }
  return best.score >= 2 ? best : { id: 'generic', score: 0 };
}

// Build a default mapping object for a given preset + entity by
// matching the preset's aliases to the actual file headers. Returns
// { targetField: sourceHeader | null } so callers can render a
// pre-filled mapping form.
export function buildDefaultMapping(presetId, entity, headers) {
  const schema = TARGET_SCHEMAS[entity];
  const preset = PRESETS.find(p => p.id === presetId);
  const aliases = preset ? (preset[entity] || {}) : {};
  const norm = headers.map(h => ({ raw: h, norm: NORMALIZE(h) }));
  const out = {};
  for (const field of schema) {
    const list = aliases[field.key] || [];
    let match = null;
    for (const a of list) {
      const m = norm.find(h => h.norm === NORMALIZE(a));
      if (m) { match = m.raw; break; }
    }
    // Last-resort: target key as a literal header
    if (!match) {
      const m = norm.find(h => h.norm === NORMALIZE(field.key) || h.norm === NORMALIZE(field.label));
      if (m) match = m.raw;
    }
    out[field.key] = match || '';
  }
  return out;
}
