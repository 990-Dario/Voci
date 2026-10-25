# Lehrmittel, Schulstufe und Teil-Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lehrmittel nach Schulstufe auswählbar machen, Lernsets sicher teilen und löschen.

**Architecture:** Die bestehende statische App bleibt erhalten. Ein kleines Datenmodul fasst Lehrmittel- und Schulstufenregeln zusammen; `app.js` nutzt es für die Auswahl und das Konto. Supabase erhält eine geschützte Tabelle für zeitlich begrenzte Kopien von Lernsets sowie eine RPC-Funktion zum Import.

**Tech Stack:** HTML, CSS, natives JavaScript, Node assert für reine Datenlogik, Supabase Auth/Postgres.

**Spec:** `docs/superpowers/specs/2026-10-25-lehrmittel-schulstufe-teilen-design.md`

## Global Constraints

- Keine zusätzliche Build-Abhängigkeit.
- Teil-Links laufen nach genau sieben Tagen ab.
- Ein importiertes Lernset ist eine unabhängige Kopie.
- Das Löschen entfernt auch Teil-Links des Lernsets.
- Die bestehende lokale Nutzung ohne Supabase bleibt funktionsfähig.

## Review Focus

- Ein Primarkonto sieht standardmässig keine Sekundar-Lehrmittel; der Umschalter zeigt sie zusätzlich.
- Fehlende Lehrmittelangaben in bestehenden Daten werden ohne Verlust in eine sichere Standardgruppe migriert.
- Abgelaufene, veränderte oder unbekannte Teil-Links lassen keinen Import zu.
- Das Löschen des aktiven oder letzten Lernsets lässt die Oberfläche nicht in einem ungültigen Zustand.
- Benutzer können keine Teil-Links anderer Benutzer löschen oder alle geteilten Sets auslesen.

---

### Task 1: Lehrmittel-Datenmodell und Tests

**Files:**
- Create: `tests/app-data.test.js`
- Create: `app-data.js`
- Modify: `data/vocabulary.json`
- Modify: `index.html`

**Interfaces:**
- Produces: `VociData.getCourse`, `VociData.visibleCourses`, `VociData.schoolLevelLabel`.
- Consumes: Vokabelgruppen mit `language`, `course`, `schoolLevel`, `unit`, `objective`.

- [ ] Write a failing Node assert test for primary and secondary course visibility, including the other-school-level toggle.
- [ ] Run `node tests/app-data.test.js` and confirm failure because `app-data.js` is missing.
- [ ] Create `app-data.js` with the pure helper functions and add `course`/`schoolLevel` to sample groups in `data/vocabulary.json`.
- [ ] Load `app-data.js` before `app.js` in `index.html`.
- [ ] Run `node tests/app-data.test.js` and confirm pass.

### Task 2: Supabase profile and time-limited shares

**Files:**
- Modify: `supabase-schema.sql`
- Modify: `SUPABASE.md`

**Interfaces:**
- Produces: `public.shared_sets`, `public.create_shared_set(source_set_id, set_data)`, `public.get_shared_set(share_token)`.
- Consumes: authenticated user ID and serialized learning-set data.

- [ ] Add schema checks for a seven-day `expires_at`, owner-only creation/deletion and a security-definer import RPC that returns only valid shares.
- [ ] Add a daily pg_cron cleanup job for expired rows.
- [ ] Document one-time migration execution and the required pg_cron capability in `SUPABASE.md`.
- [ ] Verify SQL statement ordering and RLS policy scope by reviewing every table operation against the owner ID.

### Task 3: School level and hierarchical set creation

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `VociData.visibleCourses(groups, schoolLevel, showOther)`.
- Produces: `store.profile.schoolLevel` and the expandable course/unit/goal selector.

- [ ] Add a required school-level selector to account creation and persist it into the initial account state.
- [ ] Add an editable account settings surface for an existing user’s school level.
- [ ] Replace flat Unit rendering with accessible course and Unit disclosure controls.
- [ ] Filter by own school level by default and implement the other-school-level toggle.
- [ ] Verify the selected objectives still map to the original learning modes.

### Task 4: Delete and share workflows

**Files:**
- Modify: `app.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `supabaseClient`, `activeSet`, `shared_sets` RPCs.
- Produces: generated link, import flow, deleted set state.

- [ ] Add a confirmation-backed delete action that updates the active set and deletes only the current owner’s share rows for that source set.
- [ ] Add a share action that creates a seven-day link and makes it easy to copy.
- [ ] Read share tokens from the URL, fetch via RPC, and import a new set with a new ID only after user confirmation.
- [ ] Verify all unavailable states: no Supabase, expired link, no active set and clipboard denial.

### Task 5: Verify, document and review

**Files:**
- Modify: `PRODUCT.md`
- Modify: `SPEC.md`
- Modify: `SUPABASE.md`
- Test: `tests/app-data.test.js`

**Interfaces:**
- Consumes: all prior tasks.

- [ ] Update product and setup documentation for school-level filtering, deletion and seven-day shares.
- [ ] Run `node tests/app-data.test.js` and `node --check app.js`.
- [ ] Inspect the local app at desktop and mobile widths, including disclosures and account controls.
- [ ] Review uncommitted files for accidental credentials beyond the public Supabase configuration.
