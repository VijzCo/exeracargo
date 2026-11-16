import type { ReactNode } from 'react';

export default function PageHeader({ eyebrow, title, sub, children }: { eyebrow?: string; title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header-bg" aria-hidden="true" />
      <div className="container">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="h1" style={{ fontSize: 'clamp(2rem, 4.6vw, 3.4rem)' }}>
          {title}
        </h1>
        {sub && (
          <p className="lead" style={{ marginTop: 14 }}>
            {sub}
          </p>
        )}
        {children}
      </div>
    </header>
  );
}
