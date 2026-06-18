import Head from 'next/head';
import Link from 'next/link';
import BlogLayout, { BLOG_COLORS as C } from '../../components/BlogLayout';
import { BLOG_POSTS, CATEGORIES } from '../../lib/blog-posts';

// Blog index. Lists all 15 posts grouped by category. Each post card
// links to /blog/[slug] for the full article.

export default function BlogIndex() {
  const byCategory = Object.keys(CATEGORIES).map(key => ({
    key,
    label: CATEGORIES[key].label,
    color: CATEGORIES[key].color,
    posts: BLOG_POSTS.filter(p => p.category === key),
  }));

  const ogImage = 'https://myforemanhq.com/api/og?title=MyForeman+Blog&eyebrow=Contractor+Advice';

  return (
    <BlogLayout>
      <Head>
        <title>MyForeman Blog | Practical Advice for Contractors</title>
        <meta name="description" content="Pricing guides, operations tips, and growth advice for contractors and field service businesses. Written for the people running the trucks."/>
        <meta property="og:title" content="MyForeman Blog | Practical Advice for Contractors"/>
        <meta property="og:description" content="Pricing guides, operations tips, and growth advice for contractors and field service businesses."/>
        <meta property="og:type" content="website"/>
        <meta property="og:url" content="https://myforemanhq.com/blog"/>
        <meta property="og:image" content={ogImage}/>
        <meta property="og:image:width" content="1200"/>
        <meta property="og:image:height" content="630"/>
        <meta name="twitter:card" content="summary_large_image"/>
        <meta name="twitter:title" content="MyForeman Blog | Practical Advice for Contractors"/>
        <meta name="twitter:description" content="Pricing guides, operations tips, and growth advice for contractors and field service businesses."/>
        <meta name="twitter:image" content={ogImage}/>
        <link rel="canonical" href="https://myforemanhq.com/blog"/>
      </Head>

      <section style={{paddingTop:120,paddingBottom:30,textAlign:'center'}}>
        <div className="blog-container">
          <div style={{fontSize:11,fontWeight:800,letterSpacing:'.22em',textTransform:'uppercase',color:C.blue,marginBottom:14}}>
            The MyForeman Blog
          </div>
          <h1 className="blog-h1" style={{fontSize:'clamp(40px, 5.5vw, 64px)'}}>
            Honest advice on pricing, operations, and growth.
          </h1>
          <p className="blog-p" style={{maxWidth:600,margin:'14px auto 0',fontSize:18}}>
            Pricing math, operations tips, and growth playbooks for handymen, HVAC, plumbing, electrical, and every field service trade. No fluff, no jargon, no twenty-paragraph intros.
          </p>
        </div>
      </section>

      {byCategory.map(cat => (
        <section key={cat.key} style={{padding:'40px 0'}}>
          <div style={{maxWidth:1100,margin:'0 auto',padding:'0 24px'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
              <div style={{
                width:10,height:10,borderRadius:5,background:cat.color,
              }}/>
              <div style={{
                fontSize:11,fontWeight:800,letterSpacing:'.22em',
                textTransform:'uppercase',color:cat.color,
              }}>{cat.label}</div>
            </div>
            <div className="blog-grid" style={{
              display:'grid',
              gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))',
              gap:16,
            }}>
              {cat.posts.map(post => (
                <Link key={post.slug} href={`/blog/${post.slug}`} className="blog-card" style={{display:'flex',flexDirection:'column'}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:cat.color,marginBottom:8}}>
                    {cat.label} · {post.readingTime}
                  </div>
                  <h2 style={{
                    fontFamily:"'Inter',system-ui,sans-serif",
                    fontSize:20,fontWeight:800,lineHeight:1.3,
                    color:C.text,margin:'0 0 8px',
                  }}>{post.title}</h2>
                  <p style={{fontSize:14,color:C.subtext,lineHeight:1.55,margin:'0 0 14px',flex:1}}>{post.description}</p>
                  <div style={{fontSize:13,fontWeight:700,color:C.blue}}>Read article →</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section style={{padding:'70px 0 30px',textAlign:'center'}}>
        <div className="blog-container">
          <h2 className="blog-h2" style={{fontSize:'clamp(28px, 4vw, 42px)',margin:'0 0 12px'}}>
            Ready to put it into practice?
          </h2>
          <p className="blog-p" style={{maxWidth:520,margin:'0 auto 20px'}}>
            Manage your business with MyForeman. Try it free at myforemanhq.com.
          </p>
          <Link href="/signup" style={{
            display:'inline-block',
            background:`linear-gradient(135deg, ${C.blue}, ${C.blueDeep})`,
            color:'#fff',fontWeight:800,letterSpacing:'.06em',
            textTransform:'uppercase',borderRadius:12,
            padding:'14px 28px',fontSize:14,
            boxShadow:'0 8px 32px rgba(79,158,255,0.4)',
          }}>Start Free Trial</Link>
        </div>
      </section>
    </BlogLayout>
  );
}
