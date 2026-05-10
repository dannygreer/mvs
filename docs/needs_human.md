# Open Items — Needed From Danny (the human)

This file is for blockers that require human action — credentials, account setup, decisions Claude can't make on its own. Append-only. Claude logs new items here when blocked; Danny reads + resolves when checking in.

---

## Active blockers

### 1. ~~`NEXT_PUBLIC_SUPABASE_ANON_KEY` missing from `.env.local` and Vercel~~ — RESOLVED 2026-05-08

- Anon key added to `.env.local` (validated against Supabase /auth/v1/settings — 200 OK, email auth enabled).
- Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` now set in all 3 envs (Production + Preview + Development). Preview added via dashboard after CLI quirk.

### 2. Supabase Auth — enable magic link
- Supabase dashboard → Authentication → Providers → Email → enable "Confirm email" if you want it strict, or leave off for invite-only.
- Supabase dashboard → Authentication → URL Configuration → Site URL = `https://mentalvelocitysystem.com` (and `http://localhost:3000` for dev).
- **Status:** awaiting setup

### 3. Domain DNS — mentalvelocitysystem.com
- Domain is purchased but not pointed at Vercel.
- **Action:** Vercel project → Settings → Domains → add `mentalvelocitysystem.com` and `www.mentalvelocitysystem.com`. Vercel will give you DNS records (A or CNAME). Add those at the registrar.
- **When:** Day 8 (marketing page launch). Don't block dev work on this.
- **Status:** awaiting setup

### 4. Resend account + SMTP swap — Day 5 (in progress: sandbox first, real domain backlog)
- **Phase 1 (Day 5, in progress):** Use Resend onboarding sandbox to unblock dev testing.
  - Restriction: sandbox only sends to the email tied to your Resend account (i.e. dannygreer@gmail.com and its plus-aliases). Sufficient for `dannygreer+s*@gmail.com` test students — INSUFFICIENT for real cohort.
  - Steps:
    1. Sign up at https://resend.com (use Google sign-in for speed).
    2. Resend dashboard → API Keys → Create → name "supabase-auth", scope "Sending access".
    3. Resend dashboard → Settings → SMTP → grab the SMTP credentials (host: smtp.resend.com, port: 587, user: "resend", pass: <API key>).
    4. Supabase dashboard → https://supabase.com/dashboard/project/pguqugmqyrjcwzkdzpel/auth/providers → scroll to "SMTP Settings" → enable custom SMTP → paste Resend creds. Set "Sender email" to `onboarding@resend.dev` and "Sender name" to "MVS".
    5. Save. Test by hitting `/auth/login` with dannygreer+test@gmail.com — magic link should arrive within seconds without rate-limit errors.
- **Phase 2 (BACKLOG, before first real cohort):** Verify a real sending domain.
  - Pick `mentalvelocitysystem.com` (root) or `mail.mentalvelocitysystem.com` (subdomain — recommended; keeps marketing/transactional separate).
  - Resend dashboard → Domains → Add domain → Resend gives DNS records (SPF, DKIM, optional DMARC) → add at registrar.
  - Once verified (~15 min after DNS propagation), update Supabase SMTP "Sender email" from `onboarding@resend.dev` to `noreply@mail.mentalvelocitysystem.com` (or chosen address).
  - **Hard blocker for first cohort.** Don't invite any real student until Phase 2 is done.

### 5. Designate super_admin accounts
- After auth refactor, manually run:
  ```sql
  update profiles set role = 'super_admin'
   where id = (select id from auth.users where email = 'dannygreer@gmail.com');
  -- and same for the doctor's email
  ```
- **Status:** do after Day 1 acceptance, before Day 3.

---

## Resolved
*(move items here once handled — don't delete, keeps an audit trail)*

### Vercel env cleanup — pending merge to main
After `feat/rls-and-admin-cutover` merges to `main`, remove these from Vercel (Production + Preview + Development) — legacy admin auth deleted in Day 2:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

Already stripped from local `.env.local`. Leaving on Vercel until merge so any unmerged preview deploys (e.g. Day 1's `feat/supabase-auth` branch) keep working. Once `main` ships Day 2, these are dead weight.
