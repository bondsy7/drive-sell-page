## Diagnose

Ja, die Ladezeit hängt an der Fahrzeugmenge — aber nicht primär an den Fahrzeugen selbst, sondern an dem, was `useVehicles()` pro Fahrzeug parallel nachlädt.

Aktueller Ablauf in `src/hooks/useVehicles.ts` (das ist die Query hinter der Übersicht):

1. `vehicles` laden (schnell, ~175 Zeilen projektweit; bei dir max. 62).
2. `projects`, `project_images`, `spin360_jobs`, `leads` in einem `Promise.all` — **ohne LIMIT** und mit `select('*')`-ähnlichen Feldern. Bei aktuell 2.861 `project_images` projektweit ist das der größte Batzen.
3. **Der eigentliche Bremser:** Für **jedes Fahrzeug** wird ein separater `supabase.storage.from('banners').list(...)` Aufruf gemacht, nur um die Banner-Anzahl zu ermitteln. Bei 62 Fahrzeugen = 62 sequentiell aufgelöste Storage-Requests (zwar `Promise.all`, aber der Browser limitiert parallel Requests pro Origin auf ~6, der Rest wartet in der Queue).

Also: Skalierung ist **linear zur Fahrzeugmenge** durch die Banner-Zählung, plus wachsender Payload bei `project_images`.

## Lösung

### 1. Banner-Counts serverseitig aggregieren
Statt pro Fahrzeug einen Storage-List-Call:
- Neue Postgres-View `vehicle_banner_counts` (bzw. RPC `get_banner_counts_for_user`), die `storage.objects` filtert:
  ```sql
  select split_part(name, '/', 2) as vehicle_id, count(*)
  from storage.objects
  where bucket_id = 'banners'
    and split_part(name, '/', 1) = auth.uid()::text
    and name like '%.png'
    and split_part(name, '/', 3) not like 'state-%'
  group by 1;
  ```
- Ein einziger RPC-Call statt N Storage-Requests.

### 2. Payload verkleinern
- `project_images`: nur `vehicle_id` + (für Cover-Fallback) `image_url, created_at` selektieren — steht schon so, aber zusätzlich per SQL-Aggregation (`count(*) group by vehicle_id`) via RPC lösen. Für den Cover-Fallback reicht ein `distinct on (vehicle_id)` neuestes Bild.
- Analog `projects` und `spin360_jobs` als Aggregat-RPC.

Idealziel: **1 RPC** liefert `{ vehicle_id, projects, images, spin360, banners, leads, cover_fallback }` — dann läuft die Übersicht in einem einzigen Roundtrip.

### 3. React Query Feintuning
- `staleTime: 60_000` setzen, damit ein Tab-Wechsel nicht jedes Mal neu lädt.
- `placeholderData: keepPreviousData` — beim Refetch die alte Liste stehen lassen statt Spinner.

### 4. Optional: DB-Indizes prüfen
- `create index if not exists idx_project_images_vehicle_id on project_images(vehicle_id);`
- `create index if not exists idx_projects_vehicle_id on projects(vehicle_id);`
- `create index if not exists idx_spin360_jobs_vehicle_id on spin360_jobs(vehicle_id);`
- `create index if not exists idx_leads_dealer_user on leads(dealer_user_id);`

## Erwartetes Ergebnis
- Bei 60 Fahrzeugen heute: typisch 3–6 s → **unter 500 ms** (ein einziger aggregierter Roundtrip).
- Skaliert danach flach auch bei 500+ Fahrzeugen.

## Umsetzung (technisch)
1. Migration: RPC `get_vehicle_dashboard(user_id uuid)` mit `security definer`, aggregiert projects/project_images/spin360/leads/banner-objects/cover-fallback in einem Query.
2. `useVehicles()` umbauen: nur noch `vehicles` + der eine RPC; Banner-Storage-Listing entfernen.
3. `staleTime` + `placeholderData` ergänzen.
4. Indizes per Migration.

Kein UI-Change — nur schneller.