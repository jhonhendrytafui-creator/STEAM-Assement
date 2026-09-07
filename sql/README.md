# Database scripts — run order

The files in this folder are not numbered and several overlap. This is the
order that produces a correct database. Everything here is idempotent unless
noted, so re-running in this order is safe.

## Fresh Supabase project

| # | File | What it does |
|---|---|---|
| 1 | `full_schema.sql` | Tables, base RLS, auth trigger, rubric seed data |
| 2 | `peer_assessments.sql` | Peer & self assessment table |
| 3 | `project_votes_and_leaderboard.sql` | Voting + the leaderboard view |
| 4 | `02_ai_precheck_usage.sql` | AI pre-check counter |
| 5 | `add_project_classification.sql` | Teacher expertise + recommendations |
| 6 | `add_logbook_photo.sql`, `add_presentation_url.sql`, `add_project_documents_jsonb.sql`, `add_c5_questions_languages.sql`, `add_ai_plagiarism_*.sql` | Column additions |
| 7 | `rls_and_triggers.sql` | Hardened RLS for the ten core tables |
| 8 | `fix_security_issues.sql` | `security_invoker` on the leaderboard view, fixed `search_path` |
| 9 | `add_admin_role.sql` | Admin flag, `is_admin()`, audit log — **edit Section 7 first** |
| 10 | `harden_security.sql` | Audit fixes: scoped policies, `app_settings` |
| 11 | `fix_silent_rls_failures.sql` | Missing peer-assessment UPDATE policy, C1 reset trigger, re-runnable storage policies |
| 12 | `harden_links_and_storage.sql` | Rejects non-http(s) links at write time; scopes logbook photos to the owning group |
| 13 | `teacher_expertise_and_assignments.sql` | Admin-editable teacher subjects, `project_assignments`, teacher-only recommendation policies |

## Existing database

Run **9**, **10**, **11**, **12**, then **13**. All five are safe to re-run.

**11 is not optional.** Without it, a student editing a peer assessment they
already submitted sees "Assessment saved successfully" and nothing is written —
PostgREST does not report an UPDATE that RLS refuses, it just matches no rows.
Since individual marks are weighted by peer assessment, that silently feeds
stale ratings into grades.

**12 closes two holes the audit found.** Students can write the project document,
presentation and additional-document links, and the logbook photo URL; the only
check was `startsWith('http')` in the browser, which anyone can skip by calling
Supabase directly. It also scopes the `logbook_photos` bucket, which previously
let any signed-in user delete any group's photos.

**13 is what unblocks project classification.** Teacher expertise had no screen
that wrote to it, and lived on `profiles`, which does not exist until a teacher
first signs in — so "No teachers have their subject expertise configured" could
not be fixed from inside the app. Expertise moves to `teacher_emails`, where
Admin → Teacher Access can edit it before anyone logs in, and becomes a list of
subject ids rather than free text. It also closes a hole: every student could
insert and delete rows in `project_teacher_recommendations`.

Before running 10, run its Section 0 pre-flight query and keep the output — it
tells you which of the two conflicting policy sets was live, which is worth
knowing if you ever need to explain the gap.

## Notes

- `rls_and_triggers.sql` drops and rebuilds policies for ten named tables. Its
  drop loop used to cover the whole `public` schema, which silently removed the
  policies from every table added later. It is scoped now — if you add a table
  to that file, add it to the list at the top too.
- `add_logbook_photo.sql` is **not** safe to re-run on its own: it creates four
  storage policies with no `DROP POLICY IF EXISTS`, so a second run aborts on
  the first one and skips everything after it. `fix_silent_rls_failures.sql`
  replaces those policies with idempotent, bucket-scoped versions — run that
  instead of re-running `add_logbook_photo.sql`.
- `seed_test_data.sql` is test data. Never run it against production.
- Rubric seeds (`seed_c1_rubric.sql` … `seed_c5_rubric.sql`,
  `revise_c2_c5_rubrics.sql`) delete and recreate the dimensions for their
  category. Running one after teachers have graded will cascade-delete the
  scores attached to those indicators.
