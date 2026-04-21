# Peer & Self Assessment Feature PRD

## Overview
A new feature allowing students to evaluate their teamwork performance by assessing themselves and their team members. This feature uses a 4-point Likert scale alongside qualitative feedback. Teachers can view the consolidated assessment data via a dedicated dashboard.

## 1. Student Dashboard

### Location & Access
- **Menu Item:** "Peer & Self Assessment" in the student dashboard sidebar.

### Functionality
- **List of Assessable Members:**
  - Displays all members of the student's group/team.
  - The student must evaluate each team member, including themselves.
- **Assessment Form (Rubric):**
  - **Rubric Style:** 4-point Likert scale (1-4) for each indicator.
  - **Self Assessment Indicators (ESL English translated):**
    1. I actively participate and support group work.
    2. I share ideas and complete tasks I am responsible for.
    3. I care for others, help friends who struggle, and am willing to share knowledge.
    4. I try to find solutions when there are disagreements, without forcing my will.
    5. I maintain a good attitude, use polite language, and respect friends.
    6. I listen to others' opinions and respond politely.
  - **Self Assessment Qualitative Feedback (Text Boxes):**
    1. *One thing I did well:*
    2. *One thing I need to improve:*
  - **Peer Assessment Indicators (ESL English translated):**
    1. This member actively supports group work.
    2. This member shares ideas and completes their tasks.
    3. This member cares about and is willing to help others.
    4. This member resolves disagreements well.
    5. This member maintains a good attitude, speaks politely, and respects friends.
    6. This member listens to and respects others' opinions.
  - **Peer Assessment Qualitative Feedback (Text Boxes):**
    1. *Good things I noticed:*
    2. *Suggestions for improvement:*
- **Visibility & Privacy:**
  - **Can see:** The scores and comments they *gave* to each team member.
  - **Cannot see:** The scores and comments they *received* from others (peer reviews are hidden from the receiver).

## 2. Teacher Dashboard

### Location & Access
- **Menu Item:** "Peer Assessment Results" (or similar) in the teacher dashboard sidebar.

### Functionality
- **Data Table view containing:**
  - Student Name
  - Average Peer Assessment Score received (average from all peers who reviewed them)
  - Self Assessment Score (average or total of the 6 indicators)
  - Number of Reviews Received (how many team members reviewed this student)
  - Number of Reviews Given (how many team members this student reviewed)
  - Total number of members in their group
  - "See Detail" Action Button: Opens a modal/panel view to see the qualitative comments they made/received.
- **Filters & Search:**
  - **Grade & Class Filter:** Dropdowns to filter by specific grade and class.
  - **Search:** Search bar for student names.
  - **Default state:** Displays no data until filters are selected and a "Generate Data" button is clicked.
- **Export:**
  - **"Download Score" Button:** Exports the currently generated data table to a CSV file.

## 3. Database Updates Required
We will need to add a new table (e.g., `peer_assessments`) to the database (Supabase) to store these submissions.

**Proposed Schema (`peer_assessments`):**
- `id` (UUID, Primary Key)
- `class_name` (Text)
- `group_number` (Int)
- `academic_year` (Text)
- `assessor_email` (Text) - The student giving the review
- `assessed_email` (Text) - The student receiving the review. (If assessor == assessed, it's a self-assessment)
- `q1_score` (Int)
- `q2_score` (Int)
- `q3_score` (Int)
- `q4_score` (Int)
- `q5_score` (Int)
- `q6_score` (Int)
- `comment_good` (Text) - Fulfills "One thing I did well" or "Good things I noticed"
- `comment_improve` (Text) - Fulfills "One thing I need to improve" or "Suggestions for improvement"
- `created_at` (Timestamp)

**RLS Policies:**
- Students can insert any assessment.
- Students can only select/view assessments where they are the `assessor_email`.
- Teachers can select/view all assessments.
