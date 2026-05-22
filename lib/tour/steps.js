// Tour script. Each step either centers a modal (target: null) or
// spotlights a DOM element selected by `target`. `page` is the
// pathname the step lives on — the overlay navigates there when the
// step becomes active.

export const TOUR_STEPS = [
  {
    id: 'welcome',
    page: '/dashboard',
    target: null,
    title: 'Welcome to MyForeman',
    body: "Let's take a quick tour. I'll walk you through each part of the app — what's on every screen and what to click. About 60 seconds total.",
    primary: 'Show Me',
  },
  {
    id: 'dashboard-feed',
    page: '/dashboard',
    target: '[data-tour="action-feed"]',
    title: 'Your daily action list',
    body: 'This is what to do today. Overdue invoices, sent quotes waiting on customers, pending crew approvals — they all show up here, sorted by urgency. Tap any row to jump to it.',
    primary: 'Got it',
  },
  {
    id: 'leads-share',
    page: '/leads',
    target: '[data-tour="lead-share-card"]',
    title: 'Capture leads automatically',
    body: 'Share this QR code or link anywhere — your truck, business cards, Facebook, signage. Anyone who scans it lands on your quote-request form and shows up here.',
    primary: 'Next',
  },
  {
    id: 'leads-add',
    page: '/leads',
    target: '[data-tour="page-cta"]',
    title: 'Or add leads manually',
    body: 'When someone calls or you meet someone at a job, tap +NEW to log them with notes and a follow-up date so they don\'t fall through the cracks.',
    primary: 'Next',
  },
  {
    id: 'quotes',
    page: '/quotes',
    target: '[data-tour="page-cta"]',
    title: 'Build quotes that close',
    body: 'Add line items, labor, materials. Send it with one tap and the customer approves from their phone. No back-and-forth, no phone tag.',
    primary: 'Next',
  },
  {
    id: 'jobs',
    page: '/jobs',
    target: '[data-tour="page-cta"]',
    title: 'Dispatch your crew',
    body: 'Approved quotes turn into jobs automatically. Assign them to a crew member or drop them in the pool for crew to claim. Everyone knows what to do.',
    primary: 'Next',
  },
  {
    id: 'invoices',
    page: '/invoices',
    target: '[data-tour="invoices-summary"]',
    title: 'Get paid faster',
    body: 'Mark a job complete and the invoice fires automatically. When it gets paid, a feedback request goes to your customer automatically. Reviews and revenue, hands-free.',
    primary: 'Next',
  },
  {
    id: 'insights',
    page: '/insights',
    target: '[data-tour="ai-coach"]',
    title: 'Know your business',
    body: 'Revenue trends, your most profitable jobs, dormant customers worth a follow-up. After 3 months your AI Coach delivers monthly recommendations from your real data.',
    primary: 'Next',
  },
  {
    id: 'setup',
    page: '/dashboard',
    target: null,
    title: 'One last thing',
    body: 'Add your business name, logo, and contact info. Takes 2 minutes and shows up on every quote and invoice your customers see.',
    primary: 'Set Up My Profile',
    primaryAction: 'settings',
    secondary: "I'll do it later",
    secondaryAction: 'finish',
  },
];
