'use client';

import { useActionState } from 'react';
import { submitLead, type SubmitLeadResult } from '@/actions/leads';

export default function ContactForm() {
  const [state, action, pending] = useActionState<SubmitLeadResult | null, FormData>(
    submitLead,
    null
  );

  if (state?.status === 'ok') {
    return (
      <div
        className="bg-zinc-950/40 p-8 text-center space-y-2"
        style={{ border: '1px solid rgba(1,111,212,0.45)' }}
      >
        <p className="mvs-display text-2xl font-bold uppercase tracking-wide text-[#4FA9F0]">
          Transmission received.
        </p>
        <p className="mvs-mono text-xs uppercase tracking-widest text-zinc-400">
          Response within 2 business days
        </p>
      </div>
    );
  }

  const fieldClass =
    'mvs-mono w-full px-4 py-3 bg-zinc-950/60 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:bg-zinc-950 disabled:opacity-60 transition-colors';
  const labelClass =
    'mvs-mono block text-[10px] font-semibold text-[#4FA9F0] uppercase tracking-[0.25em] mb-2';
  const fieldStyle = {
    border: '1px solid rgba(1,111,212,0.30)',
    borderRadius: 0,
  } as React.CSSProperties;

  return (
    <form action={action} className="space-y-5">
      {/* Honeypot — bots fill all inputs they see; real users never see this. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          top: 'auto',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        <label htmlFor="company_homepage">
          Don&apos;t fill this in
          <input
            id="company_homepage"
            name="company_homepage"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      <div>
        <label htmlFor="name" className={labelClass}>
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          disabled={pending}
          className={fieldClass}
          style={fieldStyle}
          placeholder="Your name"
        />
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          disabled={pending}
          className={fieldClass}
          style={fieldStyle}
          placeholder="you@example.com"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="organization" className={labelClass}>
            Organization
          </label>
          <input
            id="organization"
            name="organization"
            type="text"
            disabled={pending}
            className={fieldClass}
            style={fieldStyle}
            placeholder="Optional"
          />
        </div>
        <div>
          <label htmlFor="organization_type" className={labelClass}>
            Type
          </label>
          <select
            id="organization_type"
            name="organization_type"
            defaultValue=""
            disabled={pending}
            className={fieldClass}
            style={fieldStyle}
          >
            <option value="">—</option>
            <option value="hospital">Hospital</option>
            <option value="police">Law Enforcement</option>
            <option value="defense">Defense</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="message" className={labelClass}>
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          disabled={pending}
          className={fieldClass}
          style={fieldStyle}
          placeholder="Briefly describe your team or use case (optional)"
        />
      </div>
      {state?.status === 'error' && (
        <p className="mvs-mono text-xs uppercase tracking-widest text-red-400">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mvs-mono w-full px-8 py-3 text-sm uppercase tracking-[0.25em] text-[#4FA9F0] hover:text-white hover:bg-[#016FD4] transition-colors disabled:opacity-50"
        style={{
          border: '1px solid rgba(1,111,212,0.55)',
          borderRadius: 0,
          boxShadow: '0 0 24px rgba(1,111,212,0.20)',
        }}
      >
        {pending ? 'Transmitting…' : 'Request a briefing ›'}
      </button>
      <p className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-500 text-center">
        Response within 2 business days
      </p>
    </form>
  );
}
