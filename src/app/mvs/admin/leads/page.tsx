import Link from 'next/link';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { requireSuperAdmin } from '@/lib/auth';
import { updateLeadStatus } from '@/actions/leads';

export const dynamic = 'force-dynamic';

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'dropped'] as const;

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-emerald-100 text-emerald-700',
  contacted: 'bg-blue-100 text-blue-700',
  qualified: 'bg-amber-100 text-amber-700',
  converted: 'bg-purple-100 text-purple-700',
  dropped: 'bg-zinc-100 text-zinc-500',
};

type Lead = {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  organization_type: string | null;
  message: string | null;
  status: (typeof STATUSES)[number];
  created_at: string;
};

export default async function LeadsPage() {
  await requireSuperAdmin();

  const admin = createServiceClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data, error } = await admin
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });
  const leads = (data ?? []) as Lead[];

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link
              href="/mvs/admin"
              className="text-xs text-zinc-500 hover:text-zinc-700"
            >
              ← Admin
            </Link>
            <h1 className="text-xl font-bold text-zinc-900">Leads</h1>
            <p className="text-sm text-zinc-500">{leads.length} total</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-6">
            Failed to load leads: {error.message}
          </div>
        )}
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          {leads.length === 0 ? (
            <p className="px-6 py-12 text-center text-zinc-500 text-sm">
              No leads yet. They&apos;ll appear here as the marketing-page
              contact form gets submissions.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Organization</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Message</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-zinc-100 last:border-0 align-top"
                  >
                    <td className="px-4 py-3 text-zinc-900 font-medium">
                      {l.name}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      <a
                        href={`mailto:${l.email}`}
                        className="hover:underline"
                      >
                        {l.email}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {l.organization ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {l.organization_type ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 max-w-xs">
                      <p className="line-clamp-3 whitespace-pre-line">
                        {l.message ?? '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <form
                        action={updateLeadStatus}
                        className="inline-flex"
                      >
                        <input type="hidden" name="id" value={l.id} />
                        <select
                          name="status"
                          defaultValue={l.status}
                          onChange={(e) =>
                            (e.currentTarget.form as HTMLFormElement).requestSubmit()
                          }
                          className={`text-xs font-medium rounded px-2 py-0.5 border-0 cursor-pointer ${
                            STATUS_STYLE[l.status] ?? 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
