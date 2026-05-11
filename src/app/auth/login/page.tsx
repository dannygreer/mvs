'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import RadarBackdrop from '@/components/marketing/RadarBackdrop';

// Magic-link sign-in for ADMINS only (super_admin, org_admin).
// Students don't sign in — they receive a /take/[token] URL from their
// facilitator and run the assessment without any authentication.
//
// Most reliable when the user opens the magic-link in the same browser
// session that initiated the request (Gmail prefetch can consume the
// token otherwise — known platform quirk).
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
    <div className="relative min-h-screen flex flex-col bg-zinc-950 text-zinc-100 mvs-body overflow-hidden">
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,#0e1422_0%,#050810_60%,#000_100%)] pointer-events-none"
        aria-hidden="true"
      />
      <RadarBackdrop className="absolute right-[-25%] top-1/2 -translate-y-1/2 w-[1100px] h-[1100px] opacity-60 pointer-events-none" />

      <header className="relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-10 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/mvs-icon.png"
            alt="MVS"
            width={28}
            height={28}
            className="rounded"
          />
          <span className="text-sm font-medium tracking-wider text-zinc-300 group-hover:text-zinc-100 transition-colors">
            MVS
          </span>
        </Link>
        <Link
          href="/"
          className="mvs-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 hover:text-[#4FA9F0] transition-colors"
        >
          ← Home
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          <div className="relative">
            {/* Outer bracket chrome */}
            <span className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[#4FA9F0]" />
            <span className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[#4FA9F0]" />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[#4FA9F0]" />
            <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[#4FA9F0]" />

            <div
              className="relative bg-zinc-950/65 backdrop-blur-md mvs-mono"
              style={{
                border: '1px solid rgba(1,111,212,0.45)',
                boxShadow:
                  'inset 0 0 30px rgba(1,111,212,0.06), 0 0 60px rgba(1,111,212,0.10)',
              }}
            >
              {/* Header bar */}
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{
                  borderBottom: '1px solid rgba(1,111,212,0.35)',
                  background:
                    'linear-gradient(180deg, rgba(1,111,212,0.18) 0%, rgba(1,111,212,0.04) 100%)',
                }}
              >
                <h1 className="text-sm font-semibold text-[#4FA9F0] tracking-[0.28em] uppercase">
                  ADMIN ACCESS
                </h1>
                <span className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-emerald-400">
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70" />
                    <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </span>
                  SECURE
                </span>
              </div>

              <div className="p-6 sm:p-8 mvs-body">
                {status === 'sent' ? (
                  <div className="text-center space-y-3 py-4">
                    <p className="mvs-mono text-[11px] uppercase tracking-[0.25em] text-[#4FA9F0]">
                      LINK DISPATCHED
                    </p>
                    <p className="text-zinc-100 text-base">
                      Check <span className="text-[#4FA9F0]">{email}</span>.
                    </p>
                    <p className="text-sm text-zinc-400">
                      Open the link in this browser to complete sign-in.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label
                        htmlFor="email"
                        className="mvs-mono block text-[10px] uppercase tracking-[0.25em] text-zinc-400 mb-2"
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
                        placeholder="you@example.com"
                        className="w-full px-4 py-3 bg-zinc-900/70 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#4FA9F0]/40 disabled:opacity-60 mvs-body"
                        style={{ border: '1px solid rgba(1,111,212,0.30)' }}
                      />
                    </div>

                    {status === 'error' && errorMessage && (
                      <p className="text-sm text-red-400">{errorMessage}</p>
                    )}

                    <button
                      type="submit"
                      disabled={status === 'sending' || !email.trim()}
                      className="group relative w-full px-6 py-3 mvs-mono text-sm uppercase tracking-[0.18em] text-[#4FA9F0] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(1,111,212,0.06) 0%, rgba(1,111,212,0.20) 100%)',
                        border: '1px solid rgba(1,111,212,0.55)',
                      }}
                    >
                      {/* corner brackets */}
                      <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#4FA9F0]" />
                      <span className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#4FA9F0]" />
                      <span className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-[#4FA9F0]" />
                      <span className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[#4FA9F0]" />
                      <span className="relative inline-flex items-center justify-center gap-2">
                        {status === 'sending' ? 'TRANSMITTING…' : 'SEND MAGIC LINK'}
                        {status !== 'sending' && (
                          <span aria-hidden="true">›</span>
                        )}
                      </span>
                    </button>
                  </form>
                )}
              </div>

              {/* Footer chrome */}
              <div
                className="flex items-center justify-between px-5 py-2 mvs-mono text-[10px] uppercase tracking-widest text-zinc-500"
                style={{
                  borderTop: '1px solid rgba(1,111,212,0.25)',
                  background: 'rgba(1,111,212,0.04)',
                }}
              >
                <span>SUPER_ADMIN / ORG_ADMIN</span>
                <span>SYS.OK</span>
              </div>
            </div>
          </div>

          <p className="mvs-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500 text-center mt-6">
            STUDENTS — your facilitator will send you a take link
          </p>
        </div>
      </main>
    </div>
  );
}
