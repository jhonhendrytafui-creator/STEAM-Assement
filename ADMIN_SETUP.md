# Admin Access — Setup Guide

Some teachers can be given **admin** rights on top of their normal teacher
account. An admin sees four extra menu items in the teacher dashboard:

| Menu | What it does |
|---|---|
| **Admin · Students** | Add, edit and remove students; change their class and group; move several students at once; bulk-import a whole class by pasting from a spreadsheet |
| **Admin · Teacher Access** | Give a new teacher access to the teacher portal, promote a teacher to admin, or revoke either |
| **Admin · Project Data** | Delete a single project submission, or reset a group completely (projects, scores, logbook, peer assessments, AI Pre-Check quota) so they can start fresh |
| **Admin · Activity Log** | An append-only record of every admin action, with who did it and when |

Everything else in the teacher dashboard is unchanged. A teacher without the
admin flag sees exactly what they see today.

---

## One-time setup

1. Open the **Supabase SQL Editor** for this project.
2. Open `sql/add_admin_role.sql`.
3. Scroll to **Section 7** and replace `CHANGE_ME@sekolah.pahoa.sch.id` with the
   email of your first admin. Add more `INSERT` rows for more admins.
4. Run the whole file.
5. That admin logs out and logs back in. The four `Admin ·` menu items appear.

From then on, admins can grant and revoke admin rights for other teachers from
**Admin · Teacher Access** — no more SQL needed.

### Verify it worked

```sql
SELECT email, role, is_admin FROM profiles WHERE is_admin = TRUE;
```

---

## What the migration adds

- `profiles.is_admin` — the flag the app reads to show the Admin menu.
- `teacher_emails.is_admin` — lets you grant admin *before* a teacher has ever
  logged in. A trigger keeps the two columns in sync.
- `public.is_admin()` — a `SECURITY DEFINER` helper used by the RLS policies.
- `admin_audit_log` — append-only. There is deliberately no `UPDATE` or `DELETE`
  policy, so not even an admin can rewrite the history of what they did.
- RLS policies letting admins manage students, teacher access, projects,
  assessment scores, logbooks, peer assessments and themes.

---

## Important: admin is currently a menu gate, not a security wall

In the database as it stands today, **every teacher** already has full
`FOR ALL` rights on `student_master`, `teacher_emails` and `projects`. Hiding
the Admin menu stops ordinary teachers from *seeing* these tools, but a
determined teacher could still call the database directly.

If you want admin to be a real boundary, uncomment **Section 6** of
`sql/add_admin_role.sql`. That downgrades ordinary teachers to read-only on the
student roster and the teacher list, and removes their ability to delete
projects — while keeping everything they need for approving, commenting and
grading.

Do that only **after** you have confirmed you can log in as an admin, otherwise
nobody will be able to edit the roster.

---

## Notes on destructive actions

- **Removing a student** deletes only their roster entry. Their group's project,
  scores and logbook stay. They lose access to the student dashboard.
- **Moving students** changes their class/group. Work already submitted stays
  with the old group — it is not carried over.
- **Deleting one iteration** removes that submission only. The group's
  assessment scores are left alone.
- **Reset group** deletes whichever categories you tick. After a reset the group
  can submit again and it will be recorded as iteration 1.
- None of this can be undone from inside the app. Every action is written to the
  activity log with the admin's email address.
