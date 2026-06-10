// Tour script. Each step either centers a modal (target: null) or
// spotlights a DOM element selected by `target`. `page` is the
// pathname the step lives on — the overlay navigates there when the
// step becomes active.
//
// Goal: walk a brand-new contractor (or a demo viewer) through every
// non-obvious feature of MyForeman in one click-through. Modal steps
// are used when the feature lives inside a sheet/modal that the
// default page can't reliably show (change orders, signature pad,
// time clock, on-the-way) — the step explains the feature in copy
// rather than spotlighting it.

export const TOUR_STEPS = [
  {
    id: 'welcome',
    page: '/dashboard',
    target: null,
    title: 'Welcome to MyForeman',
    body: "Let me walk you through how MyForeman runs your business — from the first call to the final payment. About 2 minutes, you can skip any time.",
    primary: 'Show Me',
  },
  {
    id: 'dashboard-financials',
    page: '/dashboard',
    target: '[data-tour="dashboard-financials"]',
    title: 'Your numbers at a glance',
    body: 'YTD revenue, expenses, net income, estimated tax, outstanding invoices. All live, all sourced from the actual jobs and invoices in MyForeman. Tap any tile to drill in.',
    primary: 'Next',
  },
  {
    id: 'dashboard-feed',
    page: '/dashboard',
    target: '[data-tour="action-feed"]',
    title: 'Your daily action list',
    body: 'Every overdue invoice, sent quote waiting on a customer, and pending crew approval lands here every morning, sorted by urgency. Tap any row to handle it.',
    primary: 'Got it',
  },

  // ---------- LEAD → QUOTE → JOB ----------
  {
    id: 'leads-share',
    page: '/leads',
    target: '[data-tour="lead-share-card"]',
    title: 'Leads come to you',
    body: "Share this QR code on your truck, your business cards, social posts. Anyone who scans it lands on YOUR quote form, and shows up here automatically — pre-tagged by source.",
    primary: 'Next',
  },
  {
    id: 'quote-flow',
    page: '/quotes',
    target: '[data-tour="page-cta"]',
    title: 'Quotes that close themselves',
    body: "Build a quote with line items in 60 seconds. The customer approves it from their phone. No email tag. The moment they approve, MyForeman drops a Pending job on your list for you to schedule.",
    primary: 'Next',
  },
  {
    id: 'services',
    page: '/services',
    target: '[data-tour="page-cta"]',
    title: 'Your price book',
    body: "Add the services you offer with default prices once. Every quote and job after that autofills from this list, so you stop retyping numbers and stop underpricing yourself by accident.",
    primary: 'Next',
  },

  // ---------- SCHEDULE + JOB OPS ----------
  {
    id: 'schedule-flow',
    page: '/jobs',
    target: null,
    title: 'Schedule, and the customer hears about it',
    body: "When you set a date on a Pending job, the customer instantly gets a branded email AND a text (if they opted in) confirming the day. No followups, no game of phone tag.",
    primary: 'Next',
  },
  {
    id: 'jobs',
    page: '/jobs',
    target: '[data-tour="page-cta"]',
    title: 'Dispatch + track',
    body: "Assign jobs to crew or drop them in a pool for crew to claim. Track hours, log expenses, mark complete. Everyone knows what to do, no group texts.",
    primary: 'Next',
  },
  {
    id: 'job-photos',
    page: '/jobs',
    target: '[data-tour="job-row"]',
    title: 'Photos from the job site',
    body: "Open any job and snap before / work / after photos right from your phone's camera. They save to that job forever. Your insurance record, your customer's proof of work, your portfolio for next time.",
    primary: 'Next',
  },
  {
    id: 'on-the-way',
    page: '/jobs',
    target: null,
    title: '"On my way" — one tap, instant text',
    body: "Open any active job, tap 🚐 ON MY WAY. The customer gets a text + email with the crew member's name and ETA. Their time clock starts automatically, mileage tracking starts on the truck. No more 'are they coming?' calls.",
    primary: 'Next',
  },
  {
    id: 'change-orders',
    page: '/jobs',
    target: null,
    title: 'Change orders — handle scope creep right',
    body: "Mid-job, scope changes. Tap + CHANGE ORDER on the job sheet. Describe the extra work, set the price, hit send. The customer approves on their phone in 30 seconds, the new total rolls into the final invoice automatically. Anyone on your crew can create one — they don't need to flag you down first.",
    primary: 'Next',
  },
  {
    id: 'customer-signature',
    page: '/jobs',
    target: null,
    title: 'Customer signs off — disputes die',
    body: "When the job's marked complete, the customer signs on the screen. Signature lands on the receipt, the emailed invoice, and the customer portal. 'I didn't agree to that' disputes don't happen when their name is on the file.",
    primary: 'Next',
  },

  // ---------- INVOICES + PAYMENTS ----------
  {
    id: 'invoice-auto',
    page: '/invoices',
    target: null,
    title: 'Invoices send themselves',
    body: "When you mark a job complete, the invoice fires automatically with a Pay Now button. When the customer pays, a feedback request fires automatically. Cash flows in, reviews roll in, hands-free.",
    primary: 'Next',
  },
  {
    id: 'customer-payments',
    page: '/invoices',
    target: null,
    title: 'Get paid however your customer pays',
    body: "Connect Stripe and customers pay any invoice by card in one tap. Funds go to YOUR Stripe account, not ours. Zero platform cut. Add your Venmo, Zelle, Cash App, PayPal handles — those show up alongside the card option with tap-to-pay deeplinks.",
    primary: 'Next',
  },
  {
    id: 'invoice-reminders',
    page: '/invoices',
    target: null,
    title: 'We chase the money for you',
    body: "When an invoice goes past due, MyForeman automatically emails the customer at 7, 14, and 30 days. Branded from your business, polite but firm. You stop chasing checks and the dollars come in faster.",
    primary: 'Next',
  },
  {
    id: 'customer-texting',
    page: '/invoices',
    target: null,
    title: 'Customer texting, compliance built in',
    body: "Every customer-facing text — booking confirmation, on-the-way, paid receipt, feedback ask — only goes to customers who opted in on your booking form. Reply STOP and they're off the list automatically. Twilio + carrier rules, handled. You don't need to think about it.",
    primary: 'Next',
  },
  {
    id: 'ai-import',
    page: '/invoices',
    target: '[data-tour="import-cta"]',
    title: 'AI reads your invoices',
    body: "Have stacks of old paper invoices to enter? Snap a photo or drop a PDF. Claude reads them and pulls customer, total, dates in seconds. No typing.",
    primary: 'Next',
  },

  // ---------- AI EVERYWHERE ----------
  {
    id: 'ai-assistant',
    page: '/dashboard',
    target: '[aria-label="Open assistant"]',
    title: 'AI assistant, every page',
    body: "Tap the sparkle button bottom right. Type 'log $40 fuel' or 'what's my net this month'. It runs the action or answers from your real data — expenses, invoices, jobs, the works. Same panel on every screen.",
    primary: 'Next',
  },
  {
    id: 'ai-coach',
    page: '/insights',
    target: '[data-tour="ai-coach"]',
    title: 'Your AI business coach',
    body: "Once a month MyForeman analyzes your real revenue, jobs, and customers, then delivers 4 or 5 specific actions to grow. Pricing tweaks, slow-month fillers, customer follow-ups. Not generic advice — your numbers, your moves.",
    primary: 'Next',
  },
  {
    id: 'ai-fair-use',
    page: '/insights',
    target: null,
    title: 'AI is included in your plan',
    body: "All the AI stuff is included — customer chat, the in-app assistant, the monthly read-out. When the AI gets the same question twice, the second person gets an instant free answer. Check your AI Usage section anytime to see how much you're using.",
    primary: 'Got it',
  },

  // ---------- BOOKS + TAX ----------
  {
    id: 'expenses',
    page: '/expenses',
    target: '[data-tour="expenses-header"]',
    title: 'Snap receipts on the job',
    body: "Photo of a receipt at the supply store, tagged to the job. We track every category, mark what's tax-deductible, and roll it into your tax estimate automatically.",
    primary: 'Next',
  },
  {
    id: 'tax',
    page: '/tax',
    target: '[data-tour="tax-summary"]',
    title: 'Tax math, done for you',
    body: "Quarterly estimated payments calculated live. Business mileage at the IRS rate, expense deductibility per category, accountant-ready CSV when April rolls around.",
    primary: 'Next',
  },

  // ---------- TEAM ----------
  {
    id: 'crew-hierarchy',
    page: '/crew',
    target: null,
    title: 'Build your crew',
    body: "Three tiers: Foreman runs the org, Supervisors dispatch their assigned crew, Crew sees only their assigned jobs. Drag a crew member under a supervisor on the org tree and they're set up. Every screen — jobs, expenses, approvals — respects the hierarchy automatically.",
    primary: 'Next',
  },

  // ---------- REVIEWS + CUSTOMER COMMS ----------
  {
    id: 'review-deflection',
    page: '/reviews',
    target: null,
    title: 'Turn happy customers into Google reviews',
    body: "Set your Google Business review link in Settings. After a customer pays, they're asked for feedback. 4 or 5 stars? They see a 'Post to Google' button. 1-3 stars? The complaint stays private and you get a private notification to make it right. Your public rating goes up, your blind spots come to you.",
    primary: 'Next',
  },
  {
    id: 'customer-portal',
    page: '/dashboard',
    target: null,
    title: 'Your customers get their own page too',
    body: "Every customer has a portal at a private link — past jobs, current quotes awaiting their approval, unpaid invoices with Pay Now buttons. No password. Drop the link in a text, they tap it, they self-serve.",
    primary: 'Next',
  },

  // ---------- CTA ----------
  {
    id: 'setup',
    page: '/dashboard',
    target: null,
    title: 'Make it yours',
    body: "Add your business name, logo, contact info, and Google review link. They appear on every quote and invoice your customers see, branded by you, not us.",
    primary: 'Set Up My Profile',
    primaryAction: 'settings',
    secondary: "I'll do it later",
    secondaryAction: 'finish',
  },
];
