/** Shared geometry for the editable canvas and standalone HTML delivery. */
export const LANDING_LAYOUT_CSS = `
.lp-layout{--lp-content-max:1200px;--lp-content-gutter:32px;--lp-column-gap:56px}
.lp-layout .lp-content-width,.lp-layout .lp-live-inner{box-sizing:border-box;width:100%;max-width:var(--lp-content-max);margin-inline:auto;padding-inline:var(--lp-content-gutter) !important;min-width:0}
.lp-layout .lp-section-inner:not(.lp-content-width){padding-inline:0 !important}
.lp-layout .lp-hero-grid{padding-block:80px;gap:var(--lp-column-gap) !important}
.lp-layout .lp-hero-text{padding:0 !important;min-width:0}
.lp-layout .lp-hero-text > div{width:100%;max-width:none !important}
.lp-layout .lp-split > *{min-width:0}
.lp-layout .lp-body-html{width:100%;min-width:0;overflow-wrap:anywhere}
.lp-layout .lp-body-html :is(p,h2,h3,h4,div){box-sizing:border-box;width:100%;max-width:none !important;margin-inline:0 !important}
.lp-layout .lp-content-width :is(h1,h2,h3,p){overflow-wrap:anywhere}
.lp-layout .lp-header-inner{display:flex;align-items:center;justify-content:space-between;gap:16px}
@media(max-width:900px){
 .lp-layout{--lp-content-gutter:20px;--lp-column-gap:28px}
 .lp-layout .lp-hero-grid{padding-block:48px;grid-template-columns:minmax(0,1fr) !important}
 .lp-layout .lp-hero-text{padding:0 !important;min-height:0 !important}
}
@container lp (max-width:900px){
 .lp-layout .lp-content-width,.lp-layout .lp-live-inner{padding-inline:20px !important}
 .lp-layout .lp-hero-grid{padding-block:48px;grid-template-columns:minmax(0,1fr) !important;gap:28px !important}
 .lp-layout .lp-hero-text{padding:0 !important;min-height:0 !important}
}
`;