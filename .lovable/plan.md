# Refactor: Migration von Projekt-basierter zu VIN-basierter Datenarchitektur

**Status:** PLAN — wartet auf Freigabe. Keine Datei wurde geändert.

---

## Ausgangslage (alt)

Das Dashboard war **asset-zentriert** mit flachen Top-Level-Tabs:
`projects | landings | gallery | banners | videos | leads | spin360`

Jeder Tab listete Assets übergreifend ohne Fahrzeugbezug. Die einzige Klammer war `projects` (= Landing-Page-Container). Banner & Videos lagen lose im Storage unter `{user_id}/...` ohne DB-Verknüpfung.

**Probleme:**
- Nutzer dachten in Asset-Typen ("wo sind meine Banner?") statt in Fahrzeugen.
- Fahrzeugdaten mussten pro Asset neu eingegeben werden.
- Kein zentraler Ort für "alles zu VIN X".

---

## Neue Architektur (Ziel)

Die **VIN ist primärer Anker**. Eingeführt wird die Tabelle `vehicles` (UNIQUE `vin` pro `user_id`) als oberste Hierarchieebene.

Alle bestehenden Asset-Tabellen (`projects`, `project_images`, `spin360_jobs`, `leads`) bekommen eine `vehicle_id`-Foreign-Key-Spalte mit **Cascade-Delete**.

Banner und Videos werden über die Storage-Pfad-Konvention `{user_id}/{vehicle_id}/...` einem Fahrzeug zugeordnet.

---

## Dashboard-Umbau

- **Default-Tab** ist nun `vehicles` mit der Query `vehicles-with-counts`, die pro Fahrzeug die Anzahl Projekte, Bilder, Spins und Leads aggregiert (parallel `.in('vehicle_id', ids)`-Joins in `useVehicles.ts`).
- Die alten Top-Level-Tabs **bleiben als globale Such-/Filteransicht** erhalten.

---

## Neue Detailseite `/vehicle/:id` (`VehicleView.tsx`)

Pro Fahrzeug eigene Tabs:

`originals | gallery | landings | banners | videos | spin360 | leads`

- Alle strikt per `vehicle_id = id` (DB) bzw. `{user_id}/{vehicle_id}/`-Pfad (Storage) gefiltert.
- Zusätzlich neuer **Originals-Tab** (Roh-Uploads aus `originals/{userId}/{vehicleId}/`).
- **Exposé-Builder**, der alle Assets eines Fahrzeugs (Originale, Galerie, Banner) zu einem Marketing-Dokument bündelt.

---

## Workflow-Konsequenz

- Generierungen (Photos, Landing Page, Banner, Video, 360-Spin, Leads) tragen jetzt **automatisch die `vehicle_id`**.
- Fahrzeugdaten (Marke, Modell, Specs aus OutVIN) werden **einmal pro VIN** gepflegt und allen abhängigen Assets vererbt — keine Doppeleingabe mehr.
- **Datenschutz:** weiterhin striktes `user_id`-Filtering auf allen Queries (auch für Admins).

---

## Umsetzungsschritte (nach Freigabe)

### 1. DB-Migrationen

**1a. Tabelle `vehicles`**
```sql
CREATE TABLE public.vehicles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  vin             text NOT NULL,
  brand           text,
  model           text,
  year            integer,
  color           text,
  title           text,
  vehicle_data    jsonb NOT NULL DEFAULT '{}',
  cover_image_url text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, vin)
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own vehicles"  ON public.vehicles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all vehicles"   ON public.vehicles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));
CREATE INDEX idx_vehicles_user_vin ON public.vehicles(user_id, vin);
```

**1b. `vehicle_id` an Asset-Tabellen** (nullable → kein Bruch von Bestandsdaten)
```sql
ALTER TABLE projects        ADD COLUMN vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE;
ALTER TABLE project_images  ADD COLUMN vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE;
ALTER TABLE spin360_jobs    ADD COLUMN vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE;
ALTER TABLE leads           ADD COLUMN vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL;
-- Indizes je vehicle_id
```

**1c. Bucket `originals`** (private, owner-RLS) für Roh-Uploads.

### 2. Frontend — neue Dateien

