/**
 * Spin360 V2 — reine Frontend-Sicht auf dieselbe Logik wie die Edge Function.
 * Re-Export des geteilten Moduls, damit Viewer, Workflow und Tests
 * exakt dieselbe Winkel-, Sektor- und Abschlusslogik verwenden.
 *
 * Achtung: nur reine Funktionen — hier niemals Netz-/DB-Code ergänzen.
 */

export * from "../../supabase/functions/_shared/spin360-v2";
