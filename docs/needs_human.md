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

### 3. Domain DNS — mentalvelocitysystem.com — **Vercel side done; DNS records pending at registrar (Wix)**

- ✅ Both `mentalvelocitysystem.com` and `www.mentalvelocitysystem.com` added to the Vercel project `mvs` on Day 8.
- ⏳ Domain currently uses Wix nameservers (`ns12.wixdns.net`, `ns13.wixdns.net`). Two paths to finish:

**Path A (recommended — keep Wix nameservers, add A records at Wix):**
1. Log into Wix → Domains → mentalvelocitysystem.com → Advanced → Edit DNS records.
2. Add an `A` record:
   - Host: `@` (or leave blank for apex)
   - Value: `76.76.21.21`
   - TTL: default
3. Add a second `A` record:
   - Host: `www`
   - Value: `76.76.21.21`
   - TTL: default
4. Save. Propagation: usually <1 hour, sometimes up to 48.
5. Vercel will auto-issue a TLS cert once verification passes; you'll get an email.

**Path B (Vercel-managed nameservers — only if you don't host other Wix DNS records on this domain):**
1. Wix → Domains → Advanced → change nameservers to:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
2. Wait for propagation. Vercel handles all DNS records from there.
3. **Caveat:** any non-Vercel records (email MX, etc.) you have at Wix today will stop resolving until you re-create them in Vercel DNS.

After DNS propagates:
- Update Supabase Auth Site URL: https://supabase.com/dashboard/project/pguqugmqyrjcwzkdzpel/auth/url-configuration → set Site URL to `https://mentalvelocitysystem.com` and add `https://www.mentalvelocitysystem.com` to additional redirect URLs.
- Verify `https://mentalvelocitysystem.com` loads the marketing page with a valid TLS cert.

### 4. Resend account + SMTP swap — Day 5 (in progress: sandbox first, real domain backlog)
- **Phase 1 (Day 5, in progress):** Use Resend onboarding sandbox to unblock dev testing.
  - Restriction: sandbox only sends to the email tied to your Resend account (i.e. dannygreer@gmail.com and its plus-aliases). Sufficient for `dannygreer+s*@gmail.com` test students — INSUFFICIENT for real cohort.
  - Steps:
    1. Sign up at https://resend.com (use Google sign-in for speed).
    2. Resend dashboard → API Keys → Create → name "supabase-auth", scope "Sending access".
    3. Resend dashboard → Settings → SMTP → grab the SMTP credentials (host: smtp.resend.com, port: 587, user: "resend", pass: <API key>).
    4. Supabase dashboard → https://supabase.com/dashboard/project/pguqugmqyrjcwzkdzpel/auth/providers → scroll to "SMTP Settings" → enable custom SMTP → paste Resend creds. Set "Sender email" to `onboarding@resend.dev` and "Sender name" to "MVS".
    5. Save. Test by hitting `/auth/login` with dannygreer+test@gmail.com — magic link should arrive within seconds without rate-limit errors.
- **Phase 2 (BLOCKER for first real cohort):** Verify a real sending domain.
  - Recommend `mail.mentalvelocitysystem.com` (subdomain keeps marketing/transactional separate, isolates DNS impact).
  - Steps:
    1. Resend dashboard → Domains → Add domain → enter `mail.mentalvelocitysystem.com`.
    2. Resend will display DNS records to add (typically: 1 SPF TXT, 1 DKIM CNAME or TXT, optional DMARC TXT, optional MX for bounce handling).
    3. Add those records at Wix (same DNS provider as the apex domain — see item #3 above).
    4. Wait for Resend's verification check (auto, runs every few minutes).
    5. Update Supabase SMTP "Sender email" from `onboarding@resend.dev` to `noreply@mail.mentalvelocitysystem.com`.
    6. Update `RESEND_FROM_EMAIL` env var in `.env.local` and Vercel to match (e.g., `MVS <noreply@mail.mentalvelocitysystem.com>`). The `src/lib/email.ts` helper reads this; default is `onboarding@resend.dev`.
  - **Hard blocker for first cohort.** Don't invite any real student until done. Sandbox sender (`onboarding@resend.dev`) only delivers to dannygreer@gmail.com.

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
