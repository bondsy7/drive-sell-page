

## Plan: d.bonds@autoactiva.de zum Admin machen

### Problem
- Auth-User `d.bonds@autoactiva.de` existiert (Screenshot bestätigt)
- Profil-Tabelle zeigt noch alte E-Mail `info@d-bonds.de` für ID `753b5f67-58ad-493f-a031-200016d23a95`
- Das Profil wurde beim ersten Signup erstellt und die E-Mail wurde danach im Auth-System geändert, aber nicht im Profil synchronisiert

### Änderungen

1. **DB-Migration**: 
   - Profil-E-Mail aktualisieren: `info@d-bonds.de` → `d.bonds@autoactiva.de`
   - Admin-Rolle einfügen: `INSERT INTO user_roles (user_id, role) VALUES ('753b5f67-...', 'admin')`

2. **Keine Code-Änderungen nötig** — AdminRoute und has_role() sind bereits implementiert.

### Ergebnis
- `/admin` wird für deinen Account zugänglich
- Profil zeigt korrekte E-Mail

