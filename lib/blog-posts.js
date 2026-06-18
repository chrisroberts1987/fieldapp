// Blog post data. Each entry renders as /blog/[slug] via the dynamic
// route in pages/blog/[slug].js and shows up on the /blog index.
// Body content is a list of typed blocks the renderer walks.
//
// Block types:
//   { type: 'p',  text: '...' }
//   { type: 'h2', text: '...' }
//   { type: 'h3', text: '...' }
//   { type: 'ul', items: ['...', '...'] }
//   { type: 'ol', items: ['...', '...'] }

export const CATEGORIES = {
  pricing:    { label: 'Pricing',    color: '#2edf87' },
  operations: { label: 'Operations', color: '#4f9eff' },
  growth:     { label: 'Growth',     color: '#fbbf24' },
};

export const BLOG_POSTS = [
  // ============================================================
  // PRICING
  // ============================================================
  {
    slug: 'how-much-should-a-handyman-charge-per-hour',
    category: 'pricing',
    title: 'How Much Should a Handyman Charge Per Hour?',
    description: 'A practical breakdown of handyman hourly rates in the US, what changes the number, and how to figure out the right rate for your area and skill level.',
    metaTitle: 'How Much Should a Handyman Charge Per Hour? (2026 Guide)',
    metaDescription: 'Average handyman hourly rates run $50 to $125 in most US markets. Here is how to set yours based on overhead, region, and what the work is worth.',
    publishedAt: '2026-06-17',
    readingTime: '6 min read',
    intro: 'Most handymen undercharge when they start out. Then they work sixty hour weeks and wonder why the bank account is not growing. Here is how to figure out a fair hourly rate that actually pays the bills.',
    blocks: [
      { type: 'h2', text: 'The honest answer' },
      { type: 'p', text: 'Across most of the United States, handyman hourly rates fall between $50 and $125 per hour. In rural areas the low end is closer to $40. In high cost cities like Seattle, the Bay Area, Boston, or New York, you will see $150 to $200 per hour for established handymen with insurance and good reviews.' },
      { type: 'p', text: 'That is a wide range. What matters is where your number falls inside it, and why.' },

      { type: 'h2', text: 'What actually changes your rate' },
      { type: 'ul', items: [
        'Region. A handyman in Austin will charge more than one in rural Mississippi for the same work. Cost of living, what locals are used to paying, and what the competition charges all factor in.',
        'License and insurance. Once you carry general liability and have a license number on the truck, you can charge 20 to 40 percent more than the guy who shows up uninsured.',
        'Specialty work. Tile, electrical, plumbing, and finish carpentry all command higher rates than picture hanging or assembly work.',
        'How busy you are. If you are turning down jobs every week, you are too cheap. If your calendar has gaps, the market is telling you something.',
        'Reviews and referrals. A handyman with a hundred five-star reviews on Google can charge whatever they want. Reviews are leverage.',
      ]},

      { type: 'h2', text: 'Hourly vs flat rate vs per-job' },
      { type: 'p', text: 'Hourly rates are easy to explain but they punish you for being fast. Flat rates and per-job pricing reward speed and skill. Most experienced handymen end up on a hybrid: a minimum service call fee, then either hourly or a flat per-job number depending on what the work is.' },
      { type: 'p', text: 'A common setup looks like this. A two hour minimum at $85 per hour for small repairs, with flat rates posted for common jobs like installing a ceiling fan, replacing a toilet, or hanging a TV. The customer knows what to expect and you do not have to negotiate every call.' },

      { type: 'h2', text: 'How to calculate your minimum' },
      { type: 'p', text: 'Add up your yearly costs. Truck payment, gas, insurance, tools, phone, software, marketing, accountant. For most solo handymen this lands somewhere between $25,000 and $45,000 per year. Now divide by the billable hours you actually expect to work.' },
      { type: 'p', text: 'You will not bill forty hours a week. Drive time, quotes, invoicing, and admin eat at least a third of your day. Most solo handymen bill 20 to 28 hours a week, or roughly 1,000 to 1,400 hours a year.' },
      { type: 'p', text: 'Take your overhead and divide it by your billable hours. That is your break-even rate. Now add the take-home you actually want. If you want to clear $70,000 a year and your overhead is $30,000 with 1,200 billable hours, your rate needs to be at least $83 per hour just to hit that. Charge less and you are working for free.' },

      { type: 'h2', text: 'Common pricing mistakes' },
      { type: 'ul', items: [
        'Pricing to be the cheapest. The cheapest contractors attract the worst customers. Be the best value, not the cheapest.',
        'Forgetting drive time. If you are driving 45 minutes each way for an hour job, you are losing money. Build a minimum or a travel fee.',
        'Not raising rates yearly. Every cost in your business goes up every year. Your rate should too. Five to ten percent annually is normal.',
        'Quoting on the phone. You cannot see the job. Quote a service call to come look, then quote the real work in person.',
      ]},

      { type: 'h2', text: 'Closing thought' },
      { type: 'p', text: 'The contractors who charge well are usually not the most skilled. They are the most confident in what their work is worth. Set a rate that pays for the business and the life you want. The right customers will pay it.' },
    ],
  },

  {
    slug: 'hvac-service-call-pricing-guide',
    category: 'pricing',
    title: 'HVAC Service Call Pricing Guide',
    description: 'What an HVAC service call fee should cover, typical pricing ranges, when to charge a diagnostic fee, and how to explain it to customers without losing the job.',
    metaTitle: 'HVAC Service Call Pricing Guide (2026 Rates and Tips)',
    metaDescription: 'HVAC service call fees typically run $75 to $150. Here is what the fee covers, how to handle diagnostics, and after-hours pricing for HVAC contractors.',
    publishedAt: '2026-06-17',
    readingTime: '5 min read',
    intro: 'The service call fee is the first number a customer hears, and it sets the tone for the whole job. Get it right and you make a fair profit on every truck roll. Get it wrong and you either bleed money or scare off good customers.',
    blocks: [
      { type: 'h2', text: 'What a service call fee actually covers' },
      { type: 'p', text: 'A service call fee covers the cost of getting you and your truck to the customer. That includes drive time, fuel, insurance, the time it takes to diagnose the problem, and your minimum profit on the trip. It does not cover the repair itself.' },
      { type: 'p', text: 'If you do not charge a service call fee, you are giving away the most expensive part of your day. Drive time is real time.' },

      { type: 'h2', text: 'Typical HVAC service call ranges' },
      { type: 'ul', items: [
        'Standard daytime call: $75 to $150 in most US markets. Higher in major metro areas.',
        'After-hours or weekend: $150 to $250. Sunday and holidays often hit $300 or more.',
        'Diagnostic-only or estimate visits: $89 to $129 is the sweet spot if you want to discourage tire-kickers without losing real jobs.',
        'Emergency calls (no heat, no AC in extreme weather): same as after-hours, sometimes a $50 premium.',
      ]},

      { type: 'h2', text: 'Diagnostic fee vs trip charge' },
      { type: 'p', text: 'Some HVAC contractors split these out. A trip charge covers the drive. A diagnostic fee covers the time to find the problem. Together they make up the service call.' },
      { type: 'p', text: 'Other contractors bundle them into one number. There is no right answer, but bundling is cleaner for the customer to understand. Whatever you do, post the fee on your website and quote it on the phone before you dispatch.' },

      { type: 'h2', text: 'Should the fee apply to the repair?' },
      { type: 'p', text: 'A common policy: if the customer approves the repair, the service call fee gets credited toward the work. If they decline, they still pay the service call. This is fair to both sides and it removes the customer feeling like they paid for nothing.' },
      { type: 'p', text: 'Some shops do not credit the fee. That is also fine if your service call number is reasonable and you explain it clearly. The customers who push back on a sixty dollar service call would have been a headache anyway.' },

      { type: 'h2', text: 'After-hours pricing' },
      { type: 'p', text: 'After-hours is whatever you decide it is. Most shops define it as evenings (after 5 or 6pm), weekends, and holidays. Some shops do a flat after-hours fee on top of the normal service call. Others double the rate. Either works, as long as the customer knows before you dispatch.' },
      { type: 'p', text: 'If a customer balks at after-hours pricing, offer them a morning appointment at the regular rate. The ones who really need help right now will pay. The ones who do not will wait.' },

      { type: 'h2', text: 'How to explain the fee to customers' },
      { type: 'p', text: 'Keep it simple and honest. Something like: "Our service call is $99. That covers a tech coming out, diagnosing the issue, and giving you a quote on the repair. If you approve the work, the $99 comes off the final bill. If not, you only pay the $99."' },
      { type: 'p', text: 'Say it on the phone. Say it again at the door. Put it in writing on the invoice. Customers do not like surprises. They are fine with fees they knew about.' },

      { type: 'h2', text: 'Closing thought' },
      { type: 'p', text: 'Your service call fee is not just revenue. It is a filter. The right number screens out the customers who waste your day and keeps the ones who value good work. Set it where it makes sense for your market and stop apologizing for it.' },
    ],
  },

  {
    slug: 'plumbing-markup-calculator',
    category: 'pricing',
    title: 'Plumbing Markup Calculator',
    description: 'How to set markup on plumbing materials and labor without underpricing or scaring customers off. Real ranges, formulas, and the math behind a healthy plumbing business.',
    metaTitle: 'Plumbing Markup Calculator and Pricing Guide',
    metaDescription: 'Plumbing material markup runs 30 to 200 percent depending on the part. Here is how to calculate your markup and price plumbing jobs for real profit.',
    publishedAt: '2026-06-17',
    readingTime: '6 min read',
    intro: 'Markup is the difference between a plumbing business that pays its bills and one that constantly feels like it is running on fumes. Most plumbers undercharge on materials because they feel guilty. The truth is your markup is what funds your business.',
    blocks: [
      { type: 'h2', text: 'Why markup matters' },
      { type: 'p', text: 'When you charge a customer for a $8 wax ring at $16, that $8 of markup is not greed. It is paying for the drive to the supply house, the time picking it out, the warranty you stand behind, the cost of carrying inventory on the truck, and the credit card fees on the transaction. Customers do not see all of that. They see a part.' },
      { type: 'p', text: 'If you do not mark up materials, you are paying for all of that yourself. That is not a business, that is a hobby.' },

      { type: 'h2', text: 'Common plumbing markup ranges' },
      { type: 'ul', items: [
        'Small parts (wax rings, supply lines, valves under $30): 100 to 300 percent markup. A $5 part bills at $15 to $20.',
        'Mid-size parts ($30 to $200): 50 to 100 percent. A $75 garbage disposal bills at $115 to $150.',
        'Major equipment (water heaters, sump pumps, fixtures): 25 to 50 percent. A $900 water heater bills at $1,125 to $1,350.',
        'Special order or custom items: 30 to 50 percent, sometimes less if the dollar amount is large.',
      ]},
      { type: 'p', text: 'The pattern is: smaller parts get higher percentage markup because the dollar amount is small. Larger parts get lower percentage markup because the absolute dollars are already big. You are charging for handling, not for the part itself.' },

      { type: 'h2', text: 'How to calculate your markup' },
      { type: 'p', text: 'The simplest formula is markup multiplier. If your part costs $10 and your markup is 100 percent, your customer pays $20. The formula is:' },
      { type: 'p', text: 'Sell price = Cost × (1 + markup percentage)' },
      { type: 'p', text: 'A $40 part at 80 percent markup is $40 × 1.80 = $72.' },
      { type: 'p', text: 'A $200 fixture at 40 percent markup is $200 × 1.40 = $280.' },

      { type: 'h2', text: 'Markup vs margin (do not confuse them)' },
      { type: 'p', text: 'Markup is calculated from your cost. Margin is calculated from the sale price. A 100 percent markup is a 50 percent margin. Most plumbers think in markup because that is what the supply house pricebook uses. Just know the difference when you talk to your accountant.' },

      { type: 'h2', text: 'Labor markup' },
      { type: 'p', text: 'Labor pricing is separate from materials. Most plumbing shops bill labor at a flat rate per task or hourly rate that already builds in profit. A working plumber costs you somewhere around $30 to $50 an hour fully loaded (with payroll taxes, insurance, vehicle, and overhead). You bill them out at $125 to $200 per hour. The difference is your profit on labor.' },
      { type: 'p', text: 'Some shops use flat-rate pricing books (the digital ones are pre-built with national averages you can tune to your market). Others build their own. Either way, your labor rate should land high enough to cover overhead, payroll, and a healthy margin.' },

      { type: 'h2', text: 'A simple worked example' },
      { type: 'p', text: 'Job: replace a kitchen faucet. The new faucet costs you $145 at the supply house. Labor is one hour.' },
      { type: 'ul', items: [
        'Materials: $145 × 1.50 = $217.50',
        'Labor: 1 hour at $150 = $150',
        'Disposal of old faucet: $10',
        'Total: $377.50',
      ]},
      { type: 'p', text: 'Your gross profit on this job: about $72 in material markup plus $100 to $120 on labor (depending on your actual cost per hour). Around $190. That is healthy. Charge less and you start eating into overhead.' },

      { type: 'h2', text: 'Communicating markup to customers' },
      { type: 'p', text: 'Do not itemize markup on the invoice. Just give a clean total per line item. If a customer asks why a part costs more than at the hardware store, the answer is simple: you are not buying a part, you are buying the part plus the time to source it, the truck to deliver it, the labor to install it, and the warranty to back it up.' },

      { type: 'h2', text: 'Closing thought' },
      { type: 'p', text: 'Healthy markup is what lets you pay your team, replace your trucks, take a vacation once in a while, and stay in business for ten years. If your markup math is making you uncomfortable, raise it slowly until it does not. Your good customers will not leave, and the cheap ones are not worth keeping.' },
    ],
  },

  {
    slug: 'how-to-price-roofing-jobs',
    category: 'pricing',
    title: 'How to Price Roofing Jobs',
    description: 'A roofing contractor pricing guide covering bidding by the square, pitch and complexity factors, materials and labor math, and how to handle insurance work.',
    metaTitle: 'How to Price Roofing Jobs (Bid Like a Pro)',
    metaDescription: 'Learn how to price roofing jobs by the square, factor in pitch and tear-off, and bid insurance work profitably. A practical guide for roofing contractors.',
    publishedAt: '2026-06-17',
    readingTime: '7 min read',
    intro: 'Roofing is one of the highest stakes trades when it comes to pricing. Bid too low and you lose money on a job that takes a week. Bid too high and you watch your competitor take it. Here is how to get the math right.',
    blocks: [
      { type: 'h2', text: 'Bid by the square' },
      { type: 'p', text: 'A roofing square is 100 square feet. Bidding by the square is the standard way to price residential roofs because it lets you compare materials, labor, and overhead consistently from job to job.' },
      { type: 'p', text: 'For a basic asphalt shingle tear-off and replacement on a typical residential roof, all-in pricing usually lands between $400 and $700 per square. That covers tear-off, materials, labor, dump fees, and your profit. Higher-end shingles, metal roofs, and tile all bid higher.' },

      { type: 'h2', text: 'Tear-off vs overlay' },
      { type: 'p', text: 'Overlay (going over an existing layer) costs less because you skip the tear-off and disposal. But most building codes only allow one overlay, and a lot of inspectors will flag a second one. Most modern jobs are tear-off, even if the customer asks about an overlay.' },
      { type: 'p', text: 'Tear-off adds roughly $100 to $150 per square depending on how many layers come off and where the dumpster goes. Two layers costs more than one. A walk-up to the curb costs less than a haul through a back yard.' },

      { type: 'h2', text: 'Pitch and complexity' },
      { type: 'p', text: 'Pitch is the slope of the roof, measured in inches of rise per foot of run. A 4:12 roof is gentle. An 8:12 is steep. A 12:12 needs roof jacks, harnesses, and slows the crew way down.' },
      { type: 'ul', items: [
        '4:12 or lower: standard pricing. Crew walks the roof.',
        '6:12 to 8:12: 10 to 20 percent surcharge. Harnesses and slower pace.',
        '9:12 to 12:12: 25 to 50 percent surcharge. Roof jacks, full fall protection, much slower.',
        'Over 12:12: bid by the day, not by the square. These are dangerous and slow.',
      ]},
      { type: 'p', text: 'Complexity also matters. A simple gable roof bids low. A cut-up roof with lots of valleys, hips, dormers, and chimneys takes longer and uses more flashing and waste. Add 10 to 25 percent for complex roofs.' },

      { type: 'h2', text: 'The materials, labor, overhead, profit breakdown' },
      { type: 'p', text: 'On a typical asphalt roof, your costs break down roughly like this:' },
      { type: 'ul', items: [
        'Materials (shingles, underlayment, flashing, nails, ridge, vents): 30 to 40 percent of the bid.',
        'Labor (crew wages or sub costs): 25 to 35 percent.',
        'Disposal and dumpster: 5 to 8 percent.',
        'Overhead (insurance, marketing, office, vehicles): 10 to 15 percent.',
        'Profit: 15 to 25 percent. Anything under 10 percent is dangerous.',
      ]},
      { type: 'p', text: 'If your bids consistently come in around break-even, work backwards from your overhead and target profit and raise your square pricing until the math works.' },

      { type: 'h2', text: 'Insurance work' },
      { type: 'p', text: 'Storm damage and insurance jobs follow a different process. The adjuster writes the scope and the carrier pays based on Xactimate line items. Your job is to make sure the scope is complete, supplement what they missed, and execute clean.' },
      { type: 'p', text: 'Insurance work can be very profitable for contractors who learn the system. But it requires patience, paperwork, and a Xactimate license (or a relationship with someone who has one). Do not undercut yourself trying to win the homeowner.' },

      { type: 'h2', text: 'Common roofing pricing mistakes' },
      { type: 'ul', items: [
        'Forgetting waste. Real-world material use runs 10 to 15 percent over the measured square footage. Always bid with waste built in.',
        'Skipping the deck inspection. If the deck is rotten, you are repairing it. Build in a per-sheet allowance and add it to the final invoice if needed.',
        'Underestimating dump fees. A typical residential roof generates 2 to 4 tons of waste. Dumpsters and tipping fees vary wildly by market. Know your numbers.',
        'Not charging for permit fees and inspection time. These are real costs. They go on the invoice.',
        'Forgetting profit. A bid that covers your costs is not a job. It is volunteer work.',
      ]},

      { type: 'h2', text: 'Closing thought' },
      { type: 'p', text: 'A roofing business that bids tight without padding for surprises does not last. Every roof has at least one unknown. Build in a 10 percent contingency and stop apologizing for your number. The customers worth working for will pay it.' },
    ],
  },

  // ============================================================
  // OPERATIONS
  // ============================================================
  {
    slug: 'how-to-create-a-contractor-invoice',
    category: 'operations',
    title: 'How to Create a Contractor Invoice',
    description: 'What every contractor invoice needs to include, what is smart but optional, and how to send invoices that actually get paid on time.',
    metaTitle: 'How to Create a Contractor Invoice (Free Template Guide)',
    metaDescription: 'Learn what to put on a contractor invoice, how to set payment terms, and how to send invoices that get paid faster. With examples and common mistakes.',
    publishedAt: '2026-06-17',
    readingTime: '5 min read',
    intro: 'A contractor invoice is more than a receipt. It is a legal document, a payment request, and the last impression you leave with the customer. Sloppy invoices get paid late. Clean ones get paid fast.',
    blocks: [
      { type: 'h2', text: 'What every invoice needs' },
      { type: 'ul', items: [
        'Your business name, address, phone, email, and license number if you carry one.',
        'A unique invoice number. Sequential numbering (1001, 1002, 1003) makes bookkeeping easier.',
        'Invoice date and due date.',
        'Customer name and service address.',
        'A line-item breakdown of work performed: description, quantity, unit price, line total.',
        'Materials and labor separated if your customers expect that detail.',
        'Subtotal, tax, and grand total.',
        'Payment terms (net 30, net 15, due on receipt, etc.).',
        'How they can pay you (credit card link, Venmo handle, mailing address for checks, etc.).',
      ]},

      { type: 'h2', text: 'What is smart to include but optional' },
      { type: 'ul', items: [
        'A signature line for the customer to acknowledge the work was completed satisfactorily.',
        'Photos of before and after attached to the invoice. Big deal for residential customers and disputes.',
        'Warranty terms (how long, what is covered, what voids it).',
        'Late fees policy (1.5 percent per month is common and legal in most states).',
        'A thank-you note. Sounds soft. It works.',
      ]},

      { type: 'h2', text: 'Payment terms that get you paid' },
      { type: 'p', text: 'Net 30 used to be standard. It is no longer. Most service businesses are moving to net 15 or due on receipt because cash flow matters more than tradition.' },
      { type: 'p', text: 'For one-time service calls, due on receipt is the right answer. The customer is standing there. They pay before you leave. For project work or commercial accounts, net 15 with a 2 percent discount if paid in 7 days is a common setup.' },

      { type: 'h2', text: 'Common contractor invoice mistakes' },
      { type: 'ul', items: [
        'Vague line items. "Repair work" is not a line item. "Replaced kitchen faucet (Moen Arbor)" is.',
        'No due date. Without a due date, the customer assumes whenever.',
        'No payment method shown. The customer has to call to find out how to pay you.',
        'Waiting too long to send it. Send the invoice within 24 hours of finishing the job, ideally before you leave.',
        'Forgetting to follow up. Most invoices that go unpaid never got a reminder.',
      ]},

      { type: 'h2', text: 'Software vs DIY' },
      { type: 'p', text: 'You can write invoices by hand or in Word. But once you are doing more than a few a week, invoicing software pays for itself. Card payments that auto-mark paid, automated reminders, customer history in one place, and the ability to invoice from your phone before you leave the driveway are all huge time savings.' },

      { type: 'h2', text: 'Closing thought' },
      { type: 'p', text: 'The fastest way to improve your cash flow is to invoice the same day you finish the job and follow up on anything still open after seven days. Most late payments are not customers refusing to pay. They are customers who forgot. A friendly reminder gets most invoices closed.' },
    ],
  },

  {
    slug: 'best-way-to-track-service-calls',
    category: 'operations',
    title: 'Best Way to Track Service Calls',
    description: 'What to track on every service call, the tradeoffs between paper, spreadsheets, and software, and how to use the data to actually grow the business.',
    metaTitle: 'Best Way to Track Service Calls (Paper, Spreadsheet, or App?)',
    metaDescription: 'Compare paper, spreadsheets, and field service software for tracking service calls. What to track on every job and how to use the data to grow.',
    publishedAt: '2026-06-17',
    readingTime: '5 min read',
    intro: 'Most contractors track service calls poorly or not at all. Then they wonder why they cannot tell which customers are profitable, which job types make the most money, or which marketing actually works. Tracking is the foundation everything else sits on.',
    blocks: [
      { type: 'h2', text: 'What to track on every service call' },
      { type: 'ul', items: [
        'Customer name, address, phone, email.',
        'Call type or service category (HVAC repair, plumbing leak, electrical troubleshoot, etc.).',
        'How they found you (Google, referral, repeat, Facebook, sign on the truck).',
        'Date and time of the call. Arrival and departure times.',
        'What you found. What you did. Parts used.',
        'Final price and payment status.',
        'Photos before and after.',
        'Follow-up needed and by when.',
      ]},
      { type: 'p', text: 'That last one matters more than you think. The customer with a leaking pipe today might have a water heater on its last legs. Note it now, follow up in six months, win the next job.' },

      { type: 'h2', text: 'Paper, spreadsheet, or app' },
      { type: 'p', text: 'There are three real options. Each has a place.' },

      { type: 'h3', text: 'Paper' },
      { type: 'p', text: 'A clipboard and carbon copies still work. They are cheap, never crash, and customers do not blink at them. The problem is searchability. Try to find that one customer who called you eighteen months ago about a noise. Good luck.' },

      { type: 'h3', text: 'Spreadsheet' },
      { type: 'p', text: 'Google Sheets or Excel is a step up. Searchable, sortable, and easy to share. But it is fragile. One bad edit can delete a whole column. And you are doing data entry twice (once on the job, once in the office).' },

      { type: 'h3', text: 'Field service software' },
      { type: 'p', text: 'An app on your phone lets you log the call from the job site, take photos, attach them, and invoice from the same record. It costs money but the time savings are real, and you suddenly have data you can actually run reports on.' },

      { type: 'h2', text: 'Recurring vs one-off tracking' },
      { type: 'p', text: 'Recurring service calls (maintenance, monthly cleanings, quarterly inspections) need different tracking than one-off repairs. For recurring work you also need to track contract terms, next service date, and what is included. A spreadsheet can do it but starts to break down at more than 30 or 40 active accounts.' },

      { type: 'h2', text: 'What to do with the data' },
      { type: 'p', text: 'Tracking is useless unless you actually look at the numbers. At least once a month:' },
      { type: 'ul', items: [
        'Average ticket size by service type. Where are you making the most money?',
        'Lead source breakdown. Which marketing channels actually convert?',
        'Repeat customer rate. What percentage of revenue is from existing customers?',
        'Outstanding invoices. Who owes you money and how old is it?',
        'Follow-ups due. Customers you said you would call back.',
      ]},

      { type: 'h2', text: 'Closing thought' },
      { type: 'p', text: 'You cannot grow what you do not measure. The contractors who break through to seven figures are almost always the ones who started tracking their numbers years before they hit that revenue. Start now, even if the system is messy. You can clean it up later.' },
    ],
  },

  {
    slug: 'how-to-schedule-jobs-for-a-small-crew',
    category: 'operations',
    title: 'How to Schedule Jobs for a Small Crew',
    description: 'How to schedule jobs efficiently when you have two to ten field workers. Routing, buffer time, communication, and avoiding the chaos that kills small crews.',
    metaTitle: 'How to Schedule Jobs for a Small Crew (Practical Guide)',
    metaDescription: 'A practical guide to scheduling field service jobs for small crews. Routing, buffer time, crew communication, and tools that keep the day on track.',
    publishedAt: '2026-06-17',
    readingTime: '6 min read',
    intro: 'When you go from one truck to three, scheduling gets harder fast. The whiteboard that worked when it was just you and a helper falls apart at scale. Here is how to schedule jobs in a way that does not constantly blow up.',
    blocks: [
      { type: 'h2', text: 'Pick one system and stick with it' },
      { type: 'p', text: 'The fastest way to kill a small crew is having jobs in three different places. Some on the wall calendar, some in texts, some in your head. The crew never knows where to look and something always falls through.' },
      { type: 'p', text: 'Whatever system you pick (paper, Google Calendar, a field service app), every job goes there. Period. If it is not on the schedule, it does not exist.' },

      { type: 'h2', text: 'Build buffer time into the day' },
      { type: 'p', text: 'New schedulers stack jobs back to back assuming the day will go perfectly. It will not. Every day has at least one job that runs long, one customer who is not home, one trip to the supply house that was not planned.' },
      { type: 'p', text: 'Schedule three jobs a day per truck for service work, not five. Leave 30 to 60 minutes between stops. The crew will fill the slack with the surprises. If a day truly goes perfectly, they leave early and you have happy techs.' },

      { type: 'h2', text: 'Route by geography, not by sequence' },
      { type: 'p', text: 'A crew driving across town three times in a day is wasting two hours of billable time. Group jobs by zip code or neighborhood whenever you can.' },
      { type: 'p', text: 'When a new call comes in, ask yourself: where else am I that day? Can it wait one day to pair with another job in that area? Sometimes the answer is no (emergencies). Often it is yes (routine work).' },

      { type: 'h2', text: 'Communicate the day before' },
      { type: 'p', text: 'Send the customer their appointment time the day before. Send the crew their full day schedule the night before. The morning is for working, not for figuring out what is happening.' },
      { type: 'p', text: 'A simple text the night before:' },
      { type: 'p', text: '"Hi Sarah, this is Mike from Foothills Plumbing. Confirming we will be at your place at 9 AM tomorrow for the kitchen faucet. Reply yes to confirm or call 555-1234 if you need to reschedule."' },
      { type: 'p', text: 'No-shows drop dramatically when you confirm. Same for the crew side. Sending them their schedule the night before means they are mentally ready and the truck is loaded.' },

      { type: 'h2', text: 'Have a system for emergencies' },
      { type: 'p', text: 'Emergencies will mess up your perfect schedule. Decide in advance what triggers a schedule change.' },
      { type: 'ul', items: [
        'Will you bump existing customers for emergencies?',
        'Will you charge a premium for same-day service?',
        'Who is your on-call truck for after-hours?',
        'How do you communicate a delay to a customer who is now pushed?',
      ]},
      { type: 'p', text: 'Have answers before the chaos. Otherwise you make bad decisions in the moment.' },

      { type: 'h2', text: 'Use the calendar for capacity planning' },
      { type: 'p', text: 'A scheduled calendar shows you when you are slow and when you are slammed. Slow weeks are the time to push marketing or schedule maintenance work. Slammed weeks are when you raise prices or bring on a sub.' },
      { type: 'p', text: 'If you are booked solid two weeks out and turning work away, your prices are too low. Raise them 10 percent and see what happens. Usually nothing changes except your bank account.' },

      { type: 'h2', text: 'When to upgrade your system' },
      { type: 'p', text: 'Whiteboards and paper work fine for one or two trucks. Once you hit three trucks or you are managing recurring service plus on-call work, the manual systems start to crack. That is when scheduling software earns its keep.' },
      { type: 'p', text: 'You want one screen where you can see every job, every crew member, every truck for the next two weeks. Drag a job to move it. Customer gets an automatic update. Crew sees the change on their phone. No phone calls back and forth.' },

      { type: 'h2', text: 'Closing thought' },
      { type: 'p', text: 'A well-scheduled day pays for itself in stress alone. The crew knows where to be. The customer knows when you will arrive. You are not chasing the day, you are running it.' },
    ],
  },

  {
    slug: 'how-to-manage-a-field-service-team',
    category: 'operations',
    title: 'How to Manage a Field Service Team',
    description: 'How to hire, train, pay, and keep field service techs. The systems that separate growing crews from the ones stuck in constant turnover.',
    metaTitle: 'How to Manage a Field Service Team (Hire, Train, Retain)',
    metaDescription: 'A practical guide to managing a field service team. Hiring, training, pay structures, quality control, and tools that keep good techs from leaving.',
    publishedAt: '2026-06-17',
    readingTime: '7 min read',
    intro: 'Managing a field service team is harder than running the work yourself. You are not in control of every job anymore, and the team becomes the bottleneck or the engine depending on how you manage them. The principles below are not glamorous, but they work.',
    blocks: [
      { type: 'h2', text: 'Hire for attitude, train for skill' },
      { type: 'p', text: 'Most owners hire on skill and end up firing on attitude. A tech with three years of experience and a bad attitude will cost you more in lost customers than they earn you in productivity. A green tech with a great attitude can be trained.' },
      { type: 'p', text: 'Things to look for in interviews:' },
      { type: 'ul', items: [
        'Do they show up on time for the interview?',
        'Do they ask questions about the work, or just about pay and time off?',
        'Can they explain something they fixed and what they learned?',
        'How do they talk about their last boss? Look for accountability, not blame.',
      ]},

      { type: 'h2', text: 'Set clear expectations on day one' },
      { type: 'p', text: 'Most field techs never get told exactly what is expected. They are handed keys and told to go. Then they get yelled at when they do something wrong that nobody told them about.' },
      { type: 'p', text: 'Write it down. Cover at minimum:' },
      { type: 'ul', items: [
        'Start time and what counts as being on time.',
        'Truck cleanliness and inventory standards.',
        'How they communicate with the customer.',
        'How and when they call you for backup.',
        'What gets done before they leave the job (photos, customer signature, payment if applicable).',
        'What gets done at the end of the day.',
      ]},

      { type: 'h2', text: 'Pay structure matters more than pay rate' },
      { type: 'p', text: 'Three common structures for field techs:' },

      { type: 'h3', text: 'Straight hourly' },
      { type: 'p', text: 'Easy to administer. Predictable for the tech. But it does not reward speed or quality. Lazy techs get paid the same as hustlers.' },

      { type: 'h3', text: 'Hourly plus commission' },
      { type: 'p', text: 'Base hourly so the tech has predictable income, plus a commission on materials and add-on sales. Encourages upselling without sacrificing customer trust if structured right. Common: base $25 to $35 per hour, plus 5 to 10 percent on materials sold.' },

      { type: 'h3', text: 'Pay per job or pay per ticket' },
      { type: 'p', text: 'The tech gets a percentage of the invoice (typically 25 to 40 percent of labor revenue). This makes them want to work fast and sell more. Watch out for corner-cutting if quality is not monitored.' },

      { type: 'h2', text: 'Quality control' },
      { type: 'p', text: 'You cannot watch every job. So you build systems that surface bad work.' },
      { type: 'ul', items: [
        'Before-and-after photos required on every job. They go in the invoice.',
        'Customer signature required at completion.',
        'Random call-backs (a quick text or call to the customer 24 hours after the job asking how it went).',
        'A weekly review of every negative or three-star review with the tech involved.',
      ]},

      { type: 'h2', text: 'Train continuously, not once' },
      { type: 'p', text: 'A one-week onboarding and then nothing else for three years is how techs get stagnant. Pick one topic a week. Spend 30 minutes on it as a team.' },
      { type: 'p', text: 'Could be a new tool. A common customer complaint and how to handle it. A type of repair you are seeing more of. The investment is small, the compounding is huge.' },

      { type: 'h2', text: 'Communicate constantly' },
      { type: 'p', text: 'The number one complaint from field techs is "I never know what is going on." Solve that with predictable communication:' },
      { type: 'ul', items: [
        'Daily schedule sent the night before.',
        'A 5 minute morning huddle (or quick group text) covering anything unusual today.',
        'Weekly team check-in to discuss numbers, problems, wins.',
        'Monthly one-on-one with each tech. Not a performance review. Just a check-in.',
      ]},

      { type: 'h2', text: 'Tools that make management easier' },
      { type: 'p', text: 'A field service app that puts the schedule, the customer history, the photo log, and the invoice in the tech\'s pocket cuts your management load by half. Most of the questions techs call you about all day get answered in the app instead.' },

      { type: 'h2', text: 'Closing thought' },
      { type: 'p', text: 'Good field techs are hard to find. Once you have them, the goal is to keep them. Pay them fairly, communicate clearly, give them the tools to do the job well, and they will run through walls for you. Skimp on any of those and they leave.' },
    ],
  },

  // ============================================================
  // GROWTH
  // ============================================================
  {
    slug: 'how-to-get-more-hvac-leads',
    category: 'growth',
    title: 'How to Get More HVAC Leads',
    description: 'Where HVAC leads actually come from in 2026 and how to build a steady pipeline without burning through your marketing budget.',
    metaTitle: 'How to Get More HVAC Leads (2026 Guide)',
    metaDescription: 'A practical guide to generating HVAC leads through Google, reviews, maintenance plans, local SEO, and referrals. What works in 2026.',
    publishedAt: '2026-06-17',
    readingTime: '6 min read',
    intro: 'The HVAC contractors who never seem to run out of work are usually not the best technicians in town. They are the best at marketing. Here is what actually generates leads for HVAC businesses right now.',
    blocks: [
      { type: 'h2', text: 'Google Business Profile is the foundation' },
      { type: 'p', text: 'If you do nothing else this week, claim and fully fill out your Google Business Profile. This is the listing that shows up when someone searches "HVAC repair near me." For most HVAC contractors, more than half of inbound leads come from this single source.' },
      { type: 'p', text: 'Make sure you have:' },
      { type: 'ul', items: [
        'Accurate business name, address, phone number.',
        'A clear service area covering the zip codes you work in.',
        'Photos. Lots of them. Trucks, jobs in progress, the team, finished installs.',
        'Service categories filled out (HVAC contractor, air conditioning contractor, heating contractor).',
        'Hours of operation.',
        'A link to your website.',
      ]},

      { type: 'h2', text: 'Reviews are the next layer' },
      { type: 'p', text: 'Once your Google profile is set up, reviews are what move you up the rankings. Every five-star review you collect makes you more visible in local search and more trusted by the people who find you.' },
      { type: 'p', text: 'The simplest way to get reviews is to ask every happy customer. Text them a link the same day you finish the job. Most customers will leave a review if you make it easy and ask at the right moment.' },

      { type: 'h2', text: 'Local SEO beyond Google Business Profile' },
      { type: 'p', text: 'Your website should rank for "HVAC repair [your city]" and similar searches. To get there:' },
      { type: 'ul', items: [
        'Have a clear homepage that names your city and services.',
        'Create a separate page for each major service (AC repair, furnace install, ductwork) and each major city or neighborhood you serve.',
        'Get linked from local business directories (Yelp, Angi, Nextdoor, Chamber of Commerce).',
        'Publish a blog post or two a month answering common HVAC questions homeowners search for.',
      ]},

      { type: 'h2', text: 'Maintenance plans turn one job into ten' },
      { type: 'p', text: 'A maintenance plan is the single best lead generator most HVAC contractors ignore. You sell a customer a yearly plan (two seasonal tune-ups, priority service, a discount on repairs) for $200 to $300 a year. They become a long-term customer. They call you for repairs because they trust you. They refer their neighbors.' },
      { type: 'p', text: 'Set a goal to convert 25 percent of new customers into maintenance plan members. The lifetime value is 5x to 10x a one-off customer.' },

      { type: 'h2', text: 'Google Local Services Ads' },
      { type: 'p', text: 'Google Local Services Ads (LSAs) appear at the very top of search results, above the regular ads and the Google Business Profile pack. You only pay per lead, not per click. For HVAC, leads range from $25 to $90 each depending on the market.' },
      { type: 'p', text: 'You have to go through a Google background check and provide insurance docs to participate. It takes a week or two to get approved. Once you are in, it is one of the highest converting lead sources available.' },

      { type: 'h2', text: 'Referrals (the cheapest leads you can get)' },
      { type: 'p', text: 'A referred lead converts 3x to 4x better than a cold lead. They already trust you because their friend or neighbor recommended you. Set up two referral programs:' },
      { type: 'ul', items: [
        'Customer referrals. Give a $50 credit on their next service for every referral that becomes a job. Some shops do cash. Both work.',
        'Pro referrals. Build relationships with realtors, property managers, home inspectors, and other tradespeople. They have customers who need HVAC work. You can return the favor for theirs.',
      ]},

      { type: 'h2', text: 'Door hangers and neighbor letters' },
      { type: 'p', text: 'Old school but it still works for HVAC, especially after a big install. When you finish a job, leave 20 door hangers on the houses immediately around the customer. Same neighborhood, same likely system age, same problems coming.' },
      { type: 'p', text: 'A simple letter or postcard works too. Mention the work you just did for their neighbor (no names) and offer a free system check or estimate.' },

      { type: 'h2', text: 'Closing thought' },
      { type: 'p', text: 'HVAC lead generation is not one big lever. It is a dozen small ones that compound. Pick two from this list to start with, do them consistently for ninety days, and add the next one. The goal is a calendar where you are picking which jobs to take, not chasing every call that comes in.' },
    ],
  },

  {
    slug: 'how-to-grow-a-handyman-business',
    category: 'growth',
    title: 'How to Grow a Handyman Business',
    description: 'How to scale from a solo handyman to a real business with multiple trucks. Specialization, pricing, repeat customers, and when to hire.',
    metaTitle: 'How to Grow a Handyman Business (From Solo to Crew)',
    metaDescription: 'A real-world guide to growing a handyman business. Pricing, repeat customers, niche selection, and how to know when to hire your first employee.',
    publishedAt: '2026-06-17',
    readingTime: '6 min read',
    intro: 'Most handyman businesses cap out at one person making $60k to $100k a year. Going beyond that takes a different mindset. Here is what changes when you decide to build something bigger.',
    blocks: [
      { type: 'h2', text: 'Specialize, even a little' },
      { type: 'p', text: 'The fastest way to grow a handyman business is to stop being a true handyman. Pick a niche where the work pays well and the customers come back. Common winners:' },
      { type: 'ul', items: [
        'Bathroom remodels (small ones, $5k to $20k each).',
        'Kitchen punch lists (cabinet replacement, backsplash, fixture upgrades).',
        'Deck repair and refinishing.',
        'Tile installation.',
        'Smart home installs (cameras, doorbells, thermostats).',
        'Aging-in-place modifications (grab bars, walk-in tubs, ramps).',
      ]},
      { type: 'p', text: 'You still take the random calls. But your marketing and quoting focus on the niche. The math works because specialized jobs pay 30 to 100 percent more than generic handyman work, and the customers respect you as an expert.' },

      { type: 'h2', text: 'Charge enough to actually grow' },
      { type: 'p', text: 'A handyman who charges $50 an hour cannot grow. There is no money for marketing, no money for tools, no money to hire a second person. You are stuck.' },
      { type: 'p', text: 'Raise your rate every six months until customers start pushing back. Then back off a bit. Most handymen end up surprised at what the market will pay once they actually ask for it.' },
      { type: 'p', text: 'A target: gross profit per billable hour should be at least 2x your fully-loaded labor cost. If you cost yourself $35 an hour to operate (including tools, vehicle, insurance), you should bill at $70 or more.' },

      { type: 'h2', text: 'Repeat customers are the engine' },
      { type: 'p', text: 'Getting a new customer costs you marketing dollars, time, and stress. Getting a repeat customer costs you nothing. The handymen with the easiest business have built a base of 100 to 200 customers who call them every time something breaks.' },
      { type: 'p', text: 'To build that base:' },
      { type: 'ul', items: [
        'Do excellent work. Obvious but easy to skip when you are rushed.',
        'Follow up. A simple text two weeks after every job: "Hey Mark, just checking the dishwasher is still working great. Let me know if you have any other projects."',
        'Stay top of mind. Send a quarterly email or text to your customer list with seasonal tips or a current offer.',
        'Make it easy to call you again. Leave a magnet on their fridge. Add their address to a recurring "service-due" list.',
      ]},

      { type: 'h2', text: 'When to hire your first employee' },
      { type: 'p', text: 'You know you are ready to hire when:' },
      { type: 'ul', items: [
        'You are turning down work because you do not have hours.',
        'You have a steady backlog of two weeks or more.',
        'You can pay someone $25 to $35 an hour and still make money on their work.',
        'You have a written system for how the work is done so a new person can learn it.',
      ]},
      { type: 'p', text: 'That last one is the hardest. If you do not have systems, your first hire will fail. Document your process before you hire. Even simple checklists make a huge difference.' },

      { type: 'h2', text: 'Marketing on a budget' },
      { type: 'p', text: 'You do not need to spend thousands to grow. The handymen who grow fastest usually focus on three or four channels:' },
      { type: 'ul', items: [
        'Google Business Profile (free, biggest impact).',
        'Reviews (ask every happy customer).',
        'Nextdoor and local Facebook groups (free, slow but high quality leads).',
        'Truck signage (one-time cost, leads for years).',
        'Referrals (incentivize them with a $25 thank-you credit).',
      ]},

      { type: 'h2', text: 'What to stop doing' },
      { type: 'ul', items: [
        'Stop quoting free estimates for huge projects. Charge a small consultation fee. It filters out tire-kickers.',
        'Stop bidding against cheap competitors. Compete on quality, communication, and reliability.',
        'Stop saying yes to every job. Cherry-pick the work that pays well and fits your niche.',
        'Stop doing your own bookkeeping with a shoebox. Get on accounting software or hire someone.',
      ]},

      { type: 'h2', text: 'Closing thought' },
      { type: 'p', text: 'Growing a handyman business is not about working more hours. It is about being more selective, charging more, and turning one-time customers into lifetime customers. The handymen who get to multiple trucks and real income are the ones who treat it like a business from day one.' },
    ],
  },

  {
    slug: 'how-to-increase-profit-margins-service-business',
    category: 'growth',
    title: 'How to Increase Profit Margins in a Service Business',
    description: 'Practical ways to lift profit margins in a field service business without scaring off customers. Pricing, cost control, cross-sell, and the leaks most owners miss.',
    metaTitle: 'How to Increase Profit Margins in a Service Business',
    metaDescription: 'Lift profit margins in your service business with smarter pricing, cost control, cross-sell, and reducing the leaks most contractors miss.',
    publishedAt: '2026-06-17',
    readingTime: '6 min read',
    intro: 'A service business that runs at five percent margin is one slow month away from being out of business. Healthy service businesses run at fifteen to twenty-five percent net margin. Here is how to get there.',
    blocks: [
      { type: 'h2', text: 'Know your true cost per hour' },
      { type: 'p', text: 'Most owners think they know their cost per hour. They are usually wrong, and the error is always in their favor.' },
      { type: 'p', text: 'Real cost per hour includes wages, payroll taxes, workers comp, vehicle, fuel, tools, insurance, software, office costs, and your own time on admin. For a typical solo tech this works out to $40 to $60 per hour fully loaded. For a tech with a truck and benefits it is $60 to $100.' },
      { type: 'p', text: 'If you are billing labor at $90 an hour and your true cost is $85, you are basically breaking even. Then one bad month wipes you out.' },

      { type: 'h2', text: 'Raise prices every year' },
      { type: 'p', text: 'Inflation, fuel, insurance, parts costs. Everything goes up every year. Your prices should too. Five to ten percent annually is normal and customers expect it.' },
      { type: 'p', text: 'The trick is to do it once a year on a set date, communicate it clearly to existing customers, and just move forward. The owners who never raise prices are the ones whose margins shrink every year until they are working for nothing.' },

      { type: 'h2', text: 'Stop discounting' },
      { type: 'p', text: 'Discounts are profit margin you handed away. A 10 percent discount on a $500 job is not just $50 off. It is often half of your gross profit on that job.' },
      { type: 'p', text: 'If you have to compete on price, compete with bundling instead of discounting. A free tune-up with a repair costs you less than a 10 percent off. Customer feels like they got something. You kept your margin.' },

      { type: 'h2', text: 'Cut unprofitable customers' },
      { type: 'p', text: 'Every service business has 5 to 15 percent of customers who are not worth the trouble. They argue every invoice. They request callbacks for problems they caused. They pay late. They give you stress.' },
      { type: 'p', text: 'Run a report on who pays late or pushes back the most. Politely fire them. Refer them to a competitor you do not like. Your margin goes up immediately because you are not absorbing the cost of dealing with them.' },

      { type: 'h2', text: 'Cross-sell maintenance plans' },
      { type: 'p', text: 'Every existing customer is a candidate for an ongoing service agreement. Maintenance plans, recurring service, annual inspections. These accomplish three things:' },
      { type: 'ul', items: [
        'Predictable revenue. You know what is coming in next month.',
        'Higher margin. Repeat customers cost less to serve.',
        'Customer retention. They stay with you because they are already paying for a relationship.',
      ]},
      { type: 'p', text: 'A goal: 20 to 30 percent of revenue should come from recurring or repeat business if you are doing this right.' },

      { type: 'h2', text: 'Reduce no-shows' },
      { type: 'p', text: 'A no-show is two hours of paid labor and fuel with no revenue. If your no-show rate is even 5 percent, that is real money.' },
      { type: 'p', text: 'Confirm every appointment the day before by text. Charge a service call fee that has to be paid before you dispatch on high-risk jobs (out-of-network customers, after-hours calls). Most no-shows disappear when there is some skin in the game.' },

      { type: 'h2', text: 'Watch the small leaks' },
      { type: 'ul', items: [
        'Material waste. Track what you bring back vs what gets used.',
        'Unbilled time. Work you did that never made it to an invoice.',
        'Forgotten line items. Small parts and add-ons that get left off the bill.',
        'Discounting at the truck. The tech who reflexively knocks $50 off to be nice.',
      ]},
      { type: 'p', text: 'These look small one at a time. Add them up across a year and they often equal 5 to 10 percent of revenue. That is straight profit you are throwing away.' },

      { type: 'h2', text: 'Track every dollar' },
      { type: 'p', text: 'You cannot improve margin you do not measure. At minimum, run these reports monthly:' },
      { type: 'ul', items: [
        'Revenue by service category.',
        'Gross margin by job type.',
        'Labor as a percentage of revenue.',
        'Materials as a percentage of revenue.',
        'Outstanding receivables.',
      ]},
      { type: 'p', text: 'You do not need fancy tools. A simple monthly summary in a spreadsheet works. The point is to actually look at it.' },

      { type: 'h2', text: 'Closing thought' },
      { type: 'p', text: 'Profit margin is built in small decisions you make every day. Charge a little more. Cut a little waste. Keep the good customers. Drop the bad ones. Do that consistently for a year and your bottom line transforms.' },
    ],
  },

  {
    slug: 'how-to-get-more-5-star-reviews-contractor',
    category: 'growth',
    title: 'How to Get More 5-Star Reviews as a Contractor',
    description: 'A step-by-step guide to collecting five-star Google reviews that bring in new customers, without sounding pushy or breaking the rules.',
    metaTitle: 'How to Get More 5-Star Reviews as a Contractor',
    metaDescription: 'How contractors can get more five-star Google reviews. When to ask, how to ask, follow-up systems, and what to do about negative reviews.',
    publishedAt: '2026-06-17',
    readingTime: '5 min read',
    intro: 'Reviews are the single biggest lever for local contractors. The contractor with 200 five-star reviews beats the contractor with 12 every time, even if the second one does better work. Here is how to get more of them, legitimately.',
    blocks: [
      { type: 'h2', text: 'Ask every happy customer, every time' },
      { type: 'p', text: 'The reason most contractors have ten reviews is they never ask. The customer leaves happy, drives away, and never thinks about it again. If you ask, most of them will leave a review. If you do not ask, almost none will.' },
      { type: 'p', text: 'The script can be simple. Something like: "Hey Linda, I am glad you are happy with how it turned out. We are a small business and Google reviews really help us. Would you mind taking a minute to leave one? I can text you the link."' },

      { type: 'h2', text: 'Ask at the right moment' },
      { type: 'p', text: 'The best moment to ask is right when the customer is happiest. That is usually:' },
      { type: 'ul', items: [
        'Immediately after they sign off on the work and pay.',
        'A few hours after a complex job, when they have had time to use the result and are still glowing.',
        'The day after a maintenance service that went smoothly.',
      ]},
      { type: 'p', text: 'The worst moment is a week later. The emotional high is gone and the request feels random.' },

      { type: 'h2', text: 'Make it easy' },
      { type: 'p', text: 'Send a direct link to your Google review page. Not your homepage. Not your Facebook. The exact page where they leave the review with one tap.' },
      { type: 'p', text: 'To get your direct link: search your business name on Google, click on your business listing in the right sidebar, click the "Write a review" button, copy the URL. That is what you text or email your customer.' },

      { type: 'h2', text: 'Follow up once, politely' },
      { type: 'p', text: 'Most people mean to leave a review and forget. A single polite follow-up 48 hours later catches a lot of them. Something like:' },
      { type: 'p', text: '"Just bumping this in case you have a sec, Linda. Totally fine if not. Here is the link again: [link]"' },
      { type: 'p', text: 'Do not follow up more than once. Past two reminders you are nagging.' },

      { type: 'h2', text: 'Do not fake reviews' },
      { type: 'p', text: 'It is tempting and a lot of contractors do it. Google catches most of them eventually. When they do, the fake review gets removed and your account can get suspended.' },
      { type: 'p', text: 'It is also illegal in many states. The risk is not worth it. Real reviews earned over a year of asking will outperform fake reviews every time.' },

      { type: 'h2', text: 'Respond to every review' },
      { type: 'p', text: 'Five-star reviews deserve a quick thank-you. Negative reviews deserve a calm, professional response acknowledging the issue and offering to make it right.' },
      { type: 'p', text: 'Future customers read your responses more than they read the reviews. A bad review with a great owner response can actually build more trust than no reviews at all.' },

      { type: 'h2', text: 'What to do about a bad review' },
      { type: 'p', text: 'Take a breath. Wait an hour. Then respond.' },
      { type: 'p', text: 'A good response acknowledges what happened (without disputing facts publicly), apologizes for the experience, and invites them to call so you can fix it. Something like:' },
      { type: 'p', text: '"Hi Sarah, I am sorry your experience was not what we aim for. I would like to understand what happened and make it right. Can you give me a call at 555-1234? Thanks for the feedback."' },
      { type: 'p', text: 'Never argue. Never call the customer out. Future customers are watching, and how you handle complaints says more than the complaint itself.' },

      { type: 'h2', text: 'Make it part of the workflow' },
      { type: 'p', text: 'Review requests get forgotten unless they are built into the close-out process. The job is not done until the tech has asked for the review and sent the link. Some shops automate this with a text that fires when the invoice is marked paid.' },

      { type: 'h2', text: 'Closing thought' },
      { type: 'p', text: 'Five-star reviews compound. Twenty reviews is good. A hundred is dominant. Five hundred is a moat that takes competitors years to catch. Start asking every customer this week and the snowball begins.' },
    ],
  },

  {
    slug: 'jobber-alternative-for-small-contractors',
    category: 'growth',
    title: 'Jobber Alternative for Small Contractors',
    description: 'What to look for in a Jobber alternative if you run a small contracting business. Feature comparison, pricing, and what actually matters at small scale.',
    metaTitle: 'Jobber Alternative for Small Contractors (2026 Guide)',
    metaDescription: 'Looking for a Jobber alternative for your small contracting business? Here is what to compare and how to find software that fits a small crew.',
    publishedAt: '2026-06-17',
    readingTime: '5 min read',
    intro: 'Jobber is a solid product, but it is not the only choice. For a lot of small contractors, the tiered pricing and the features locked behind upgrades end up costing more than they should. Here is how to find an alternative that fits your business.',
    blocks: [
      { type: 'h2', text: 'Why contractors leave Jobber' },
      { type: 'p', text: 'The most common reasons contractors look for an alternative:' },
      { type: 'ul', items: [
        'Pricing climbs as you add users or features you actually need.',
        'Features like online payments, customer portal, and recurring jobs sit behind higher tiers.',
        'It feels overbuilt for a one or two person operation.',
        'The interface feels designed for office staff, not for someone running the business from the truck.',
      ]},

      { type: 'h2', text: 'What to look for in an alternative' },

      { type: 'h3', text: 'Flat pricing with everything included' },
      { type: 'p', text: 'For a small contractor, the last thing you want is tiered features. You should be able to get scheduling, quoting, invoicing, online payments, and customer portal on the entry plan. If the basics are gated, walk away.' },

      { type: 'h3', text: 'Mobile-first design' },
      { type: 'p', text: 'You are running the business from a phone, not a desk. Every feature should work on mobile without being a stripped down version of the desktop experience.' },

      { type: 'h3', text: 'Self-serve signup' },
      { type: 'p', text: 'No demo call required. Sign up, start a trial, see if it fits. Software companies that gate behind a sales call are usually trying to sell you the more expensive plan.' },

      { type: 'h3', text: 'AI insights you can actually use' },
      { type: 'p', text: 'The newer wave of field service software includes business intelligence baked in. Plain English answers about which jobs make you money, which customers pay late, what your average ticket is. Worth looking for.' },

      { type: 'h3', text: 'Real card payments' },
      { type: 'p', text: 'Stripe-powered card payments at standard processing rates (around 2.9 percent + 30 cents). Anything higher than that is the software company taking a cut on top of card fees.' },

      { type: 'h2', text: 'Pricing perspective' },
      { type: 'p', text: 'For a small contractor, the right software runs $30 to $50 per month all-in for a single user. If you are paying more than $100 per month per user for entry-level features, you are overpaying.' },
      { type: 'p', text: 'Pay attention to what gets added on top. SMS messages, online payments, additional users, AI features. Software that charges extra for each of these adds up fast.' },

      { type: 'h2', text: 'What does not actually matter for a small contractor' },
      { type: 'p', text: 'A lot of features in the higher-tier plans look great in a sales demo but you will never use them at small scale:' },
      { type: 'ul', items: [
        'Multi-location dispatch.',
        'Advanced commission structures.',
        'Enterprise integrations (Salesforce, NetSuite).',
        'White-labeled customer portals.',
      ]},
      { type: 'p', text: 'If you are a solo operator or a two-truck crew, focus on the basics that you use every day: scheduling, quoting, invoicing, payments, and customer history. Everything else is window dressing.' },

      { type: 'h2', text: 'Migration is easier than you think' },
      { type: 'p', text: 'Switching software feels scary because of the data. In reality, most field service apps support CSV import for customers, jobs, and invoices. A weekend of setup gets you running on the new platform.' },
      { type: 'p', text: 'The bigger lift is changing the habit. Stick with the new app for a full month before you decide. The first two weeks will feel awkward. By week four you will not want to go back.' },

      { type: 'h2', text: 'Closing thought' },
      { type: 'p', text: 'You do not have to use the most popular tool. You have to use the one that fits your business. For small contractors, the right answer is usually simpler and cheaper than what the big platforms try to sell you.' },
    ],
  },

  {
    slug: 'best-field-service-software-small-business',
    category: 'growth',
    title: 'Best Field Service Software for Small Business',
    description: 'How to evaluate field service software for a small business. What features actually matter, common pricing traps, and what to skip at small scale.',
    metaTitle: 'Best Field Service Software for Small Business (2026)',
    metaDescription: 'A practical guide to picking field service software for a small business. Features that matter, pricing traps to avoid, and what to skip at small scale.',
    publishedAt: '2026-06-17',
    readingTime: '6 min read',
    intro: 'There are a hundred field service software options on the market. Most of them are built for businesses much bigger than yours. Here is how to cut through the noise and pick one that actually fits a small operation.',
    blocks: [
      { type: 'h2', text: 'Start with what you actually need' },
      { type: 'p', text: 'Before you compare features, write down the three or four things you genuinely need software to do. For most small contractors that list looks like:' },
      { type: 'ul', items: [
        'Schedule jobs in one place that the whole crew can see.',
        'Send professional quotes and convert them to jobs.',
        'Send invoices and get paid (ideally with card payments).',
        'Track customers and job history.',
      ]},
      { type: 'p', text: 'Everything else is nice to have. If a tool nails the four basics on a single price plan, that is probably your answer. If a tool has fifty features but the basics live behind a higher tier, keep looking.' },

      { type: 'h2', text: 'Features that actually matter at small scale' },

      { type: 'h3', text: 'Mobile-first interface' },
      { type: 'p', text: 'You are running the business from a phone. Test the mobile app before you commit. If the mobile experience feels like an afterthought, you will hate it within a month.' },

      { type: 'h3', text: 'On-site quoting' },
      { type: 'p', text: 'Building a quote in 60 seconds and sending it for digital signature on the truck is one of the highest-impact things software can do. Customers say yes more often when you quote in person.' },

      { type: 'h3', text: 'Card payments built in' },
      { type: 'p', text: 'Stripe-powered card payments at standard rates (around 2.9 percent + 30 cents). The invoice auto-marks paid when the customer pays online. Cash flow improves measurably.' },

      { type: 'h3', text: 'Customer history at a tap' },
      { type: 'p', text: 'Open the customer record. See every job, every quote, every invoice, every photo. This is what makes you look professional when a customer calls about a problem from two years ago.' },

      { type: 'h3', text: 'CSV import' },
      { type: 'p', text: 'You have data somewhere already, whether in QuickBooks or a spreadsheet. The software should be able to import it without you re-entering everything by hand.' },

      { type: 'h2', text: 'Pricing traps to watch for' },
      { type: 'ul', items: [
        'Per-user pricing that scales fast as you add a foreman or part-time helper.',
        'Per-text or per-email charges on top of the subscription.',
        'Card processing rates above standard Stripe pricing.',
        'Add-ons for features that should be standard (recurring jobs, customer portal, online payments).',
        'Annual contracts you cannot get out of.',
      ]},

      { type: 'h2', text: 'What you do not need at small scale' },
      { type: 'p', text: 'Skip these in the evaluation. They sound great in a demo but they are not used by small businesses:' },
      { type: 'ul', items: [
        'Multi-warehouse inventory.',
        'Advanced commission structures.',
        'Enterprise-grade integrations.',
        'Predictive maintenance AI for industrial equipment.',
        'White-labeled portals you cannot fully customize.',
      ]},

      { type: 'h2', text: 'How to evaluate before you commit' },
      { type: 'p', text: 'A 14-day trial is enough if you actually use the tool. To pressure-test a field service app in two weeks:' },
      { type: 'ol', items: [
        'Import your customer list. Did it work cleanly?',
        'Send three real quotes through the system.',
        'Schedule and complete three real jobs.',
        'Send three invoices and collect payment.',
        'Pull up the reports. Are they useful?',
      ]},
      { type: 'p', text: 'If you make it through that loop and you are not annoyed, you have your software. If anything along the way is painful, you have your answer.' },

      { type: 'h2', text: 'Total cost over a year' },
      { type: 'p', text: 'Calculate the real annual cost before you sign up. Include the subscription, the per-user fees, the SMS costs, the card processing markup, and any add-ons. For a single user, the right answer is usually under $600 a year all-in.' },

      { type: 'h2', text: 'Closing thought' },
      { type: 'p', text: 'The best field service software for a small business is the one you actually use every day. Pick the simplest tool that covers the four basics, commit to it for ninety days, and stop shopping. The wins come from consistency, not from finding the perfect tool.' },
    ],
  },

  {
    slug: 'how-to-run-a-contracting-business-from-your-phone',
    category: 'growth',
    title: 'How to Run a Contracting Business From Your Phone',
    description: 'What is actually possible to run from a phone, the apps you need, the workflows that work, and the limits to be aware of.',
    metaTitle: 'How to Run a Contracting Business From Your Phone',
    metaDescription: 'A practical guide to running a contracting business entirely from your phone. The apps, workflows, and limits that make it possible in 2026.',
    publishedAt: '2026-06-17',
    readingTime: '6 min read',
    intro: 'You can run a small contracting business almost entirely from your phone in 2026. Most of the contractors who do it ended up there by accident, then realized they never went back to the office. Here is what that actually looks like.',
    blocks: [
      { type: 'h2', text: 'What is genuinely possible' },
      { type: 'p', text: 'On a phone with a good field service app, a good email client, and an accounting app, you can:' },
      { type: 'ul', items: [
        'Take a phone call and book a customer onto the schedule in 30 seconds.',
        'Quote a job on site, get a digital signature, and convert to a work order.',
        'Look up any customer\'s entire history in two taps.',
        'Take payment by card before you leave the driveway.',
        'Send invoices and follow up on overdue payments automatically.',
        'See your week, your month, your numbers, your team.',
        'File your taxes (or hand a clean export to your accountant).',
      ]},
      { type: 'p', text: 'None of this requires a desktop computer anymore.' },

      { type: 'h2', text: 'The apps you actually need' },
      { type: 'p', text: 'Three or four well-chosen apps cover almost everything:' },

      { type: 'h3', text: 'Field service app' },
      { type: 'p', text: 'Schedule, quotes, invoices, customers, payments, time tracking. This is the workhorse. Pick one that is mobile-first, not a stripped-down version of a desktop tool.' },

      { type: 'h3', text: 'Accounting app' },
      { type: 'p', text: 'QuickBooks, Xero, or Wave. Connects to your bank. Tracks expenses. Generates tax reports. Most field service apps integrate with at least one of these so you are not double-entering.' },

      { type: 'h3', text: 'Email and messaging' },
      { type: 'p', text: 'Gmail or Outlook plus your text app handle most customer communication. Keep customer messages in the field service app where possible so you have history. Use email for documents and longer back-and-forth.' },

      { type: 'h3', text: 'Cloud storage' },
      { type: 'p', text: 'Google Drive or Dropbox for permits, licenses, insurance docs, contracts, anything you need to access on the road.' },

      { type: 'h2', text: 'A typical phone-run day' },
      { type: 'ol', items: [
        'Morning: check the day\'s schedule and send the crew their assignments before leaving the house.',
        'On the way to the first job: review the customer history and confirm parts needed.',
        'On site: log arrival, do the work, take before-after photos, build the quote or write up the work, get a signature.',
        'Between jobs: send the invoice, collect payment, respond to a couple of text inquiries, book a new lead onto next week\'s calendar.',
        'End of day: a five minute review. Anything left undone? Tomorrow\'s schedule confirmed?',
      ]},
      { type: 'p', text: 'Twenty years ago this was a job that needed an office, a receptionist, and a billing person. Today it fits in your pocket.' },

      { type: 'h2', text: 'Workflows that make this work' },

      { type: 'h3', text: 'Invoice before you leave' },
      { type: 'p', text: 'Single biggest cash flow improvement most contractors can make. Build the invoice on site, take payment if possible, mark it paid. You walk away with money in the bank instead of paperwork on the dashboard.' },

      { type: 'h3', text: 'Quote on site, not later' },
      { type: 'p', text: 'Customers say yes more often when you quote in person. Quote in 60 seconds, send for digital signature, lock in the job. The "I will email you a quote" approach loses jobs.' },

      { type: 'h3', text: 'Photo every job' },
      { type: 'p', text: 'Before and after, attached to the customer record. Saves you on warranty disputes a year later and gives you marketing content for free.' },

      { type: 'h2', text: 'Where phones still have limits' },
      { type: 'p', text: 'A few things are still painful on a phone:' },
      { type: 'ul', items: [
        'Long quotes with many line items are easier on a tablet or laptop.',
        'Reviewing detailed financial reports needs more screen.',
        'Filling out long forms (insurance applications, government filings) is faster on a real keyboard.',
        'Image editing for marketing.',
      ]},
      { type: 'p', text: 'For most of these, an iPad or a cheap laptop in the truck handles the gap. You do not need a real office. You just need a slightly bigger screen for the few things a phone is bad at.' },

      { type: 'h2', text: 'What this does for your life' },
      { type: 'p', text: 'A phone-run business means:' },
      { type: 'ul', items: [
        'No office overhead.',
        'No commute to a desk to do paperwork at night.',
        'You can run the business from a vacation if you want to.',
        'New hires get up to speed faster because everything is in the app.',
        'Customers get faster service because you are responsive in real time.',
      ]},

      { type: 'h2', text: 'Closing thought' },
      { type: 'p', text: 'A contracting business does not have to live in a back office anymore. The right software and a phone you already carry can run almost the whole thing. The contractors who figure this out early get their nights and weekends back.' },
    ],
  },
];

export const POST_BY_SLUG = BLOG_POSTS.reduce((acc, p) => {
  acc[p.slug] = p;
  return acc;
}, {});

export function postsByCategory(category) {
  return BLOG_POSTS.filter(p => p.category === category);
}
