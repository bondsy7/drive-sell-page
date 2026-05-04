# Refactor: Projekt-basiert → VIN-basierte Datenarchitektur

**Status:** PLAN — wartet auf Freigabe. Keine Datei wurde geändert.
**Ziel:** VIN als primärer Anker. Eine `vehicles`-Tabelle als oberste Hierarchieebene; alle Asset-Tabellen verweisen via `vehicle_id` (Cascade).

---

## 1. Datenbank-Migrationen

### 1.1 Neue Tabelle `vehicles`
```sql
CREATE TABLE public.vehicles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  vin           text NOT NULL,
  brand         text,
  model         text,
  year          integer,
  color         text,
  title         text,                       -- z.B. "BMW X7 XDRIVE40I CW23"
  vehicle_data  jsonb NOT NULL DEFAULT '{}',-- Specs, OutVIN-Payload, Equipment
  cover_image_url text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, vin)
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own vehicles" ON public.vehicles
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all vehicles" ON public.vehicles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_vehicles_user        ON public.vehicles(user_id);
CREATE INDEX idx_vehicles_user_vin    ON public.vehicles(user_id, vin);
```

### 1.2 `vehicle_id` an bestehende Tabellen anhängen
```sql
ALTER TABLE public.projects        ADD COLUMN vehicle_id uuid
  REFERENCES public.vehicles(id) ON DELETE CASCADE;
ALTER TABLE public.project_images  ADD COLUMN vehicle_id uuid
  REFERENCES public.vehicles(id) ON DELETE CASCADE;
ALTER TABLE public.spin360_jobs    ADD COLUMN vehicle_id uuid
  REFERENCES public.vehicles(id) ON DELETE CASCADE;
ALTER TABLE public.leads           ADD COLUMN vehicle_id uuid
  REFERENCES public.vehicles(id) ON DELETE SET NULL;

CREATE INDEX idx_projects_vehicle       ON public.projects(vehicle_id);
CREATE INDEX idx_project_images_vehicle ON public.project_images(vehicle_id);
CREATE INDEX idx_spin360_vehicle        ON public.spin360_jobs(vehicle_id);
CREATE INDEX idx_leads_vehicle          ON public.leads(vehicle_id);
```
**Nullable** halten → Bestandsdaten brechen nicht. Backfill-Skript optional (siehe §5).

### 1.3 `update_updated_at`-Trigger für `vehicles`
Standard-Trigger auf `update_updated_at_column()`.

### 1.4 Storage-Konvention (kein DB-Change)
- `vehicle-images/{user_id}/{vehicle_id}/...`
- `banners/{user_id}/{vehicle_id}/...`
- `videos/{user_id}/{vehicle_id}/...`
- Neuer Pfad: `originals/{user_id}/{vehicle_id}/...` (raw uploads)

Bucket `originals` ggf. neu anlegen (private; Owner-RLS).

---

## 2. Frontend — neue Dateien

| Datei | Zweck |
|---|---|
| `src/hooks/useVehicles.ts` | `useVehicles()` (Liste mit aggregierten Counts), `useVehicle(id)`, `useCreateVehicle()`, `useUpdateVehicle()`, `useDeleteVehicle()` |
| `src/pages/VehicleView.tsx` | Detail-Seite `/vehicle/:id` mit Tabs `originals \| gallery \| landings \| banners \| videos \| spin360 \| leads \| exposé` |
| `src/components/dashboard/VehiclesTab.tsx` | Default-Tab im Dashboard, Karten mit Counts |
| `src/components/vehicle/VehicleHeader.tsx` | Titel/VIN/Tags/Cover, "Exposé" + "Aktion"-CTAs |
| `src/components/vehicle/OriginalsTab.tsx` | Auflistung von `originals/{user}/{vehicle}/` |
| `src/components/vehicle/ExposeBuilder.tsx` | bündelt Originals + Galerie + Banner zu einem Marketing-Dokument |

