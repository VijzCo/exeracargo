import { Fragment, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTenant } from '../tenant/TenantProvider';
import { InsightArt, InsightCard, Cta } from '../components/sections';
import { Icon } from '../components/Icon';
import { useReveal } from '../lib/hooks';
import NotFound from './NotFound';
import { cssUrl } from '../lib/url';

/** Minimal safe renderer: "## " headings, "- " bullets, blank-line paragraphs. No HTML injection. */
function renderBody(body: string): ReactNode[] {
  const blocks = body.replace(/\r/g, '').split(/\n{2,}|\n(?=## )/);
  const out: ReactNode[] = [];
  blocks.forEach((raw, i) => {
    const lines = raw.split('\n').filter((l) => l.trim());
    if (!lines.length) return;
    let buf: string[] = [];
    const flushP = (k: string) => {
      if (buf.length) out.push(<p key={k}>{buf.join(' ')}</p>);
      buf = [];
    };
    let bullets: string[] = [];
    const flushUl = (k: string) => {
      if (bullets.length)
        out.push(
          <ul key={k}>
            {bullets.map((b, j) => (
              <li key={j}>{b}</li>
            ))}
          </ul>,
        );
      bullets = [];
    };
    lines.forEach((l, j) => {
      const key = `${i}-${j}`;
      if (l.startsWith('## ')) {
        flushP(`p${key}`);
        flushUl(`u${key}`);
        out.push(<h2 key={`h${key}`}>{l.slice(3)}</h2>);
      } else if (l.startsWith('- ')) {
        flushP(`p${key}`);
        bullets.push(l.slice(2));
      } else {
        flushUl(`u${key}`);
        buf.push(l);
      }
    });
    flushP(`pe${i}`);
    flushUl(`ue${i}`);
  });
  return out;
}

export default function InsightArticle() {
  const { slug } = useParams();
  const { tenant, t } = useTenant();
  const a = tenant.insights.find((x) => x.slug === slug);
  const ref = useReveal<HTMLDivElement>([slug]);
  if (!a) return <NotFound />;
  const more = tenant.insights.filter((x) => x.id !== a.id).slice(0, 3);
  return (
    <div ref={ref}>
      <article className="article">
        <div className="container article-head">
          <Link to="/insights" className="small muted row" style={{ ['--gap' as string]: '6px' }}>
            <Icon name="arrow" size={14} style={{ transform: 'rotate(180deg)' }} /> {t('insights.title')}
          </Link>
          <span className="badge" style={{ marginTop: 20 }}>
            {a.category}
          </span>
          <h1 className="h1" style={{ fontSize: 'clamp(2rem, 4.4vw, 3.2rem)', marginTop: 14 }}>
            {a.title}
          </h1>
          <p className="lead" style={{ marginTop: 14 }}>
            {a.excerpt}
          </p>
          <p className="small muted" style={{ marginTop: 14 }}>
            {new Date(a.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · {a.readMins} {t('common.minRead')}
          </p>
        </div>
        <div className="container">
          <div className="article-cover" style={cssUrl(a.coverUrl) ? { backgroundImage: cssUrl(a.coverUrl) } : undefined}>
            {!cssUrl(a.coverUrl) && <InsightArt category={a.category} />}
          </div>
          <div className="prose">
            {renderBody(a.body).map((n, i) => (
              <Fragment key={i}>{n}</Fragment>
            ))}
          </div>
        </div>
      </article>
      {more.length > 0 && (
        <section className="section">
          <div className="container">
            <h2 className="h2" style={{ marginBottom: 28 }}>
              More insights
            </h2>
            <div className="grid" style={{ ['--min' as string]: '300px' }}>
              {more.map((m) => (
                <InsightCard key={m.id} a={m} />
              ))}
            </div>
          </div>
        </section>
      )}
      <Cta />
    </div>
  );
}
