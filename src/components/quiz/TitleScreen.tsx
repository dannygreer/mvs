'use client';

import { useState } from 'react';
import type { Phase } from '@/types';

interface TitleScreenProps {
  onContinue: (firstName: string, lastName: string, phase: Phase) => void;
}

export default function TitleScreen({ onContinue }: TitleScreenProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phase, setPhase] = useState<Phase | null>(null);

  const canContinue =
    firstName.trim() !== '' && lastName.trim() !== '' && phase !== null;

  return (
    <div className="relative flex flex-col items-center justify-center flex-1 px-6">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat grayscale blur-sm"
        style={{ backgroundImage: "url('/bg-hero.jpg')" }}
      />
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md space-y-8 bg-white rounded-xl p-8 shadow-lg">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-zinc-900">MVS</h1>
          <p className="text-zinc-600 text-lg">Training Assessment</p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="firstName" className="sr-only">
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              placeholder="Enter your first name"
            />
          </div>

          <div>
            <label htmlFor="lastName" className="sr-only">
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              placeholder="Enter your last name"
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-700 text-center">
            Are you taking this assessment before or after training?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPhase('pre')}
              className={`py-3 rounded-lg font-medium text-sm transition-all border ${
                phase === 'pre'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-700 border-zinc-300 hover:border-zinc-400'
              }`}
            >
              Pre-Training
            </button>
            <button
              type="button"
              onClick={() => setPhase('post')}
              className={`py-3 rounded-lg font-medium text-sm transition-all border ${
                phase === 'post'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-700 border-zinc-300 hover:border-zinc-400'
              }`}
            >
              Post-Training
            </button>
          </div>
        </div>

        <button
          onClick={() =>
            canContinue &&
            onContinue(firstName.trim(), lastName.trim(), phase!)
          }
          disabled={!canContinue}
          className="w-full py-3 bg-zinc-900 text-white rounded-lg font-medium text-lg transition-colors hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
