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

### 4. Resend account + API key — **CONSIDER PULLING UP TO DAY 4 OR EARLIER**
- Day 3 hit Supabase's default SMTP limits during live invite testing:
  - Rate limit (~3-4 emails/hour) — only 1 of 3 test invites delivered.
  - Invite-link "otp_expired" on click (Gmail/anti-phishing prefetch consumes the single-use token before user clicks).
- Both go away once Supabase Auth uses a real SMTP provider (Resend) for invites.
- **Action:** sign up at resend.com → verify a sending domain (use `mentalvelocitysystem.com` once DNS is wired, or a temporary subdomain on a domain you already own) → create API key → in Supabase dashboard → Project Settings → Auth → SMTP, point at Resend SMTP creds. (You don't need `RESEND_API_KEY` env vars in the app for *invites* — only for the transactional reminder emails Day 7 builds.)
- **Status:** awaiting setup. Was Day 7; recommend before Day 4 cohort smoke tests.

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
