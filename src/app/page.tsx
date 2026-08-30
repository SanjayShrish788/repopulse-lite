export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-2xl flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            RepoPulse Lite
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400">
            GitHub repository health analysis — coming soon.
          </p>
        </div>

        {/* Placeholder input — wired up in a future task */}
        <form className="w-full flex flex-col sm:flex-row gap-3">
          <input
            id="repo-url-input"
            type="url"
            placeholder="https://github.com/owner/repository"
            disabled
            className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            id="analyze-btn"
            type="submit"
            disabled
            className="rounded-lg bg-zinc-900 dark:bg-zinc-50 px-6 py-3 text-sm font-semibold text-white dark:text-zinc-900 transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Analyze
          </button>
        </form>

        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          Analysis is read-only. Only public repositories are supported.
        </p>
      </div>
    </main>
  );
}
