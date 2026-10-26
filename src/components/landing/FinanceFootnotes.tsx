import type { FinanceFootnote } from '@/lib/finance-footnotes';
import { toSuperscript } from '@/lib/finance-footnotes';

/** Shared by the editor and the HTML export (renderToStaticMarkup). */
export const DEFAULT_FINANCE_TITLE = 'Finanzierungsbeispiele gem. § 17 PAngV';

export default function FinanceFootnotes({ notes, title }: { notes: FinanceFootnote[]; title?: string }) {
  if (!notes.length) return null;
  return <section id="lp-finanzierung" style={{ background: '#fff', borderTop: '1px solid var(--lp-border)', padding: '32px 0' }}>
    <div className="lp-content-width" style={{ fontSize: 11, lineHeight: 1.6, color: '#64748b' }}>
      <p style={{ fontWeight: 600, color: '#334155', marginBottom: 8 }}>{title?.trim() || DEFAULT_FINANCE_TITLE}</p>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
        {notes.map(n => <li key={n.number} id={`lp-fin-${n.number}`}><span style={{ fontWeight: 600 }}>{toSuperscript(n.number)}</span> {n.text}</li>)}
      </ol>
    </div>
  </section>;
}
