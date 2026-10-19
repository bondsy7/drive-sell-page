// Einmalige Übergabe der Remastering-Originale an den Freisteller (nur im Speicher, wird beim Lesen geleert).
export type FreistellerHandoffImage = { slotKey: string; base64: string };

let pending: FreistellerHandoffImage[] | null = null;

export function setFreistellerHandoff(images: FreistellerHandoffImage[]) {
  pending = images.filter((i) => i.base64);
}

export function takeFreistellerHandoff(): FreistellerHandoffImage[] {
  const out = pending ?? [];
  pending = null;
  return out;
}
