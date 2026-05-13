'use client';

import type { ResponseLongRow, ResponseWideRow } from '@/types';

const CATEGORY_COLORS: Record<string, string> = {
  controlled: 'text-green-700 bg-green-50',
  acceptable: 'text-blue-700 bg-blue-50',
  premature: 'text-yellow-700 bg-yellow-50',
  unsafe: 'text-red-700 bg-red-50',
};

interface SummaryTabProps {
  responsesLong: ResponseLongRow[];
  responsesWide: ResponseWideRow[];
}

export default function SummaryTab({
  responsesLong,
  responsesWide,
}: SummaryTabProps) {
  if (responsesWide.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-500">
        No assessment data yet.
      </div>
    );
  }

  // === Category Distribution (pre vs post) ===
  const categorized = responsesLong.filter((r) => r.response_category);
  const preCat = categorized.filter((r) => r.phase === 'pre');
  const postCat = categorized.filter((r) => r.phase === 'post');

  const getCategoryDist = (rows: ResponseLongRow[]) => {
    const total = rows.length || 1;
    const counts: Record<string, number> = {
      controlled: 0,
      acceptable: 0,
      premature: 0,
      unsafe: 0,
    };
    for (const r of rows) {
      if (r.response_category && r.response_category in counts) {
        counts[r.response_category]++;
      }
    }
    return Object.entries(counts).map(([cat, count]) => ({
      category: cat,
      count,
      percent: ((count / total) * 100).toFixed(1),
    }));
  };

  const preDist = getCategoryDist(preCat);
  const postDist = getCategoryDist(postCat);

  // === Average RT per screen ===
  const screenRts: Record<string, { total: number; count: number }> = {};
  for (const r of responsesLong) {
    if (!screenRts[r.question_id])
      screenRts[r.question_id] = { total: 0, count: 0 };
    screenRts[r.question_id].total += r.rt_ms;
    screenRts[r.question_id].count++;
  }

  // === Branch path frequency ===
  // Only counts rows where branch_path is non-empty. Linear scenarios
  // (Phase 3 video Q1->Q4) write '' here on purpose; including them
  // would dominate the chart with a meaningless "(empty)" bucket.
  const pathCounts: Record<string, number> = {};
  for (const r of responsesWide) {
    if (!r.branch_path) continue;
    pathCounts[r.branch_path] = (pathCounts[r.branch_path] || 0) + 1;
  }
  const sortedPaths = Object.entries(pathCounts).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className="p-6 space-y-8">
      {/* Category Distribution */}
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">
          Category Distribution (Pre vs Post)
        </h3>
        {categorized.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No categorized responses yet. Tag responses in the Response Tagging
            tab first.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="py-2 px-4 text-left font-medium text-zinc-500">
                    Category
                  </th>
                  <th className="py-2 px-4 text-right font-medium text-zinc-500">
                    Pre-Training
                  </th>
                  <th className="py-2 px-4 text-right font-medium text-zinc-500">
                    Post-Training
                  </th>
                </tr>
              </thead>
              <tbody>
                {['controlled', 'acceptable', 'premature', 'unsafe'].map(
                  (cat) => {
                    const pre = preDist.find((d) => d.category === cat);
                    const post = postDist.find((d) => d.category === cat);
                    return (
                      <tr key={cat} className="border-b border-zinc-100">
                        <td className="py-2 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[cat] ?? ''}`}
                          >
                            {cat}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right font-mono">
                          {pre?.percent ?? '0.0'}% ({pre?.count ?? 0})
                        </td>
                        <td className="py-2 px-4 text-right font-mono">
                          {post?.percent ?? '0.0'}% ({post?.count ?? 0})
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Average RT per screen */}
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">
          Average Response Time by Screen
        </h3>
        {Object.keys(screenRts).length === 0 ? (
          <p className="text-sm text-zinc-500">No response data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="py-2 px-4 text-left font-medium text-zinc-500">
                    Screen
                  </th>
                  <th className="py-2 px-4 text-right font-medium text-zinc-500">
                    Avg RT
                  </th>
                  <th className="py-2 px-4 text-right font-medium text-zinc-500">
                    Responses
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(screenRts)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([screenId, data]) => (
                    <tr key={screenId} className="border-b border-zinc-100">
                      <td className="py-2 px-4 font-mono text-zinc-700">
                        {screenId}
                      </td>
                      <td className="py-2 px-4 text-right font-mono">
                        {(data.total / data.count / 1000).toFixed(1)}s
                      </td>
                      <td className="py-2 px-4 text-right text-zinc-500">
                        {data.count}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Branch path frequency */}
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">
          Branch Path Frequency
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="py-2 px-4 text-left font-medium text-zinc-500">
                  Path
                </th>
                <th className="py-2 px-4 text-right font-medium text-zinc-500">
                  Count
                </th>
                <th className="py-2 px-4 text-right font-medium text-zinc-500">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPaths.map(([path, count]) => (
                <tr key={path} className="border-b border-zinc-100">
                  <td className="py-2 px-4 font-mono text-zinc-700">
                    {path || '(empty)'}
                  </td>
                  <td className="py-2 px-4 text-right">{count}</td>
                  <td className="py-2 px-4 text-right font-mono">
                    {((count / responsesWide.length) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
