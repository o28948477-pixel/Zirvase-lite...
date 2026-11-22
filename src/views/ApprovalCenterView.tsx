import { useState } from "react";
import {
  Check,
  CheckCircle2,
  ListChecks,
  Rocket,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type { JarvisStore } from "../hooks/useJarvisStore";

interface ApprovalCenterViewProps {
  store: JarvisStore;
}

export function ApprovalCenterView({ store }: ApprovalCenterViewProps) {
  const {
    state,
    pendingApprovalsCount,
    approveAndApplyUpdate,
    rejectUpdate,
    rollbackUpdate,
    openSettings,
  } = store;
  const [showQueue, setShowQueue] = useState(pendingApprovalsCount > 0);
  const [filter, setFilter] = useState<"pending" | "history" | "all">("all");

  const nextWaiting = state.approvals.find((a) => a.status === "Waiting for Approval");
  const rollbackableCount = state.approvals.filter(
    (a) => a.status === "Completed" && a.rollbackSnapshot
  ).length;

  const filtered = state.approvals.filter((a) => {
    if (filter === "pending") return a.status === "Waiting for Approval";
    if (filter === "history") return a.status !== "Waiting for Approval";
    return true;
  });

  const highlights = [
    "Better AI response",
    "Enhanced memory",
    "New skills & tools",
    "Improved security",
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Update Center Card */}
      <section className="jarvis-surface p-6 space-y-5">
        <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-[#0B193D] border border-blue-200 dark:border-sky-400/35 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500/25 to-violet-600/25 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0">
              <Rocket className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-zinc-900 dark:text-white">
                  JARVIS v2.0.0
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500 text-white">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-slate-300 mt-0.5">
                New features &amp; improvements
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openSettings("system")}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-cyan-300 hover:underline shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Self-Evolve</span>
          </button>
        </div>

        <div className="space-y-2.5">
          <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-white">
            What&apos;s New?
          </h3>
          <ul className="space-y-2">
            {highlights.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-slate-200"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              if (nextWaiting) {
                approveAndApplyUpdate(nextWaiting.id);
              } else {
                openSettings("system");
              }
            }}
            className="jarvis-gradient-btn w-full py-3 rounded-full text-sm font-semibold text-white transition-transform active:scale-[0.99]"
          >
            {nextWaiting ? `Apply Update (${nextWaiting.title})` : "Apply Update"}
          </button>

          <button
            type="button"
            onClick={() => {
              setFilter("pending");
              setShowQueue((v) => !v);
            }}
            className="w-full p-3.5 rounded-xl bg-blue-50/50 dark:bg-[#08122E] border border-blue-200/70 dark:border-sky-400/25 flex items-center justify-between text-left hover:border-blue-400/60"
          >
            <span className="flex items-center gap-2.5 text-sm font-medium text-zinc-900 dark:text-white">
              <ListChecks className="w-4 h-4 text-blue-500 dark:text-cyan-300" />
              <span>Pending Changes</span>
            </span>
            <span className="min-w-6 h-6 px-2 rounded-full bg-violet-600 text-xs font-mono tabular-nums font-bold text-white flex items-center justify-center">
              {pendingApprovalsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilter("history");
              setShowQueue(true);
            }}
            className="w-full p-3.5 rounded-xl bg-blue-50/50 dark:bg-[#08122E] border border-blue-200/70 dark:border-sky-400/25 flex items-center justify-between text-left hover:border-blue-400/60"
          >
            <span className="flex items-center gap-2.5 text-sm font-medium text-zinc-900 dark:text-white">
              <RotateCcw className="w-4 h-4 text-fuchsia-400" />
              <span>
                Rollback Option
                <span className="block text-[11px] font-normal text-zinc-500 dark:text-slate-400">
                  {rollbackableCount > 0 ? `${rollbackableCount} snapshot(s) available` : "Available"}
                </span>
              </span>
            </span>
          </button>
        </div>
      </section>

      {showQueue && (
        <section className="jarvis-surface p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-blue-200/70 dark:border-sky-400/20">
            <div className="inline-flex items-center p-1 rounded-full bg-blue-50 dark:bg-[#08102A] border border-blue-200 dark:border-sky-400/25">
              {(["all", "pending", "history"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1 text-xs font-medium rounded-full capitalize whitespace-nowrap ${
                    filter === tab
                      ? "jarvis-gradient-btn text-white"
                      : "text-zinc-600 dark:text-slate-300"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowQueue(false)}
              className="text-xs text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white"
            >
              Hide
            </button>
          </div>

          <div className="space-y-3">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500 dark:text-slate-400">
                No update proposals in this view.
              </p>
            ) : (
              filtered.map((item) => {
                const isWaiting = item.status === "Waiting for Approval";
                const isCompleted = item.status === "Completed";
                return (
                  <article key={item.id} className="p-4 jarvis-subsurface space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] text-blue-600 dark:text-cyan-300">
                          {item.source} · {item.area}
                        </p>
                        <h4 className="font-display text-sm font-semibold text-zinc-900 dark:text-white">
                          {item.title}
                        </h4>
                      </div>
                      <span className="text-[11px] font-semibold text-zinc-500 dark:text-slate-300 whitespace-nowrap">
                        {item.status}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-slate-300">
                      {item.proposedSolution}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {isWaiting && (
                        <>
                          <button
                            type="button"
                            onClick={() => approveAndApplyUpdate(item.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full bg-emerald-600 text-white"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve &amp; Apply</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectUpdate(item.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border border-blue-200 dark:border-sky-400/30 text-zinc-700 dark:text-slate-200"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                      {isCompleted && item.rollbackSnapshot && (
                        <button
                          type="button"
                          onClick={() => rollbackUpdate(item.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border border-amber-400/50 text-amber-600 dark:text-amber-300"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Rollback</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
