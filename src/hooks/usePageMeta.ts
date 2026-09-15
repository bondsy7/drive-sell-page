import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description: string;
  canonicalPath?: string;
  noIndex?: boolean;
}

function upsertMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Setzt Title, Description, OpenGraph-Grunddaten und Canonical für öffentliche Funnel-Seiten. */
export function usePageMeta({ title, description, canonicalPath, noIndex }: PageMeta) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    upsertMeta('meta[name="description"]', 'name', 'description', description);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);

    if (noIndex) {
      upsertMeta('meta[name="robots"]', 'name', 'robots', 'noindex, nofollow');
    } else {
      document.head.querySelector('meta[name="robots"]')?.remove();
    }

    if (canonicalPath) {
      const href = `${window.location.origin}${canonicalPath}`;
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = href;
      upsertMeta('meta[property="og:url"]', 'property', 'og:url', href);
    }

    return () => {
      document.title = previousTitle;
    };
  }, [title, description, canonicalPath, noIndex]);
}
