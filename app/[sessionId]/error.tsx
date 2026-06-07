'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-neutral-950 text-center">
      <p className="mb-2 text-sm font-medium text-red-400">Something went wrong</p>
      <p className="mb-6 text-xs text-neutral-500">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-500 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
