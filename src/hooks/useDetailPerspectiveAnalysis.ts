import { useEffect, useRef, useState } from 'react';
import { supabaseAnalyzerPort, type ReferenceV2AnalyzerPort, type ReferenceV2FileReference } from '@/features/reference-v2/phase1-5/provider-adapter';
import { normalizeReferenceFile } from '@/features/reference-v2/phase1-5/normalize-reference-file';
import { resolveDetailPerspective } from '@/lib/detail-perspective-analysis';

export interface DetailAnalysisState {
  status: 'analyzing' | 'analyzed' | 'uncertain' | 'unavailable';
  label?: string;
  file?: ReferenceV2FileReference;
}

/** Original detail intake only; never invokes a remaster or changes a manual assignment. */
export function useDetailPerspectiveAnalysis(images: string[], enabled: boolean, port: ReferenceV2AnalyzerPort = supabaseAnalyzerPort) {
  const [results, setResults] = useState<Record<string, DetailAnalysisState>>({});
  const [automaticRoles, setAutomaticRoles] = useState<Record<string, string>>({});
  const attempted = useRef(new Set<string>());
  const pending = useRef<string[]>([]);
  const active = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    for (const image of images) {
      if (attempted.current.has(image)) continue;
      attempted.current.add(image);
      pending.current.push(image);
      setResults(prev => ({ ...prev, [image]: { status: 'analyzing' } }));
    }
    const pump = () => {
      while (mounted.current && active.current < 2 && pending.current.length) {
        const image = pending.current.shift();
        if (!image) return;
        active.current += 1;
        void (async () => {
          let file: ReferenceV2FileReference | undefined;
          try {
            const blob = await (await fetch(image)).blob();
            const normalized = await normalizeReferenceFile(new File([blob], 'detail.jpg', { type: blob.type }));
            file = await port.uploadFile(normalized);
            const { response } = await port.analyze({ file, anchorFiles: [] });
            const { role, label } = resolveDetailPerspective(response);
            if (!mounted.current) return;
            setResults(prev => ({ ...prev, [image]: { status: role ? 'analyzed' : 'uncertain', label, file } }));
            if (role) setAutomaticRoles(prev => ({ ...prev, [image]: role }));
          } catch {
            if (mounted.current) setResults(prev => ({ ...prev, [image]: { status: 'unavailable', file } }));
          } finally {
            active.current -= 1;
            pump();
          }
        })();
      }
    };
    pump();
  }, [images, enabled, port]);
  return { results, automaticRoles };
}