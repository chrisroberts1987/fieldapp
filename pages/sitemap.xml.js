import { BLOG_POSTS } from '../lib/blog-posts';

// Dynamic sitemap generated on request. Lists every public,
// indexable marketing route. Authenticated app routes
// (/dashboard, /jobs, /invoices, etc.), guest-token routes
// (/portal/[token], /inv/[token]), API endpoints, and auth
// pages (/login, /signup, /reset) are intentionally excluded.

const BASE = 'https://myforemanhq.com';

const PAGES = [
  // Homepage + hubs
  { path: '/',                                  priority: '1.0', changefreq: 'weekly' },
  { path: '/contractor-software',               priority: '0.9', changefreq: 'weekly' },
  { path: '/compare',                           priority: '0.9', changefreq: 'weekly' },

  // Trade pages
  { path: '/hvac-software',                     priority: '0.8', changefreq: 'monthly' },
  { path: '/plumbing-software',                 priority: '0.8', changefreq: 'monthly' },
  { path: '/electrical-contractor-software',    priority: '0.8', changefreq: 'monthly' },
  { path: '/handyman-software',                 priority: '0.8', changefreq: 'monthly' },
  { path: '/landscaping-software',              priority: '0.8', changefreq: 'monthly' },
  { path: '/roofing-software',                  priority: '0.8', changefreq: 'monthly' },
  { path: '/painting-contractor-software',      priority: '0.8', changefreq: 'monthly' },
  { path: '/pressure-washing-software',         priority: '0.8', changefreq: 'monthly' },
  { path: '/pest-control-software',             priority: '0.8', changefreq: 'monthly' },
  { path: '/pool-service-software',             priority: '0.8', changefreq: 'monthly' },
  { path: '/garage-door-software',              priority: '0.8', changefreq: 'monthly' },
  { path: '/locksmith-software',                priority: '0.8', changefreq: 'monthly' },
  { path: '/carpet-cleaning-software',          priority: '0.8', changefreq: 'monthly' },
  { path: '/appliance-repair-software',         priority: '0.8', changefreq: 'monthly' },
  { path: '/window-cleaning-software',          priority: '0.8', changefreq: 'monthly' },
  { path: '/chimney-sweep-software',            priority: '0.8', changefreq: 'monthly' },
  { path: '/junk-removal-software',             priority: '0.8', changefreq: 'monthly' },
  { path: '/moving-company-software',           priority: '0.8', changefreq: 'monthly' },
  { path: '/flooring-contractor-software',      priority: '0.8', changefreq: 'monthly' },
  { path: '/fencing-contractor-software',       priority: '0.8', changefreq: 'monthly' },

  // Competitor comparison pages
  { path: '/jobber-alternative',                priority: '0.8', changefreq: 'monthly' },
  { path: '/housecall-pro-alternative',         priority: '0.8', changefreq: 'monthly' },
  { path: '/servicetitan-alternative',          priority: '0.8', changefreq: 'monthly' },
  { path: '/invoice-simple-alternative',        priority: '0.8', changefreq: 'monthly' },
  { path: '/fieldpulse-alternative',            priority: '0.8', changefreq: 'monthly' },
  { path: '/workiz-alternative',                priority: '0.8', changefreq: 'monthly' },
  { path: '/razorsync-alternative',             priority: '0.8', changefreq: 'monthly' },
  { path: '/service-fusion-alternative',        priority: '0.8', changefreq: 'monthly' },
  { path: '/joist-alternative',                 priority: '0.8', changefreq: 'monthly' },

  // Blog
  { path: '/blog',                              priority: '0.9', changefreq: 'weekly' },

  // Supporting marketing pages
  { path: '/contact',                           priority: '0.5', changefreq: 'yearly' },
  { path: '/privacy',                           priority: '0.3', changefreq: 'yearly' },
  { path: '/terms',                             priority: '0.3', changefreq: 'yearly' },
];

// Blog posts auto-included from the post data module so adding a new
// post to lib/blog-posts.js automatically lands in the sitemap.
const BLOG_PAGES = BLOG_POSTS.map(p => ({
  path: `/blog/${p.slug}`,
  priority: '0.7',
  changefreq: 'monthly',
  lastmod: p.publishedAt,
}));

function buildXml(today) {
  const all = [...PAGES, ...BLOG_PAGES];
  const urls = all.map(p => (
    `  <url>\n` +
    `    <loc>${BASE}${p.path}</loc>\n` +
    `    <lastmod>${p.lastmod || today}</lastmod>\n` +
    `    <changefreq>${p.changefreq}</changefreq>\n` +
    `    <priority>${p.priority}</priority>\n` +
    `  </url>`
  )).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n` +
    `</urlset>\n`;
}

export async function getServerSideProps({ res }) {
  const today = new Date().toISOString().slice(0, 10);
  const xml = buildXml(today);
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.write(xml);
  res.end();
  return { props: {} };
}

export default function Sitemap() {
  return null;
}
