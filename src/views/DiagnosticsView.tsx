import { useEffect, useState } from "react";
import { Activity, CheckCircle2, AlertTriangle, XCircle, Loader2, CheckSquare } from "lucide-react";
import type { JarvisStore } from "../hooks/useJarvisStore";
import type { DiagnosticCheck } from "../types/jarvis";

interface DiagnosticsViewProps {
  store: JarvisStore;
}

export function DiagnosticsView({ store }: DiagnosticsViewProps) {
  const { diagnostics, runDiagnostics, proposeUpdate, setActiveView } = store;
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    await runDiagnostics();
    setRunning(false);
  };

  useEffect(() => {
    if (diagnostics.length === 0) {
      handleRun();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQueueFix = (check: DiagnosticCheck) => {
    if (!check.suggestedFix) return;
    proposeUpdate({
      title: check.suggestedFix.title,
      source: "System Diagnostics",
      area: check.category,
      problemOrReason: check.summary,
      proposedSolution: check.suggestedFix.solution,
      securityImpact: "Restores recommended security & integrity configuration.",
      beforePreview: check.summary,
      afterPreview: check.suggestedFix.solution,
      actionType: check.suggestedFix.actionType,
      actionPayload: check.suggestedFix.actionPayload,
    });
    setActiveView("approvals");
  };

  const passCount = diagnostics.filter((d) => d.status === "pass").length;

  return (
    <div className="space-y-6">
      <section className="jarvis-surface p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-blue-500/25">
          <div>
            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              System Diagnostics
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Validates Express backend connectivity, Coding Studio HTML/CSS/JS syntax, Protected
              Core rules, Web Speech support, and Memory persistence.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
            <span>{running ? "Running Checks..." : "Run Diagnostic Suite"}</span>
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-mono tabular-nums">
            {passCount} / {diagnostics.length} checks passed
          </span>
          <span>Detected fixes require owner approval before applying</span>
        </div>

        <div className="mt-4 divide-y divide-zinc-100 dark:divide-blue-500/15">
          {diagnostics.map((item) => (
            <div
              key={item.id}
              className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {item.status === "pass" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : item.status === "warning" ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  )}
                  <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.name}
                  </h3>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    · {item.category}
                  </span>
                </div>
                <p className="text-xs text-zinc-700 dark:text-zinc-300">{item.summary}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.detail}</p>
              </div>

              {item.suggestedFix && (
                <button
                  type="button"
                  onClick={() => handleQueueFix(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 whitespace-nowrap shrink-0 self-start sm:self-center"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Prepare Fix Proposal</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
