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
//
// For non-customer entities, customer_name is "required" in spirit
// but the importer auto-creates a placeholder customer if the name
// doesn't match — so the import doesn't get stuck.
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
  quotes: [
    { key: 'title',          label: 'Title',         required: true },
    { key: 'customer_name',  label: 'Customer name', required: true },
    { key: 'amount',         label: 'Amount',        required: true },
    { key: 'status',         label: 'Status' },
    { key: 'sent_date',      label: 'Sent date' },
    { key: 'description',    label: 'Description' },
  ],
  expenses: [
    { key: 'amount',         label: 'Amount',        required: true },
    { key: 'category',       label: 'Category' },
    { key: 'expense_date',   label: 'Date' },
    { key: 'vendor',         label: 'Vendor' },
    { key: 'notes',          label: 'Notes' },
  ],
  mileage: [
    { key: 'miles',          label: 'Miles',         required: true },
    { key: 'mileage_date',   label: 'Date',          required: true },
    { key: 'purpose',        label: 'Purpose' },
    { key: 'start_location', label: 'Start' },
    { key: 'end_location',   label: 'End' },
  ],
};

export const ENTITY_ORDER = ['customers', 'quotes', 'jobs', 'invoices', 'expenses', 'mileage'];

export const ENTITY_LABELS = {
  customers: 'Customers',
  quotes:    'Quotes',
  jobs:      'Jobs',
  invoices:  'Invoices',
  expenses:  'Expenses',
  mileage:   'Mileage',
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
  quotes: {
    title:          ['title', 'quote title', 'estimate title'],
    customer_name:  ['client name', 'client', 'customer'],
    amount:         ['amount', 'total', 'quote total'],
    status:         ['status', 'quote status'],
    sent_date:      ['sent date', 'date sent', 'created date'],
    description:    ['description', 'notes', 'memo'],
  },
  expenses: {
    amount:         ['amount', 'total', 'expense amount'],
    category:       ['category', 'expense category', 'type'],
    expense_date:   ['date', 'expense date'],
    vendor:         ['vendor', 'supplier', 'merchant'],
    notes:          ['notes', 'description', 'memo'],
  },
  mileage: {
    miles:          ['miles', 'distance', 'trip miles'],
    mileage_date:   ['date', 'trip date'],
    purpose:        ['purpose', 'reason', 'description'],
    start_location: ['from', 'start', 'starting address'],
    end_location:   ['to', 'end', 'destination'],
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
  quotes: {
    title:          ['estimate name', 'estimate title', 'service'],
    customer_name:  ['customer name', 'customer'],
    amount:         ['total', 'amount', 'estimate total'],
    status:         ['status', 'estimate status'],
    sent_date:      ['sent date', 'created date'],
    description:    ['description', 'notes'],
  },
  expenses: {
    amount:         ['amount', 'total'],
    category:       ['category', 'type'],
    expense_date:   ['date', 'expense date'],
    vendor:         ['vendor', 'merchant'],
    notes:          ['notes', 'description'],
  },
  mileage: {
    miles:          ['miles', 'distance'],
    mileage_date:   ['date', 'trip date'],
    purpose:        ['purpose', 'reason'],
    start_location: ['from', 'start'],
    end_location:   ['to', 'end'],
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
  quotes: {
    title:          ['memo', 'description'],
    customer_name:  ['customer'],
    amount:         ['amount', 'total'],
    status:         ['status'],
    sent_date:      ['date', 'transaction date'],
    description:    ['memo'],
  },
  expenses: {
    amount:         ['amount', 'total'],
    category:       ['account', 'category'],
    expense_date:   ['date', 'transaction date'],
    vendor:         ['name', 'vendor'],
    notes:          ['memo', 'description'],
  },
  mileage: {
    miles:          ['miles', 'distance'],
    mileage_date:   ['date'],
    purpose:        ['memo', 'description'],
    start_location: ['from'],
    end_location:   ['to'],
  },
};

export const PRESETS = [JOBBER, HOUSECALL, QUICKBOOKS];

// Classify a sheet by its name + headers. Returns one of the
// entity keys (or 'unknown' if no strong signal). Used by the
// unified import flow to route each sheet of a multi-sheet
// workbook (or each uploaded file) to the right importer
// without making the contractor pick.
//
// Sheet-name match is preferred (most platforms export with
// labels like "Customers", "Invoices", "Estimates"). Header
// fingerprint is the fallback for renamed sheets or single-CSV
// uploads where the filename doesn't help.
export function classifySheet(sheetName, headers) {
  const name = NORMALIZE(sheetName || '');
  // Direct name matches first
  if (/customer|client|contact/.test(name))            return 'customers';
  if (/^quote|estimat/.test(name))                     return 'quotes';
  if (/^job|work order|appointment|schedul/.test(name))return 'jobs';
  if (/^invoice|billing|sale|payment/.test(name))      return 'invoices';
  if (/expens|receipt|purchas/.test(name))             return 'expenses';
  if (/mileag|trip|travel/.test(name))                 return 'mileage';

  // Header fingerprinting: pick the entity whose target fields
  // best match the file's headers across all known presets.
  const norm = headers.map(NORMALIZE);
  const scores = {};
  for (const entity of Object.keys(TARGET_SCHEMAS)) {
    let best = 0;
    for (const preset of PRESETS) {
      const aliases = preset[entity] || {};
      let score = 0;
      for (const fieldAliases of Object.values(aliases)) {
        for (const a of fieldAliases) {
          if (norm.includes(NORMALIZE(a))) { score += 1; break; }
        }
      }
      if (score > best) best = score;
    }
    scores[entity] = best;
  }
  // Pick the highest-scoring entity, but require a meaningful
  // threshold to avoid mis-routing a tiny / ambiguous sheet.
  let pick = 'unknown';
  let topScore = 1; // need at least 2 matching aliases
  for (const [entity, score] of Object.entries(scores)) {
    if (score > topScore) { pick = entity; topScore = score; }
  }
  return pick;
}

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
