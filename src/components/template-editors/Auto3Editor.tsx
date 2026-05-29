import React from 'react';
import ModernEditor from './ModernEditor';
import type { TemplateEditorProps } from './types';
import { Palette, RotateCcw } from 'lucide-react';

const PRESETS: Array<{ label: string; accent: string; dark: string }> = [
  { label: 'Auto3 Rot', accent: '#e30613', dark: '#111111' },
  { label: 'Petrol-Blau', accent: '#174f6b', dark: '#0f172a' },
  { label: 'Forest', accent: '#0b6b3a', dark: '#1c1c1c' },
  { label: 'Royal', accent: '#3949ab', dark: '#1a1a2e' },
  { label: 'Monochrom', accent: '#111111', dark: '#111111' },
];

const Auto3Editor: React.FC<TemplateEditorProps> = (props) => {
  const colors = props.data.templateColors ?? { accent: '#e30613', dark: '#111111' };
  const accent = colors.accent || '#e30613';
  const dark = colors.dark || '#111111';

  const update = (next: { accent?: string; dark?: string }) => {
    props.onDataChange({
      ...props.data,
      templateColors: { accent, dark, ...next },
    });
  };

  return (
    <div className="space-y-5">
      {/* Auto3 color controls */}
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Palette className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Auto3 Farben</h3>
          <span className="text-[11px] text-muted-foreground">— Akzent & Dunkel anpassen</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <label className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
            <input
              type="color"
              value={accent}
              onChange={(e) => update({ accent: e.target.value })}
              className="w-10 h-10 rounded-md border border-border cursor-pointer bg-transparent"
            />
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Akzentfarbe (CTA)</div>
              <input
                type="text"
                value={accent}
                onChange={(e) => update({ accent: e.target.value })}
                className="w-full bg-transparent text-sm font-mono font-semibold outline-none"
              />
            </div>
          </label>
          <label className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
            <input
              type="color"
              value={dark}
              onChange={(e) => update({ dark: e.target.value })}
              className="w-10 h-10 rounded-md border border-border cursor-pointer bg-transparent"
            />
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Dunkelton (Text / Badges)</div>
              <input
                type="text"
                value={dark}
                onChange={(e) => update({ dark: e.target.value })}
                className="w-full bg-transparent text-sm font-mono font-semibold outline-none"
              />
            </div>
          </label>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => update({ accent: p.accent, dark: p.dark })}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted transition-colors"
            >
              <span className="w-3 h-3 rounded-full border border-border" style={{ background: p.accent }} />
              <span className="w-3 h-3 rounded-full border border-border" style={{ background: p.dark }} />
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => update({ accent: '#e30613', dark: '#111111' })}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted ml-auto"
          >
            <RotateCcw className="w-3 h-3" /> Zurücksetzen
          </button>
        </div>
      </div>

      {/* Reuse Modern editor for all other fields */}
      <ModernEditor {...props} />
    </div>
  );
};

export default Auto3Editor;
