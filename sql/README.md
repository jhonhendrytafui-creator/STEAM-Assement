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
| 14 | `fix_missing_themes_2026_2027.sql` | Themes for the **current** academic year — without this no grade can submit a project |
| 15 | `teacher_profile_1_columns.sql` -> `_2_triggers` -> `_3_save_rpc` -> `_4_policy_check` | Teacher self-service profile (subjects, grades, WhatsApp) + the assessor's name on every mark. **Four files, run in order.** |

## Existing database

Run **9**, **10**, **11**, **12**, **13**, **14**, then **15**'s four parts in
order. All are safe to re-run.

**Why 15 is split into four files.** It began as one 368-line script and would
not apply: the Supabase SQL Editor truncated the paste at exactly line 150 --
confirmed twice, on two different versions of the file, both cut after line 150
at different byte offsets. A paste cut off inside a function body fails with
`unterminated dollar-quoted string`, and the line it names is where that body
*opens*, not where the text ran out, which makes it look like a syntax error
hundreds of lines from the real problem. Each part is now under 110 lines.
Part 4 ends by asserting every column, trigger and function parts 1-3 should
have created, and names any that are missing, so a skipped or truncated part
cannot leave the migration quietly half-applied. You should see
`ALL 4 PARTS COMPLETE` when it is done.

**14 is not optional, and it is the one that was missing.** `full_schema.sql`
seeds themes for `2025/2026` only, but `ACADEMIC_YEAR` in `src/lib/constants.ts`
is `2026/2027`. The current year's themes came from two scripts that were never
listed here — `seed_themes_2026_2027.sql` (grades 7-12) and
`override_themes_grade_10_11_12.sql` (grades 10-12 only) — so running the
override without the base seed left grades 7, 8 and 9 with no themes at all.
A grade with no themes has an empty theme dropdown, and submission refuses a
project with no theme, so that whole grade could not submit. This is what a
grade 7 student hit. Script 14 fills in any grade that has none and leaves
grades that already have themes untouched, so it is safe on a live database and
safe to re-run. It also adds the unique index on
`(theme_name, grade, academic_year)` that the theme seeds never had.

**15 gates the teacher portal until each teacher fills in their own details,**
and records who gave each mark. Two things to know before running it:

- Every teacher is shown a one-off form on their next sign-in and cannot reach
  the portal until they complete it: full name, subjects, grade levels and a
  WhatsApp number. Admins are gated too — the form is self-service, so nobody
  can be locked out. A teacher whose row an admin has already filled in
  completely is not gated, because `profile_completed_at` comes across on first
  login. To let a teacher through without the form, set
  `profile_completed_at = NOW()` on their `teacher_emails` row.
- `assessment_scores.assessed_by_name` is backfilled from the existing
  `assessed_by` reference wherever it was recorded. Marks older than that
  column keep a NULL and the UI shows "Not Recorded" — an honest gap rather
  than a guess. The name is stored on the score row rather than joined from
  `profiles` because RLS lets a student read only their own `profiles` row, so
  the student dashboard cannot resolve `assessed_by` to a name.

Writes go through `save_teacher_profile()`, a `SECURITY DEFINER` function, not a
table grant: `teacher_emails` carries `is_admin`, and RLS cannot restrict an
UPDATE to a column list. The function touches four columns for the caller's own
email and never `is_admin`.

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

**No new script is needed for the admin academic-year switch.** `app_settings`,
its policies and its `academic_year` row all come from script **10**, which is
already in the list above. The app now reads that row instead of the constant
that used to live in `src/lib/constants.ts`, and Admin -> Academic Year writes
it. If the row is somehow absent the app falls back to `FALLBACK_ACADEMIC_YEAR`
in `src/lib/academic-year.ts` -- the value the constant held -- so behaviour is
unchanged until an admin sets it, and the first switch creates the row. To check
what is stored:

```sql
SELECT key, value, updated_at, updated_by FROM app_settings WHERE key = 'academic_year';
```

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
