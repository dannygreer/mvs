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
      <div className="border border-cyan-400/40 bg-cyan-400/5 rounded-lg p-8 text-center space-y-2">
        <p className="text-cyan-300 font-medium">Thanks. We&apos;ll be in touch.</p>
        <p className="text-zinc-400 text-sm">
          Expect a response within 2 business days.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
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
        <label htmlFor="name" className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          disabled={pending}
          className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40 disabled:opacity-60"
          placeholder="Your name"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          disabled={pending}
          className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40 disabled:opacity-60"
          placeholder="you@example.com"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="organization" className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            Organization
          </label>
          <input
            id="organization"
            name="organization"
            type="text"
            disabled={pending}
            className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40 disabled:opacity-60"
            placeholder="Optional"
          />
        </div>
        <div>
          <label htmlFor="organization_type" className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            Type
          </label>
          <select
            id="organization_type"
            name="organization_type"
            defaultValue=""
            disabled={pending}
            className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40 disabled:opacity-60"
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
        <label htmlFor="message" className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          disabled={pending}
          className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40 disabled:opacity-60"
          placeholder="Briefly describe your team or use case (optional)"
        />
      </div>
      {state?.status === 'error' && (
        <p className="text-sm text-red-400">{state.message}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full text-lg px-8 py-3 border border-cyan-400 text-cyan-300 rounded-lg hover:bg-cyan-400 hover:text-zinc-950 transition-colors font-medium disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Request a briefing'}
      </button>
      <p className="text-xs text-zinc-500 text-center">
        We&apos;ll respond within 2 business days.
      </p>
    </form>
  );
}
