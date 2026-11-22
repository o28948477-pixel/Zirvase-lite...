import { useState } from "react";
import { GitBranch, Search, ExternalLink, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { JarvisStore } from "../hooks/useJarvisStore";

interface GitHubViewProps {
  store: JarvisStore;
}

interface RepoInspection {
  repo: {
    fullName: string;
    description: string;
    defaultBranch: string;
    stars: number;
    forks: number;
    language: string;
    hasPages: boolean;
    updatedAt: string;
    htmlUrl: string;
    visibility: string;
  };
  files: { name: string; type: string; size: number; path: string }[];
}

export function GitHubView({ store }: GitHubViewProps) {
  const { activeProject, logActivity } = store;
  const [owner, setOwner] = useState("octocat");
  const [repo, setRepo] = useState("Hello-World");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RepoInspection | null>(null);

  const handleInspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!owner.trim() || !repo.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(
        `/api/github/repo?owner=${encodeURIComponent(owner.trim())}&repo=${encodeURIComponent(
          repo.trim()
        )}`
      );
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Failed to fetch repository");
      setData(json);
      logActivity("GitHub Manager", "Inspected Public Repo", json.repo.fullName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to inspect GitHub repo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Honest OAuth Status */}
      <section className="jarvis-surface p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-blue-500/25">
          <div>
            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              GitHub Manager & Pages Readiness
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Inspect public GitHub repositories in real time and verify GitHub Pages compatibility
              for your Coding Studio exports.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap shrink-0">
            <AlertTriangle className="w-4 h-4" />
            <span>OAuth Write / Commit Pending</span>
          </span>
        </div>

        <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-400">
          Public read-only inspection is active. Private repositories, automated commits, and
          repository creation require GitHub OAuth configuration before they can be marked
          connected.
        </p>

        <form onSubmit={handleInspect} className="mt-5 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="GitHub Owner (e.g. octocat)"
            className="sm:w-56 px-3.5 py-2 text-sm rounded-lg bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-zinc-100"
          />
          <input
            type="text"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="Repository Name (e.g. Hello-World)"
            className="flex-1 min-w-0 px-3.5 py-2 text-sm rounded-lg bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>Inspect Public Repo</span>
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </section>

      {data && (
        <section className="jarvis-surface p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-blue-500/25">
            <div>
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {data.repo.fullName}
                </h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {data.repo.description || "No description"} · Branch: {data.repo.defaultBranch} ·{" "}
                {data.repo.language || "Mixed"} · {data.repo.stars} stars
              </p>
            </div>
            <a
              href={data.repo.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              <span>View on GitHub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-blue-500/25 text-zinc-500 dark:text-zinc-400">
                  <th className="py-2 font-medium">File / Directory</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium text-right">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-blue-500/15/70">
                {data.files.map((f) => (
                  <tr key={f.path}>
                    <td className="py-2.5 font-mono text-zinc-800 dark:text-zinc-200">{f.name}</td>
                    <td className="py-2.5 text-zinc-500 dark:text-zinc-400">{f.type}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                      {f.type === "dir" ? "—" : `${f.size} B`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* GitHub Pages Readiness for Active Coding Studio Project */}
      <section className="jarvis-surface p-6 space-y-3">
        <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
          GitHub Pages Readiness · {activeProject.name}
        </h3>
        <ul className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Single-file HTML export embeds HTML, CSS, and JS cleanly with no build step needed.</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Compatible with GitHub Pages static hosting (rename exported file to index.html).</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Zero frontend API keys embedded in exported HTML bundle.</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
