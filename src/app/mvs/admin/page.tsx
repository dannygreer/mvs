import {
  getAllResponsesWide,
  getAllResponsesLong,
  getActiveScenario,
  getResponseTags,
  getAllScenarios,
} from '@/lib/db';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { signOut } from '@/actions/session';
import type {
  ResponseWideRow,
  ResponseLongRow,
  ResponseTag,
  Scenario,
  ScenarioListItem,
} from '@/types';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  let responsesWide: ResponseWideRow[] = [];
  let responsesLong: ResponseLongRow[] = [];
  let scenario: Scenario | null = null;
  let responseTags: ResponseTag[] = [];
  let scenarios: ScenarioListItem[] = [];
  let dbError: string | null = null;

  try {
    [responsesWide, responsesLong, scenario, scenarios] = await Promise.all([
      getAllResponsesWide(),
      getAllResponsesLong(),
      getActiveScenario(),
      getAllScenarios(),
    ]);
    if (scenario) {
      responseTags = await getResponseTags(scenario.dbId);
    }
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Failed to load data';
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">MVS — Admin</h1>
            <p className="text-sm text-zinc-500">
              {responsesWide.length} total responses
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/api/admin/export-csv?format=wide"
              className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
            >
              CSV (Wide)
            </a>
            <a
              href="/api/admin/export-csv?format=long"
              className="px-4 py-2 border border-zinc-300 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              CSV (Long)
            </a>
            <form action={signOut}>
              <button
                type="submit"
                className="px-4 py-2 border border-zinc-300 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {dbError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="text-sm font-medium text-red-800">Database error</p>
            <p className="text-sm text-red-600 mt-1">{dbError}</p>
            <p className="text-xs text-red-500 mt-2">
              Run <code>supabase/migration.sql</code> then{' '}
              <code>supabase/seed.sql</code> in the Supabase SQL Editor.
            </p>
          </div>
        )}

        <AdminDashboard
          responsesWide={responsesWide}
          responsesLong={responsesLong}
          scenario={scenario}
          responseTags={responseTags}
          scenarios={scenarios}
        />
      </main>
    </div>
  );
}
