import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-neutral-950 text-center">
      <p className="mb-2 text-lg font-semibold text-white">Page not found</p>
      <p className="mb-6 text-sm text-neutral-500">This conversation may have been deleted.</p>
      <Link
        href="/"
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-500 transition-colors"
      >
        New conversation
      </Link>
    </div>
  );
}
