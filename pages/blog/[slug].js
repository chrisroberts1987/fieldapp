import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import BlogLayout, { BLOG_COLORS as C } from '../../components/BlogLayout';
import { BLOG_POSTS, POST_BY_SLUG, CATEGORIES } from '../../lib/blog-posts';

// Renders a single blog post. Body content is a list of typed blocks
// (p, h2, h3, ul, ol) defined in lib/blog-posts.js. Every post ends
// with the same MyForeman CTA so it always closes the article.

export async function getStaticPaths() {
  return {
    paths: BLOG_POSTS.map(p => ({ params: { slug: p.slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const post = POST_BY_SLUG[params.slug];
  if (!post) return { notFound: true };

  // Related posts: same category, exclude self, max 3.
  const related = BLOG_POSTS
    .filter(p => p.category === post.category && p.slug !== post.slug)
    .slice(0, 3);

  return { props: { post, related } };
}

export default function BlogPost({ post, related }) {
  const router = useRouter();
  const cat = CATEGORIES[post.category];
  const canonical = `https://myforemanhq.com/blog/${post.slug}`;
  const ogImage = `https://myforemanhq.com/api/og?title=${encodeURIComponent(post.title)}&eyebrow=${encodeURIComponent(cat.label)}`;

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.metaDescription || post.description,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: { '@type': 'Organization', name: 'MyForeman' },
    publisher: {
      '@type': 'Organization',
      name: 'MyForeman',
      logo: { '@type': 'ImageObject', url: 'https://myforemanhq.com/icons/icon-512.png' },
    },
    image: ogImage,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  };

  return (
    <BlogLayout>
      <Head>
        <title>{post.metaTitle || post.title}</title>
        <meta name="description" content={post.metaDescription || post.description}/>
        <meta property="og:title" content={post.metaTitle || post.title}/>
        <meta property="og:description" content={post.metaDescription || post.description}/>
        <meta property="og:type" content="article"/>
        <meta property="og:url" content={canonical}/>
        <meta property="og:image" content={ogImage}/>
        <meta property="og:image:width" content="1200"/>
        <meta property="og:image:height" content="630"/>
        <meta name="twitter:card" content="summary_large_image"/>
        <meta name="twitter:title" content={post.metaTitle || post.title}/>
        <meta name="twitter:description" content={post.metaDescription || post.description}/>
        <meta name="twitter:image" content={ogImage}/>
        <link rel="canonical" href={canonical}/>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
        />
      </Head>

      <article style={{paddingTop:100,paddingBottom:30}}>
        <div className="blog-container">
          {/* Breadcrumb */}
          <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:C.muted,marginBottom:20}}>
            <Link href="/blog" style={{color:C.muted}}>Blog</Link>
            <span>/</span>
            <span style={{color:cat.color,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',fontSize:11}}>{cat.label}</span>
          </div>

          {/* Title */}
          <h1 className="blog-h1">{post.title}</h1>

          {/* Meta row */}
          <div style={{display:'flex',gap:14,alignItems:'center',marginBottom:30,fontSize:13,color:C.muted,flexWrap:'wrap'}}>
            <span>{formatDate(post.publishedAt)}</span>
            <span style={{color:C.borderHi}}>·</span>
            <span>{post.readingTime}</span>
          </div>

          {/* Intro */}
          {post.intro && (
            <p style={{
              fontSize:19,lineHeight:1.6,color:C.subtext,
              borderLeft:`3px solid ${cat.color}`,
              paddingLeft:18,margin:'0 0 36px',
              fontWeight:500,
            }}>
              {post.intro}
            </p>
          )}

          {/* Body */}
          <div>
            {post.blocks.map((block, i) => renderBlock(block, i))}
          </div>

          {/* MyForeman CTA */}
          <div style={{
            marginTop:50,padding:'28px 24px',
            background:`linear-gradient(145deg, #1a2a48, #152038)`,
            border:`1.5px solid rgba(79,158,255,0.45)`,
            borderRadius:14,
            boxShadow:'0 0 40px rgba(79,158,255,0.10)',
            textAlign:'center',
          }}>
            <h3 style={{
              fontFamily:"'Bebas Neue', Impact, sans-serif",
              fontSize:28,letterSpacing:'.04em',
              color:C.text,margin:'0 0 8px',
            }}>
              Manage your business with MyForeman.
            </h3>
            <p style={{fontSize:15,color:C.subtext,margin:'0 0 18px',lineHeight:1.55}}>
              Try it free at <span style={{color:C.blue,fontWeight:700}}>myforemanhq.com</span>. 14-day trial, no credit card required.
            </p>
            <button onClick={() => router.push('/signup')} style={{
              background:`linear-gradient(135deg, ${C.blue}, ${C.blueDeep})`,
              color:'#fff',border:'none',borderRadius:12,
              padding:'14px 28px',fontWeight:800,letterSpacing:'.06em',
              fontSize:14,textTransform:'uppercase',
              boxShadow:'0 8px 32px rgba(79,158,255,0.4)',
            }}>Start Free Trial</button>
          </div>
        </div>
      </article>

      {/* Related posts */}
      {related.length > 0 && (
        <section style={{padding:'40px 0 20px'}}>
          <div style={{maxWidth:1100,margin:'0 auto',padding:'0 24px'}}>
            <div style={{fontSize:11,fontWeight:800,letterSpacing:'.22em',textTransform:'uppercase',color:cat.color,marginBottom:18}}>
              More on {cat.label}
            </div>
            <div className="blog-grid" style={{
              display:'grid',
              gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))',
              gap:16,
            }}>
              {related.map(r => (
                <Link key={r.slug} href={`/blog/${r.slug}`} className="blog-card" style={{display:'flex',flexDirection:'column'}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:cat.color,marginBottom:8}}>
                    {r.readingTime}
                  </div>
                  <h3 style={{
                    fontFamily:"'Inter',system-ui,sans-serif",
                    fontSize:18,fontWeight:800,lineHeight:1.3,
                    color:C.text,margin:'0 0 6px',
                  }}>{r.title}</h3>
                  <p style={{fontSize:13,color:C.subtext,lineHeight:1.55,margin:'0 0 12px',flex:1}}>{r.description}</p>
                  <div style={{fontSize:13,fontWeight:700,color:C.blue}}>Read article →</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </BlogLayout>
  );
}

function renderBlock(block, key) {
  if (block.type === 'h2') return <h2 key={key} className="blog-h2">{block.text}</h2>;
  if (block.type === 'h3') return <h3 key={key} className="blog-h3">{block.text}</h3>;
  if (block.type === 'p')  return <p key={key} className="blog-p">{block.text}</p>;
  if (block.type === 'ul') return (
    <ul key={key} className="blog-ul">
      {block.items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
  if (block.type === 'ol') return (
    <ol key={key} className="blog-ol">
      {block.items.map((it, i) => <li key={i}>{it}</li>)}
    </ol>
  );
  return null;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
