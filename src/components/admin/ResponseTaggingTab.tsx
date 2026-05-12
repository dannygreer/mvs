'use client';

import { useTransition } from 'react';
import type {
  Scenario,
  ResponseTag,
  ResponseCategory,
  ScenarioOption,
} from '@/types';
import { adminUpsertResponseTag, adminDeleteResponseTag } from '@/actions/admin';

const CATEGORIES: ResponseCategory[] = [
  'controlled',
  'acceptable',
  'premature',
  'unsafe',
];

const CATEGORY_COLORS: Record<ResponseCategory, string> = {
  controlled: 'bg-green-100 text-green-700',
  acceptable: 'bg-blue-100 text-blue-700',
  premature: 'bg-yellow-100 text-yellow-700',
  unsafe: 'bg-red-100 text-red-700',
};

interface ResponseTaggingTabProps {
  scenario: Scenario | null;
  tags: ResponseTag[];
}

export default function ResponseTaggingTab({
  scenario,
  tags,
}: ResponseTaggingTabProps) {
  if (!scenario) {
    return (
      <div className="p-8 text-center text-zinc-500">No scenario loaded.</div>
    );
  }

  const tagMap: Record<string, string> = {};
  for (const tag of tags) {
    tagMap[`${tag.screen_id}:${tag.option_label}`] = tag.response_category;
  }

  const screens = Object.values(scenario.screens).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-zinc-900">
          Response Category Tagging
        </h3>
        <p className="text-sm text-zinc-500 mt-1">
          Assign behavioral categories to each option. These are never shown to
          participants.
        </p>
      </div>

      <div className="space-y-4">
        {screens.map((screen) => (
          <div
            key={screen.dbId}
            className="border border-zinc-200 rounded-lg overflow-hidden"
          >
            <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">
              <span className="font-mono text-sm font-medium text-zinc-900">
                {screen.id}
              </span>
              <span className="text-sm text-zinc-500 ml-2">
                {(screen.prompt || screen.text || '').substring(0, 60)}
                {((screen.prompt || screen.text || '').length > 60 ? '…' : '')}
              </span>
            </div>
            <div className="p-4 space-y-2">
              {screen.options.map((option) => (
                <TagRow
                  key={option.id}
                  scenarioFk={scenario.dbId}
                  screenId={screen.id}
                  option={option}
                  currentCategory={
                    tagMap[`${screen.id}:${option.label}`] ?? null
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TagRow({
  scenarioFk,
  screenId,
  option,
  currentCategory,
}: {
  scenarioFk: string;
  screenId: string;
  option: ScenarioOption;
  currentCategory: string | null;
}) {
  const [pending, startTransition] = useTransition();

  const handleClick = (category: ResponseCategory) => {
    if (currentCategory === category) {
      startTransition(() =>
        adminDeleteResponseTag(scenarioFk, screenId, option.label),
      );
    } else {
      startTransition(() =>
        adminUpsertResponseTag(scenarioFk, screenId, option.label, category),
      );
    }
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="font-mono text-sm font-medium text-zinc-500 w-6">
        {option.label}.
      </span>
      <span className="text-sm text-zinc-700 flex-1">{option.text}</span>
      <div className="flex gap-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => handleClick(cat)}
            disabled={pending}
            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
              currentCategory === cat
                ? CATEGORY_COLORS[cat]
                : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
