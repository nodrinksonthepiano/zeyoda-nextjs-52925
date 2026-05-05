'use client';

import React, { useState, FormEvent } from 'react';

import {
  BURIAL_PROMPT_PLACEHOLDER,
  HE_WAS_TAKEN_BODY,
  HE_WAS_TAKEN_TITLE,
} from '@/app/constants/treasureCopy';

const DEFAULT_VIDEO = '/assets/10GOSHEESH.mp4';

interface BurialWizardProps {
  variant?: 'interest' | 'revoked';
  artistSlugAttempted?: string | null;
  promptLead?: React.ReactNode;
}

export default function BurialWizard({
  variant = 'interest',
  artistSlugAttempted,
  promptLead,
}: BurialWizardProps) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setBusy(true);
    setDoneMsg(null);
    try {
      const res = await fetch('/api/treasure-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_value: email.trim(),
          artist_slug_attempted: artistSlugAttempted ?? undefined,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || j.error || 'Submit failed');
      }

      setDoneMsg('Recorded. Talk soon.');
      setEmail('');
    } catch {
      setDoneMsg('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-12 bg-black text-white">
      {variant === 'revoked' && (
        <div className="text-center mb-6 max-w-md">
          <h1 className="text-3xl font-black tracking-tight mb-2" style={{ fontFamily: 'Bungee, cursive' }}>
            {HE_WAS_TAKEN_TITLE}
          </h1>
          <p className="text-gray-300">{HE_WAS_TAKEN_BODY}</p>
        </div>
      )}

      <div className="w-full max-w-lg rounded-xl overflow-hidden border border-slate-700 shadow-2xl mb-10">
        <video
          className="w-full aspect-video object-cover bg-slate-900"
          src={DEFAULT_VIDEO}
          autoPlay
          muted
          loop
          playsInline
        />
      </div>

      {variant === 'interest' && (
        <div className="max-w-xl text-center mb-6">
          <p className="text-2xl font-bold mb-2" style={{ fontFamily: 'Bungee, cursive', color: '#fbbf24' }}>
            AH HA
          </p>
          {promptLead ?? (
            <p className="text-gray-300">{BURIAL_PROMPT_PLACEHOLDER}</p>
          )}
        </div>
      )}

      <form
        onSubmit={submit}
        className="w-full max-w-md flex flex-col gap-4 bg-slate-900/80 border border-slate-700 rounded-xl p-6 backdrop-blur"
      >
        <label htmlFor="burial-email" className="text-sm text-slate-300">
          Your email
        </label>
        <input
          id="burial-email"
          type="email"
          autoComplete="email"
          placeholder="artist@studio.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-3 transition-colors"
        >
          {busy ? 'Sending…' : 'Dig me up'}
        </button>
        {doneMsg && <p className="text-center text-sm text-slate-300">{doneMsg}</p>}
      </form>
    </div>
  );
}
