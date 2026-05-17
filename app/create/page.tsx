import Link from 'next/link';

/**
 * Legacy standalone create flow — forbidden for production (unsafe legacy vault baked in historically).
 * `middleware.ts` redirects `/create` → `/`; this stub is a fallback if middleware is bypassed in dev tooling.
 */
export default function LegacyCreateBlockedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
      <div className="w-full max-w-lg space-y-4 text-center rounded-lg bg-gray-800 p-10 shadow-lg">
        <h1 className="text-2xl font-semibold">Create via onboarding</h1>
        <p className="text-gray-400 text-sm">
          Artist setup runs from the main experience (type zeyoda on <code>/</code> → factory onboarding). This URL is
          no longer supported.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
