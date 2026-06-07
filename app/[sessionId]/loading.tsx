export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-neutral-950">
      <div className="flex items-center gap-3 text-neutral-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-600 border-t-sky-500" />
        <span className="text-sm">Loading conversation...</span>
      </div>
    </div>
  );
}
