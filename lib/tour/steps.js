// Tour script — mirrors the native app's lib/tour/steps.ts. 22 steps,
// 4 chapters: dashboard → lead/quote/job ops → invoices/payments/AI →
// books/tax + setup CTA. Each step either spotlights a DOM element
// (`target` is a CSS selector) or shows a centered modal (`target: null`).
// Native target keys map to `data-tour="<key>"` attributes on this side.

export const TOUR_STEPS = [
  // ---------- DASHBOARD ----------
  {
    id: 'welcome',
    page: '/dashboard',
    target: null,
    title: 'Welcome to MyForeman',
    body: "Let me walk you through how MyForeman runs your business on autopilot. About 90 seconds, you can skip any time.",
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

  // ---------- LEAD → QUOTE → SERVICES ----------
  {
    id: 'leads-share',
    page: '/leads',
    target: '[data-tour="lead-share-card"]',
    title: 'Leads come to you',
    body: "Share this QR code on your truck, your business cards, social posts. Anyone who scans it lands on YOUR quote form, and shows up here automatically.",
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
    title: 'Your price book lives here',
    body: "List the services you offer and what you charge. When you build a quote, pick from this list and the price autofills. No more typing the same line items every time.",
    primary: 'Next',
  },

  // ---------- SCHEDULE + JOB OPS ----------
  {
    id: 'schedule-flow',
    page: '/jobs',
    target: null,
    title: 'Schedule, and the customer hears about it',
    body: "When you set a date on a Pending job, the customer instantly gets a branded email + text confirming the day. No followups, no game of phone tag.",
    primary: 'Next',
  },
  {
    id: 'customer-sms',
    page: '/jobs',
    target: null,
    title: 'Customer texts at every milestone',
    body: "Once your Twilio number is connected, customers get a text on top of email when you schedule them, when you're on the way, when the invoice goes out, when payment lands, and when it's time for feedback. They reply STOP to opt out. You stop chasing voicemail.",
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
    id: 'change-orders',
    page: '/jobs',
    target: null,
    title: 'Scope changed? Send a change order',
    body: "On any active job, tap + Change Order to send the customer an extra-work approval request by email + SMS. They approve from their phone, the amount rolls into the final invoice automatically. No surprise charges, no awkward conversations, no money left on the table when scope creeps.",
    primary: 'Next',
  },

  // ---------- INVOICES + PAYMENTS ----------
  {
    id: 'invoice-auto',
    page: '/invoices',
    target: null,
    title: 'Invoices send themselves',
    body: "When you mark a job complete, the invoice fires automatically. When the customer pays, a feedback request fires automatically. Cash flows in, reviews roll in, hands-free.",
    primary: 'Next',
  },
  {
    id: 'customer-payments',
    page: '/invoices',
    target: null,
    title: 'Get paid however your customer pays',
    body: "Connect Stripe and customers can pay any invoice by card in one tap. Funds go to YOUR Stripe account, not ours. Zero platform cut. Add your Venmo, Zelle, Cash App, and PayPal handles and those show up alongside the card option with tap-to-pay links.",
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
    id: 'ai-import',
    page: '/invoices',
    target: '[data-tour="import-cta"]',
    title: 'AI reads your invoices',
    body: "Have stacks of old paper invoices to enter? Snap a photo or drop a PDF. Claude reads them and pulls customer, total, dates in seconds. No typing.",
    primary: 'Next',
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
    id: 'expenses-breakdown',
    page: '/expenses',
    target: '[data-tour="expenses-breakdown"]',
    title: 'Where the money is going',
    body: "Every receipt rolls up into a live breakdown by category. Materials, fuel, tools, subcontractors, meals. You see what each line is costing you, what percent of your spend it is, and which categories are deductible at IRS rates.",
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

  // ---------- AI ----------
  {
    id: 'insights',
    page: '/insights',
    target: '[data-tour="ai-coach"]',
    title: 'Your AI business coach',
    body: "Once a month MyForeman analyzes your real revenue, jobs, and customers, then delivers 4 or 5 specific actions to grow. Pricing tweaks, slow-month fillers, customer follow-ups. Not generic advice.",
    primary: 'Next',
  },
  {
    id: 'ai-assistant',
    page: '/insights',
    target: '[data-tour="ai-assistant"]',
    title: 'Ask anything, from anywhere',
    body: "Tap the sparkle bubble on any screen to ask Claude about your business in plain English. 'Who's my biggest customer this year?' 'How much did I spend on lumber last quarter?' 'Which jobs are missing photos?' It reads your real data and answers in seconds.",
    primary: 'Next',
  },
  {
    id: 'ai-fair-use',
    page: '/insights',
    target: null,
    title: 'AI is included in your plan',
    body: "All the AI stuff is included. Customer chat, the in-app assistant, the monthly read-out. When the AI gets the same question twice, the second person gets an instant free answer. Check your AI Usage section anytime to see how much you're using.",
    primary: 'Got it',
  },

  // ---------- CTA ----------
  {
    id: 'setup',
    page: '/dashboard',
    target: null,
    title: 'Make it yours',
    body: "Add your business name, logo, and contact info. They appear on every quote and invoice your customers see, branded by you, not us.",
    primary: 'Set Up My Profile',
    primaryAction: 'settings',
    secondary: "I'll do it later",
    secondaryAction: 'finish',
  },
];
