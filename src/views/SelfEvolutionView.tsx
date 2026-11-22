import { useState } from "react";
import { Sparkles, Loader2, CheckSquare } from "lucide-react";
import type { JarvisStore } from "../hooks/useJarvisStore";
import type { ApprovalActionType } from "../types/jarvis";
import { resolveApiUrl } from "../utils/apiUrl";

interface SelfEvolutionViewProps {
  store: JarvisStore;
}

interface RawProposal {
  title: string;
  area: string;
  problem: string;
  solution: string;
  securityImpact: string;
  beforeState: string;
  afterState: string;
  targetAction: string;
  targetValue: string;
}

export function SelfEvolutionView({ store }: SelfEvolutionViewProps) {
  const { state, diagnostics, proposeUpdate, setActiveView, logActivity } = store;
  const [goal, setGoal] = useState(
    "Analyze JARVIS skills, routing, theme, and memory setup to propose practical improvements."
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const [proposals, setProposals] = useState<RawProposal[]>([]);
  const [queuedTitles, setQueuedTitles] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalyzing(true);
    setError(null);
    setQueuedTitles({});
    try {
      const snapshot = {
        theme: state.theme,
        activeSkills: state.skills.filter((s) => s.enabled).map((s) => s.id),
        availableSkills: state.skills.filter((s) => !s.installed).map((s) => s.id),
        models: state.models.map((m) => ({ id: m.id, status: m.status, isDefault: m.isDefault })),
        memoryCount: state.memories.length,
        diagnosticsSummary: diagnostics.map((d) => ({ name: d.name, status: d.status })),
        protectedCoreLocked: state.protectedCoreLocked,
      };

      const resp = await fetch(resolveApiUrl("/api/gemini/evolve"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, systemSnapshot: snapshot }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Self-evolution analysis failed");

      setAnalysisSummary(data.analysisSummary || "");
      setProposals(Array.isArray(data.proposals) ? data.proposals : []);
      logActivity(
        "Self-Evolution",
        "System Improvement Analysis Completed",
        `${(data.proposals || []).length} proposals drafted (not applied)`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run self-evolution");
    } finally {
      setAnalyzing(false);
    }
  };

  const queueToApprovalCenter = (p: RawProposal) => {
    let actionType: ApprovalActionType = "add_memory_rule";
    let actionPayload: Record<string, unknown> = { content: p.solution };

    if (p.targetAction === "toggle_theme") {
      actionType = "toggle_theme";
      const val = p.targetValue.toLowerCase();
      actionPayload = {
        theme: val.includes("dark") ? "dark" : val.includes("adaptive") ? "adaptive" : "light",
      };
    } else if (p.targetAction === "enable_skill") {
      const found = state.skills.find(
        (s) => s.id === p.targetValue || s.name.toLowerCase().includes(p.targetValue.toLowerCase())
      );
      if (found) {
        actionType = "install_skill";
        actionPayload = { skillId: found.id };
      }
    } else if (p.targetAction === "config_hardening") {
      actionType = "config_hardening";
      actionPayload = {};
    }

    proposeUpdate({
      title: p.title,
      source: "Self-Evolution",
      area: p.area,
      problemOrReason: p.problem,
      proposedSolution: p.solution,
      securityImpact: p.securityImpact,
      beforePreview: p.beforeState,
      afterPreview: p.afterState,
      actionType,
      actionPayload,
    });
    setQueuedTitles((prev) => ({ ...prev, [p.title]: true }));
  };

  return (
    <div className="space-y-6">
      <section className="jarvis-surface p-6 space-y-4">
        <div className="pb-4 border-b border-zinc-200 dark:border-blue-500/25">
          <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Self-Evolution Engine
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            JARVIS analyzes its current configuration and drafts improvement plans. Proposals are
            never applied automatically — you review and approve every change in the Approval
            Center.
          </p>
        </div>

        <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="flex-1 min-w-0 px-3.5 py-2.5 text-sm rounded-lg bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={analyzing}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {analyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{analyzing ? "Analyzing System..." : "Analyze & Propose Improvements"}</span>
          </button>
        </form>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {analysisSummary && (
          <p className="text-sm text-zinc-700 dark:text-zinc-300 pt-2">{analysisSummary}</p>
        )}
      </section>

      {proposals.length > 0 && (
        <section className="space-y-4">
          {proposals.map((p) => {
            const isQueued = Boolean(queuedTitles[p.title]);
            return (
              <div
                key={p.title}
                className="jarvis-surface p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      {p.area}
                    </span>
                    <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                      {p.title}
                    </h3>
                  </div>

                  {isQueued ? (
                    <button
                      type="button"
                      onClick={() => setActiveView("approvals")}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0"
                    >
                      Queued · Open Approval Center
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => queueToApprovalCenter(p)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 whitespace-nowrap shrink-0"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Send to Approval Center</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="font-medium text-zinc-500 dark:text-zinc-400">Identified Issue</p>
                    <p className="mt-1 text-zinc-700 dark:text-zinc-300">{p.problem}</p>
                  </div>
                  <div>
                    <p className="font-medium text-zinc-500 dark:text-zinc-400">
                      Proposed Solution
                    </p>
                    <p className="mt-1 text-zinc-700 dark:text-zinc-300">{p.solution}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25">
                    <span className="block text-zinc-400 mb-1">Before</span>
                    <span className="text-zinc-700 dark:text-zinc-300">{p.beforeState}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25">
                    <span className="block text-zinc-400 mb-1">After (If Approved)</span>
                    <span className="text-zinc-700 dark:text-zinc-300">{p.afterState}</span>
                  </div>
                </div>

                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Security Impact: {p.securityImpact}
                </p>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
