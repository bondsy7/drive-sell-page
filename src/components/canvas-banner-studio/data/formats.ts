import type { BannerFormat } from "../state/types";

export const BANNER_FORMATS: BannerFormat[] = [
  { id: "ig-square", name: "Instagram Feed Square", width: 1080, height: 1080, category: "social" },
  { id: "ig-portrait", name: "Instagram Feed Portrait", width: 1080, height: 1350, category: "social" },
  { id: "ig-story", name: "Instagram Story", width: 1080, height: 1920, category: "social" },
  { id: "fb-feed", name: "Facebook Feed", width: 1200, height: 1200, category: "social" },
  { id: "fb-link", name: "Facebook Link Ad", width: 1200, height: 628, category: "social" },
  { id: "g-medrect", name: "Google Display Medium Rectangle", width: 300, height: 250, category: "display" },
  { id: "g-leader", name: "Google Display Leaderboard", width: 728, height: 90, category: "display" },
  { id: "g-skyscraper", name: "Google Display Wide Skyscraper", width: 160, height: 600, category: "display" },
  { id: "web-hero", name: "Website Hero", width: 1920, height: 800, category: "website" },
];

export const getFormatById = (id: string): BannerFormat =>
  BANNER_FORMATS.find((f) => f.id === id) ?? BANNER_FORMATS[0];

export const slugifyFormat = (f: BannerFormat) =>
  f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
