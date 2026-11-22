import { useState } from "react";
import { Lock, Plus, Trash2, Download } from "lucide-react";
import type { JarvisStore } from "../hooks/useJarvisStore";
import type { MemoryType } from "../types/jarvis";
import { downloadTextFile } from "../utils/exportHtml";

interface MemoryViewProps {
  store: JarvisStore;
}

const MEMORY_TYPES: MemoryType[] = [
  "User Preferences",
  "Project Memory",
  "Conversation Context",
  "Task History",
  "Important Instructions",
  "Skill Configuration",
  "System Settings",
];

export function MemoryView({ store }: MemoryViewProps) {
  const { state, addMemory, updateMemory, deleteMemory } = store;
  const [filterType, setFilterType] = useState<"All" | MemoryType>("All");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<MemoryType>("Project Memory");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const filtered = state.memories.filter((m) => {
    if (filterType !== "All" && m.type !== filterType) return false;
    if (
      search.trim() &&
      !m.title.toLowerCase().includes(search.toLowerCase()) &&
      !m.content.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    addMemory(type, title, content, true);
    setTitle("");
    setContent("");
  };

  const handleExportMemories = () => {
    downloadTextFile(
      "jarvis-memory-backup.json",
      JSON.stringify(state.memories, null, 2),
      "application/json"
    );
  };

  return (
    <div className="space-y-6">
      <section className="jarvis-surface p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-blue-500/25">
          <div>
            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Memory Center
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Persistent local memory across 7 categories. Toggle which memories are supplied as
              context to the JARVIS AI Brain.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportMemories}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-blue-500/30 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON Backup</span>
          </button>
        </div>

        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MemoryType)}
              aria-label="Memory type"
              className="px-3 py-2 text-sm rounded-lg bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-zinc-100"
            >
              {MEMORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Memory title..."
              required
              className="sm:col-span-2 px-3 py-2 text-sm rounded-lg bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Details JARVIS should remember across sessions..."
              required
              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-zinc-100"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save Memory</span>
            </button>
          </div>
        </form>
      </section>

      <section className="jarvis-surface p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "All" | MemoryType)}
            aria-label="Filter memories by type"
            className="sm:w-60 px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-zinc-100"
          >
            <option value="All">All Memory Types ({state.memories.length})</option>
            {MEMORY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stored memories..."
            className="sm:w-72 px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-blue-500/15">
          {filtered.map((m) => (
            <div key={m.id} className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium text-blue-600 dark:text-blue-400">{m.type}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {new Date(m.updatedAt).toLocaleDateString()}
                  </span>
                  {m.protected && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                        <Lock className="w-3 h-3" /> Protected Rule
                      </span>
                    </>
                  )}
                </div>
                <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {m.title}
                </h3>
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {m.content}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => updateMemory(m.id, { activeInContext: !m.activeInContext })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border whitespace-nowrap ${
                    m.activeInContext
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400"
                      : "border-zinc-200 dark:border-blue-500/30 text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {m.activeInContext ? "In Context" : "Paused"}
                </button>
                {!m.protected && (
                  <button
                    type="button"
                    onClick={() => deleteMemory(m.id)}
                    aria-label={`Delete ${m.title}`}
                    className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
