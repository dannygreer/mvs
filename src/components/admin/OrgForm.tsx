import type { OrgRow } from '@/lib/db';

interface OrgFormProps {
  action: (formData: FormData) => void | Promise<void>;
  initial?: Partial<OrgRow>;
  submitLabel: string;
}

const TYPES = ['hospital', 'police', 'military', 'other'];
const STATUSES = ['lead', 'active', 'completed', 'churned'];

export default function OrgForm({ action, initial, submitLabel }: OrgFormProps) {
  const dealDollars =
    initial?.deal_value_cents != null ? (initial.deal_value_cents / 100).toFixed(2) : '';

  return (
    <form action={action} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            type="text"
            required
            defaultValue={initial?.name ?? ''}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Type</label>
          <select
            name="type"
            defaultValue={initial?.type ?? ''}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <option value="">—</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Contact name
          </label>
          <input
            name="contact_name"
            type="text"
            defaultValue={initial?.contact_name ?? ''}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Contact email
          </label>
          <input
            name="contact_email"
            type="email"
            defaultValue={initial?.contact_email ?? ''}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Status</label>
          <select
            name="status"
            defaultValue={initial?.status ?? 'lead'}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Deal value (USD)
          </label>
          <input
            name="deal_value"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={dealDollars}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Session date
          </label>
          <input
            name="session_date"
            type="date"
            defaultValue={initial?.session_date ?? ''}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Notes</label>
        <textarea
          name="notes"
          rows={4}
          defaultValue={initial?.notes ?? ''}
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="px-5 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
