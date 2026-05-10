'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Magic-link sign-in for ADMINS only (super_admin, org_admin).
// Students don't sign in — they receive a /take/[token] URL from their
// facilitator and run the assessment without any authentication.
//
// This is a thin form. The /auth/callback PKCE handler from Day 1 still
// processes the click. Most reliable when used from the same browser session
// the user initiated the request from (Gmail prefetch can consume the token
// otherwise — known platform quirk).
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }
    setStatus('sent');
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-screen bg-zinc-50 px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900">Admin sign-in</h1>
          <p className="text-zinc-500 mt-1 text-sm">
            We&apos;ll email you a magic link.
          </p>
        </div>

        {status === 'sent' ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-6 text-center space-y-2">
            <p className="text-zinc-900 font-medium">Check your email</p>
            <p className="text-sm text-zinc-500">
              We sent a sign-in link to <strong>{email}</strong>. Open it in
              this browser to complete sign-in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'sending'}
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent disabled:bg-zinc-100"
                placeholder="you@example.com"
              />
            </div>

            {status === 'error' && errorMessage && (
              <p className="text-sm text-red-600">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={status === 'sending' || !email.trim()}
              className="w-full py-3 bg-zinc-900 text-white rounded-lg font-medium transition-colors hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed"
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
