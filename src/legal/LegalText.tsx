// Renders the "Markdown-lite" used by the legal documents (no HTML injection: plain React nodes).
import type { ReactNode } from 'react';

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  );
}

export function LegalText({ body }: { body: string }) {
  const blocks = body.trim().split(/\n\s*\n/);
  return (
    <div className="legal-text">
      {blocks.map((b, i) => {
        const lines = b.split('\n').map((l) => l.trimEnd());
        if (lines[0].startsWith('## ')) {
          const rest = lines.slice(1).join('\n').trim();
          return (
            <div key={i}>
              <h3>{lines[0].slice(3)}</h3>
              {rest ? <LegalText body={rest} /> : null}
            </div>
          );
        }
        if (lines.every((l) => l.startsWith('- '))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.slice(2))}</li>
              ))}
            </ul>
          );
        }
        // paragraph possibly followed by bullets
        const firstBullet = lines.findIndex((l) => l.startsWith('- '));
        if (firstBullet > 0) {
          return (
            <div key={i}>
              <p>{inline(lines.slice(0, firstBullet).join(' '))}</p>
              <ul>
                {lines.slice(firstBullet).map((l, j) => (
                  <li key={j}>{inline(l.replace(/^- /, ''))}</li>
                ))}
              </ul>
            </div>
          );
        }
        return <p key={i}>{inline(lines.join(' '))}</p>;
      })}
    </div>
  );
}
