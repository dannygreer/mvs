import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/auth';
import { listOrgs } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<string, string> = {
  lead: 'bg-zinc-100 text-zinc-700',
  active: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-blue-100 text-blue-700',
  churned: 'bg-red-100 text-red-700',
};

function formatDollars(cents: number | null): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export default async function OrgsListPage() {
  await requireSuperAdmin();
  const orgs = await listOrgs();

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link href="/mvs/admin" className="text-xs text-zinc-500 hover:text-zinc-700">
              ← Admin
            </Link>
            <h1 className="text-xl font-bold text-zinc-900">Organizations</h1>
            <p className="text-sm text-zinc-500">{orgs.length} total</p>
          </div>
          <Link
            href="/mvs/admin/orgs/new"
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            + New org
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          {orgs.length === 0 ? (
            <p className="px-6 py-12 text-center text-zinc-500">
              No orgs yet. Create the first one.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Deal</th>
                  <th className="text-right px-4 py-3 font-medium">Students</th>
                  <th className="text-left px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/mvs/admin/orgs/${o.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {o.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{o.type ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                          STATUS_STYLES[o.status] ?? 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 tabular-nums">
                      {formatDollars(o.deal_value_cents)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 tabular-nums">
                      {o.student_count}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(o.created_at).toLocaleDateString()}
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