`useVehicles` Implementierung (Skizze):
```ts
const { data: vs } = await sb.from('vehicles')
  .select('*').eq('user_id', uid).order('updated_at', { ascending: false });
const ids = vs.map(v => v.id);
const [{ data: pr }, { data: pi }, { data: sp }, { data: ld }] = await Promise.all([
  sb.from('projects').select('id,vehicle_id').in('vehicle_id', ids),
  sb.from('project_images').select('id,vehicle_id').in('vehicle_id', ids),
  sb.from('spin360_jobs').select('id,vehicle_id').in('vehicle_id', ids),
  sb.from('leads').select('id,vehicle_id').in('vehicle_id', ids),
]);
// counts pro vehicle_id zusammenführen
```

---

## 3. Frontend — Anpassungen bestehender Dateien

| Datei | Änderung |
|---|---|
| `src/App.tsx` | Route `/vehicle/:id → VehicleView` |
| `src/pages/Dashboard.tsx` | Default-Tab → `vehicles`; alte Tabs bleiben als globale Filtersicht |
| `src/components/dashboard/types.ts` | Neuer `Vehicle`-Typ + `vehicle_id` an `Project`, `ProjectImage`, `Lead`, `Spin360Job` |
| `src/hooks/useDashboardData.ts` | optional: `vehicle_id` in Selects mit aufnehmen |
| `src/components/PipelineRunner.tsx` | nach erfolgreichem Generierungslauf `vehicle_id` an `projects`/`project_images` schreiben |
| `src/components/BannerGenerator.tsx` | Storage-Pfad → `banners/{user}/{vehicle}/...` |
| `src/components/VideoGenerator.tsx` | Storage-Pfad → `videos/{user}/{vehicle}/...` |
| `src/components/spin360/Spin360Workflow.tsx` | `vehicle_id` an `spin360_jobs` |
| `src/components/PDFUpload.tsx` / OutVIN-Flow | nach VIN-Lookup: `vehicles` upserten (`onConflict: user_id,vin`) → `vehicle_id` in App-State |
| `src/contexts/PipelineContext.tsx` | `currentVehicleId` führen, an Edge-Function-Calls weiterreichen |

---

## 4. Edge Functions — Anpassungen

Alle setzen `vehicle_id` aus dem Request-Body in INSERTs:
- `generate-360-spin` → `spin360_jobs.vehicle_id`
- `submit-lead` → `leads.vehicle_id`
- `auto-process-lead` → `leads.vehicle_id` (best-effort match VIN→vehicle)
- `generate-video`, `generate-banner`, `remaster-vehicle-image` → Storage-Pfad mit `{vehicle_id}`
- `api-vehicles` (Public-API) → optional: separater Endpoint `GET /vehicles`

Keine Auth-Änderungen — bestehender `sb.auth.getClaims(token)`-Pfad bleibt.

---

## 5. Backfill (optional, separates Skript)
Für Bestandsdaten: pro `projects.vehicle_data->>'vin'` einen `vehicles`-Row anlegen, dann `projects.vehicle_id`/`project_images.vehicle_id`/`leads.vehicle_id` zurückschreiben. Wird nach dem Schema-Change in einer `supabase--insert`-Operation ausgeführt — separat freigeben.

---

## 6. Reihenfolge der Umsetzung (nach deinem Go)

1. **Migration 1** — `vehicles`-Tabelle + RLS + Trigger
2. **Migration 2** — `vehicle_id`-Spalten + Indizes
3. **Migration 3** — Bucket `originals` + Policies
4. Types regenerieren (automatisch durch Migration)
5. `useVehicles.ts`, `VehiclesTab`, `VehicleView` + Subkomponenten
6. Route + Dashboard-Default-Tab
7. PipelineContext + alle Generator-Komponenten + Edge Functions auf `vehicle_id`
8. (optional) Backfill-Skript
9. (optional) Memory-Update in `mem://architecture/vin-centric`

---

## 7. Nicht-Ziele / Bewusst weggelassen
- Keine Umbenennung von `projects` → "landing_pages" (zu invasiv; nur logischer Rename in UI-Texten).
- Kein Hard-Delete der alten flachen Tabs — bleiben als globale Suche.
- Keine OutVIN-Re-Calls bei vorhandener VIN — `vehicles.vehicle_data` ist Cache.

---

**Bitte bestätigen mit "go" oder Korrekturen anbringen — dann fange ich mit Schritt 1 (Migration `vehicles`-Tabelle) an.**
