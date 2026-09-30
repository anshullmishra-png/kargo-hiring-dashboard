-- Hiring dashboard schema. Safe to re-run.
-- PRIVACY MODEL: candidate_pii (name/email/phone) is a separate table that only the server
-- (service-role key) ever reads. RLS is on for every table with NO policies, so the
-- anon key can read nothing. The AI pipeline only ever touches `candidates.cv_text`,
-- which is the CV with personal details already stripped out.

create table if not exists roles (
  code     text primary key,            -- 'PM' | 'SPM'
  title    text not null,
  jd_text  text not null default ''
);

create table if not exists rubric_criteria (
  id           serial primary key,
  role_code    text not null references roles(code),
  sort         int  not null,
  name         text not null,
  description  text not null,
  weight       int  not null check (weight > 0 and weight <= 100),
  unique (role_code, name)
);

create table if not exists settings (
  key    text primary key,
  value  text not null
);

create table if not exists candidates (
  id             uuid primary key default gen_random_uuid(),
  applied_role   text not null references roles(code),
  filename       text,
  role_auto      boolean not null default false,   -- true when the founder said "not sure" and the AI picked the role
  role_note      text,                              -- the AI's one-line reason for that pick
  cv_path        text,                          -- original file in private storage bucket 'cvs'
  cv_text        text not null,                 -- REDACTED text; the only CV text the AI ever sees
  status         text not null default 'processing',   -- processing | ready | error
  error          text,
  score_pm       numeric,                       -- 0-100, weighted against the PM rubric
  score_spm      numeric,                       -- 0-100, weighted against the SPM rubric
  brief          text,
  email_kind     text,                          -- invite | reject
  email_subject  text,
  email_body     text,
  email_status   text not null default 'draft', -- draft | sending | sent
  email_to       text,                          -- address actually used at send time
  email_error    text,
  resend_id      text,
  sent_at        timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists candidate_pii (
  candidate_id  uuid primary key references candidates(id) on delete cascade,
  name          text,
  email         text,
  phone         text
);

create table if not exists candidate_scores (
  candidate_id  uuid not null references candidates(id) on delete cascade,
  criterion_id  int  not null references rubric_criteria(id) on delete cascade,
  score         int  not null check (score between 0 and 10),
  reason        text not null,
  primary key (candidate_id, criterion_id)
);

-- For databases created before these columns existed.
alter table candidates add column if not exists role_auto boolean not null default false;
alter table candidates add column if not exists role_note text;

alter table roles            enable row level security;
alter table rubric_criteria  enable row level security;
alter table settings         enable row level security;
alter table candidates       enable row level security;
alter table candidate_pii    enable row level security;
alter table candidate_scores enable row level security;

-- Private bucket for the original CV files (server reads via signed URLs only).
insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false)
on conflict (id) do nothing;
