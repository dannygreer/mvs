import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSuperAdmin } from '@/lib/auth';
import { getOrg, getOrgRoster } from '@/lib/db';
import { updateOrg } from '@/actions/orgs';
import OrgForm from '@/components/admin/OrgForm';

export const dynamic = 'force-dynamic';

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;
  const org = await getOrg(id);
  if (!org) notFound();

  const roster = await getOrgRoster(id);
  const updateAction = updateOrg.bind(null, id);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link
              href="/mvs/admin/orgs"
              className="text-xs text-zinc-500 hover:text-zinc-700"
            >
              ← Organizations
            </Link>
            <h1 className="text-xl font-bold text-zinc-900">{org.name}</h1>
            <p className="text-xs text-zinc-500">
              Updated {new Date(org.updated_at).toLocaleString()}
            </p>
          </div>
          <Link
            href={`/mvs/admin/orgs/${id}/invite`}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            + Invite students
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <section className="bg-white border border-zinc-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide mb-4">
            Details
          </h2>
          <OrgForm
            action={updateAction}
            initial={org}
            submitLabel="Save changes"
          />
        </section>

        <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">
              Roster
            </h2>
            <span className="text-xs text-zinc-500">{roster.length} members</span>
          </div>
          {roster.length === 0 ? (
            <p className="px-6 py-12 text-center text-zinc-500 text-sm">
              No students yet. Click <strong>+ Invite students</strong> to add them.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-right px-4 py-3 font-medium">Completed</th>
                  <th className="text-left px-4 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-zinc-100 last:border-0"
                  >
                    <td className="px-4 py-3 text-zinc-900">
                      {m.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{m.email ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-600">{m.role}</td>
                    <td className="px-4 py-3 text-right text-zinc-600 tabular-nums">
                      {m.completed_count}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