| Datei | Zweck |
|---|---|
| `src/hooks/useVehicles.ts` | `useVehicles()` (mit aggregierten Counts), `useVehicle(id)`, CRUD-Mutations |
| `src/pages/VehicleView.tsx` | Detailseite `/vehicle/:id` mit allen Tabs |
| `src/components/dashboard/VehiclesTab.tsx` | Default-Tab, Karten mit Counts |
| `src/components/vehicle/VehicleHeader.tsx` | Titel/VIN/Tags/Cover, Exposé- + Aktion-CTAs |
| `src/components/vehicle/OriginalsTab.tsx` | Listing aus `originals/{user}/{vehicle}/` |
| `src/components/vehicle/ExposeBuilder.tsx` | Bündelt Originals + Galerie + Banner |

### 3. Frontend — Anpassungen

| Datei | Änderung |
|---|---|
| `src/App.tsx` | Route `/vehicle/:id` → `VehicleView` |
| `src/pages/Dashboard.tsx` | Default-Tab → `vehicles`; alte Tabs bleiben als globale Filtersicht |
| `src/components/dashboard/types.ts` | Typ `Vehicle` + `vehicle_id` an `Project`/`ProjectImage`/`Lead`/`Spin360Job` |
| `src/hooks/useDashboardData.ts` | `vehicle_id` in Selects mit aufnehmen |
| `src/components/PipelineRunner.tsx` | nach Generierung `vehicle_id` an `projects`/`project_images` schreiben |
| `src/components/BannerGenerator.tsx` | Storage-Pfad → `banners/{user}/{vehicle}/...` |
| `src/components/VideoGenerator.tsx` | Storage-Pfad → `videos/{user}/{vehicle}/...` |
| `src/components/spin360/Spin360Workflow.tsx` | `vehicle_id` an `spin360_jobs` |
| `src/components/PDFUpload.tsx` / OutVIN-Flow | nach VIN-Lookup `vehicles` upserten (`onConflict: user_id,vin`) |
| `src/contexts/PipelineContext.tsx` | `currentVehicleId` führen, an Edge-Calls weiterreichen |

### 4. Edge Functions — Anpassungen

Alle setzen `vehicle_id` aus dem Request-Body in INSERTs / Storage-Pfaden:
- `generate-360-spin` → `spin360_jobs.vehicle_id`
- `submit-lead`, `auto-process-lead` → `leads.vehicle_id` (best-effort VIN→vehicle Match)
- `generate-video`, `generate-banner`, `remaster-vehicle-image` → Storage-Pfad mit `{vehicle_id}`
- `api-vehicles` (Public-API) → optional `GET /vehicles`-Endpoint

Auth-Pfad (`sb.auth.getClaims(token)`) bleibt unverändert.

### 5. Backfill (optional, separater Schritt)

Pro `projects.vehicle_data->>'vin'` einen `vehicles`-Row anlegen, dann `vehicle_id` in `projects`/`project_images`/`leads` zurückschreiben. Wird nach Schema-Change in einer `supabase--insert`-Operation ausgeführt — separat freigeben.

---

## Reihenfolge

1. Migration `vehicles`-Tabelle + RLS + Trigger
2. Migration `vehicle_id`-Spalten + Indizes
3. Bucket `originals` + Policies
4. `useVehicles.ts`, `VehiclesTab`, `VehicleView` + Subkomponenten
5. Route + Dashboard-Default-Tab
6. PipelineContext + alle Generator-Komponenten + Edge Functions auf `vehicle_id`
7. (optional) Backfill-Skript
8. (optional) Memory-Update in `mem://architecture/vin-centric`

---

## Nicht-Ziele

- Keine Umbenennung von `projects` → "landing_pages" (zu invasiv; nur logischer Rename in UI-Texten).
- Kein Hard-Delete der alten flachen Tabs — bleiben als globale Suche.
- Keine OutVIN-Re-Calls bei vorhandener VIN — `vehicles.vehicle_data` ist Cache.

---

**Bitte mit „go" bestätigen oder Korrekturen anbringen — dann starte ich mit Schritt 1 (Migration `vehicles`-Tabelle).**
