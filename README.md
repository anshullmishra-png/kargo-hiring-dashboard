# Kargo Hiring Dashboard

Internal tool for one person. Upload a CV, pick the role → it is scored against the rubric, briefed, and an email is drafted. The founder reads, then clicks **Send via Resend**. Nothing goes out without that click.

## How a CV flows

1. **Upload** (`/upload`): PDF / DOCX / TXT + the role applied for. Several files at once is fine (one role per batch).
2. **Personal details are split off first, in plain code (no AI).** Name, email, phone and profile links go to the private `candidate_pii` table. The rest of the CV (`candidates.cv_text`) is what the AI sees. If anything personal survives redaction, the upload is rejected and nothing is sent to AI.
3. **Score** — every CV is scored 0–10 per criterion against **both** the PM and SPM rubric (one-line reason each). Weighted to 0–100 using the weights in the database.
4. **Email draft** — an interview invite for the **top N per role** (default 5, ranked on the applied-role score, and at least the minimum score), a warm rejection for everyone else. Written from the redacted CV with `{{FIRST_NAME}}` placeholders; the real name is substituted in code afterwards.
5. **Brief** — three sentences for the top N per role (default 5) that are above the line.
6. **Dashboard** (`/`) ranks each role by score, shows briefs, and links to each candidate → edit the draft → **Send via Resend**.

N and the minimum score are editable on the dashboard; as new CVs arrive or N changes, unsent drafts flip between invite and rejection automatically. Sent emails are never touched.

## Setup

```bash
cd hiring-dashboard
npm install
cp .env.local.example .env.local     # fill in the keys
npm run db:setup                     # creates tables + loads rubric and JDs (needs DATABASE_URL)
npm run dev                          # http://localhost:3001
```

No `DATABASE_URL`? Paste `supabase/schema.sql`, then `supabase/seed.sql`, into the Supabase SQL editor.

Rubric and JDs live in `data/`. After editing `data/rubric.txt`, run `npm run db:seed` (regenerates `supabase/seed.sql`) and re-apply it.

## Testing safely

Emails go to the address stored for each candidate, but only if its domain is in `ALLOWED_RECIPIENT_DOMAINS` (default `pg27.mesaschool.co`, the MESA test addresses); anything else is blocked before Resend is called. Optionally set `TEST_RECIPIENT` to redirect every email to one address (it must also be on an allowed domain). With Resend's default `onboarding@resend.dev` sender you can only deliver to your own Resend account email; verify a domain to send to other addresses.

`npm run test:pii -- "<folder of CVs>"` runs the personal-details separation over a folder and reports what it found.

## Deploy (Vercel)

Import the repo, set **Root Directory** to `hiring-dashboard`, add the env vars from `.env.local.example` (not `DATABASE_URL`), and set `DASHBOARD_PASSWORD` — the app refuses to serve in production without it. Long steps use `maxDuration = 60`.

## Privacy notes

- `candidate_pii` and all tables have Row Level Security on with no policies; only the server (service-role key) can read them.
- Original CV files are kept in a private Supabase Storage bucket (`cvs`) and only opened via short-lived signed links.
- CV text is treated as untrusted: prompts tell the model to ignore instructions inside it, and all output is rendered as escaped text.
