import { useState } from "react";
import {
  BarChart3,
  Bot,
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  FileText,
  FolderOpen,
  GitBranch,
  Globe,
  Image as ImageIcon,
  Languages,
  Loader2,
  Mic,
  PenTool,
  Play,
  Plus,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";
import type { JarvisStore } from "../hooks/useJarvisStore";
import type { SkillEntry } from "../types/jarvis";
import { resolveApiUrl } from "../utils/apiUrl";

interface SkillsViewProps {
  store: JarvisStore;
}

const SKILL_ICON_META: Record<
  string,
  { icon: typeof Code2; tileClass: string }
> = {
  coding: { icon: Code2, tileClass: "text-cyan-300 bg-cyan-500/20 border-cyan-400/40" },
  "web-dev": { icon: Globe, tileClass: "text-sky-300 bg-sky-500/20 border-sky-400/40" },
  research: { icon: Search, tileClass: "text-indigo-300 bg-indigo-500/20 border-indigo-400/40" },
  writing: { icon: PenTool, tileClass: "text-amber-300 bg-amber-500/20 border-amber-400/40" },
  github: { icon: GitBranch, tileClass: "text-emerald-300 bg-emerald-500/20 border-emerald-400/40" },
  browser: { icon: Globe, tileClass: "text-blue-300 bg-blue-500/20 border-blue-400/40" },
  "file-management": { icon: FolderOpen, tileClass: "text-violet-300 bg-violet-500/20 border-violet-400/40" },
  automation: { icon: Sparkles, tileClass: "text-fuchsia-300 bg-fuchsia-500/20 border-fuchsia-400/40" },
  "image-gen": { icon: ImageIcon, tileClass: "text-pink-300 bg-pink-500/20 border-pink-400/40" },
  "voice-assistant": { icon: Mic, tileClass: "text-teal-300 bg-teal-500/20 border-teal-400/40" },
  memory: { icon: Database, tileClass: "text-sky-300 bg-sky-500/20 border-sky-400/40" },
  "data-analysis": { icon: BarChart3, tileClass: "text-amber-300 bg-amber-500/20 border-amber-400/40" },
  translation: { icon: Languages, tileClass: "text-emerald-300 bg-emerald-500/20 border-emerald-400/40" },
  "document-creation": { icon: FileText, tileClass: "text-indigo-300 bg-indigo-500/20 border-indigo-400/40" },
};

export function SkillsView({ store }: SkillsViewProps) {
  const { state, activeSkillsCount, proposeUpdate, setActiveView } = store;
  const [filter, setFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [testingSkill, setTestingSkill] = useState<SkillEntry | null>(null);
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customSource, setCustomSource] = useState<"GitHub" | "Custom">("GitHub");

  const filterTabs = ["All", "Engineering", "Intelligence", "Productivity", "Installed", "Available"];

  const filtered = state.skills.filter((s) => {
    if (filter === "Installed" && !s.installed) return false;
    else if (filter === "Available" && s.installed) return false;
    else if (
      filter !== "All" &&
      filter !== "Installed" &&
      filter !== "Available" &&
      s.category !== filter
    ) {
      return false;
    }

    if (
      search.trim() &&
      !s.name.toLowerCase().includes(search.toLowerCase()) &&
      !s.description.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const queueSkillChange = (
    skill: SkillEntry,
    action: "install_skill" | "enable_skill" | "disable_skill" | "uninstall_skill"
  ) => {
    const labelMap = {
      install_skill: `Install ${skill.name}`,
      enable_skill: `Enable ${skill.name}`,
      disable_skill: `Disable ${skill.name}`,
      uninstall_skill: `Uninstall ${skill.name}`,
    };
    proposeUpdate({
      title: `${labelMap[action]} (v${skill.version})`,
      source: "Skill Store",
      area: "Skill Permissions",
      problemOrReason: `Owner requested to ${action.replace("_skill", "")} ${skill.name} from ${skill.source}.`,
      proposedSolution: `Update skill state in sandboxed mode with permissions: ${skill.permissions.join(", ")}`,
      securityImpact: `Permissions scoped to: ${skill.permissions.join(", ")}. Sandboxed execution enforced.`,
      beforePreview: `${skill.name}: Installed=${skill.installed} · Enabled=${skill.enabled}`,
      afterPreview:
        action === "install_skill" || action === "enable_skill"
          ? `${skill.name}: Installed=true · Enabled=true`
          : action === "disable_skill"
          ? `${skill.name}: Installed=true · Enabled=false`
          : `${skill.name}: Installed=false · Enabled=false`,
      actionType: action,
      actionPayload: { skillId: skill.id },
    });
    setActiveView("approvals");
  };

  const handleImportCustomSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const newSkill: SkillEntry = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      category: "Custom Plugin",
      description: customDesc.trim() || "Imported external JARVIS skill manifest.",
      source: customSource,
      version: "1.0.0",
      installed: true,
      enabled: true,
      permissions: ["read:memory"],
      sandboxed: true,
    };
    proposeUpdate({
      title: `Import & Install Skill: ${newSkill.name}`,
      source: "Skill Store",
      area: "Skill Import",
      problemOrReason: `New skill imported via ${customSource} manifest.`,
      proposedSolution: "Register sandboxed skill into JARVIS Skill Manager upon owner approval.",
      securityImpact: "Sandboxed execution with read:memory permission only.",
      beforePreview: "Skill not registered",
      afterPreview: `${newSkill.name} (${newSkill.source}) · Sandboxed`,
      actionType: "install_skill",
      actionPayload: { skillId: newSkill.id, customSkill: newSkill },
    });
    setCustomName("");
    setCustomDesc("");
    setShowCustomForm(false);
    setActiveView("approvals");
  };

  const handleRunSkillTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testingSkill || !testInput.trim()) return;
    setTestLoading(true);
    setTestOutput(null);
    try {
      const resp = await fetch(resolveApiUrl("/api/gemini/skill-test"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillName: testingSkill.name,
          skillDescription: testingSkill.description,
          permissions: testingSkill.permissions,
          testInput: testInput.trim(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Skill test failed");
      setTestOutput(data.output);
    } catch (err) {
      setTestOutput(`Error: ${err instanceof Error ? err.message : "Test failed"}`);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="jarvis-surface p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-blue-500/20">
          <div>
            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-white">
              Skills &amp; Tools
            </h2>
            <p className="text-xs text-zinc-500 dark:text-slate-400 mt-1">
              Sandboxed modular plugins. All installs, updates, and removals require approval in Update Center.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCustomForm((v) => !v)}
            className="jarvis-gradient-btn inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full text-white whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Import Skill</span>
          </button>
        </div>

        {showCustomForm && (
          <form
            onSubmit={handleImportCustomSkill}
            className="p-4 rounded-xl bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Skill Name (e.g. Markdown Formatter)"
                required
                className="px-3 py-2 text-sm rounded-lg bg-white dark:bg-[#0B132B] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-white"
              />
              <select
                value={customSource}
                onChange={(e) => setCustomSource(e.target.value as "GitHub" | "Custom")}
                className="px-3 py-2 text-sm rounded-lg bg-white dark:bg-[#0B132B] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-white"
              >
                <option value="GitHub">GitHub Skill Import</option>
                <option value="Custom">Manual / ZIP Manifest</option>
              </select>
              <button
                type="submit"
                className="jarvis-gradient-btn px-4 py-2 text-xs font-medium rounded-lg text-white whitespace-nowrap"
              >
                Propose Skill Install
              </button>
            </div>
            <input
              type="text"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              placeholder="Skill description & intended capabilities"
              className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-[#0B132B] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-white"
            />
          </form>
        )}

        {/* Filter Pills + Search matching Screen 5 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {filterTabs.map((tab) => {
              const active = filter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                    active
                      ? "jarvis-gradient-btn text-white"
                      : "bg-zinc-100 dark:bg-[#0B1430] border border-zinc-200 dark:border-blue-500/25 text-zinc-600 dark:text-slate-300 hover:border-blue-400"
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="md:w-56 px-3.5 py-2 text-xs rounded-full bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-white"
          />
        </div>

        {/* 3-Column Mockup Skill Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((skill) => {
            const meta = SKILL_ICON_META[skill.id] || {
              icon: Bot,
              tileClass: "text-blue-300 bg-blue-500/20 border-blue-400/40",
            };
            const Icon = meta.icon;
            return (
              <div
                key={skill.id}
                className="p-4 rounded-2xl bg-zinc-50/80 dark:bg-[#08102A]/90 border border-zinc-200 dark:border-blue-500/25 hover:border-blue-400/60 flex flex-col justify-between gap-4 transition-colors"
              >
                <div className="text-center space-y-2.5 pt-1">
                  <div
                    className={`w-12 h-12 mx-auto rounded-2xl border flex items-center justify-center shadow-[0_0_18px_rgba(56,189,248,0.16)] ${meta.tileClass}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-white">
                      {skill.name.replace(" Skill", "")}
                    </h3>
                    <p className="text-[11px] text-blue-600 dark:text-cyan-300/85">
                      [{skill.category}]
                    </p>
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-600 dark:text-slate-300 line-clamp-2">
                    {skill.description}
                  </p>
                </div>

                <div className="space-y-2.5 pt-3 border-t border-zinc-200/80 dark:border-blue-500/15">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1 font-mono text-zinc-500 dark:text-slate-400">
                      <Shield className="w-3 h-3" />
                      v{skill.version}
                    </span>
                    <span
                      className={`font-medium ${
                        skill.installed && skill.enabled
                          ? "text-emerald-600 dark:text-emerald-400"
                          : skill.installed
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-zinc-500 dark:text-slate-400"
                      }`}
                    >
                      {skill.installed ? (skill.enabled ? "Active" : "Paused") : "Available"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTestingSkill(skill);
                        setTestOutput(null);
                        setTestInput(`Demonstrate ${skill.name} on a sample task.`);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-cyan-300 hover:underline whitespace-nowrap"
                    >
                      <Play className="w-3 h-3" />
                      <span>Test</span>
                    </button>

                    {!skill.installed ? (
                      <button
                        type="button"
                        onClick={() => queueSkillChange(skill, "install_skill")}
                        className="px-3 py-1 text-xs font-medium rounded-full bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
                      >
                        Install
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            queueSkillChange(skill, skill.enabled ? "disable_skill" : "enable_skill")
                          }
                          className="px-2.5 py-1 text-[11px] font-medium rounded-full border border-zinc-200 dark:border-blue-400/30 text-zinc-700 dark:text-slate-200 hover:border-blue-400 whitespace-nowrap"
                        >
                          {skill.enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => queueSkillChange(skill, "uninstall_skill")}
                          className="px-2.5 py-1 text-[11px] font-medium rounded-full border border-red-200 dark:border-red-500/40 text-red-600 dark:text-red-300 whitespace-nowrap"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Screen 5 Bottom Skill Status Banner */}
        <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-[#091536] border border-blue-200 dark:border-cyan-400/35 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-500 dark:text-cyan-300 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-slate-300">Skill Status</p>
              <p className="font-display text-sm font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5">
                <span>All Systems Ready ({activeSkillsCount} Active)</span>
                <CheckCircle2 className="w-4 h-4" />
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sandboxed Skill Test Runner */}
      {testingSkill && (
        <section className="jarvis-surface p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-white">
                Sandboxed Skill Test · {testingSkill.name}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-slate-400">
                Runs safely in isolation via backend Gemini API without modifying workspace files.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTestingSkill(null)}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-slate-300 dark:hover:text-white"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleRunSkillTest} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-xl bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={testLoading}
              className="jarvis-gradient-btn inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl text-white disabled:opacity-50 whitespace-nowrap"
            >
              {testLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Execute Test</span>
            </button>
          </form>

          {testOutput && (
            <pre className="p-4 rounded-xl bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/20 text-xs font-mono text-zinc-800 dark:text-slate-200 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {testOutput}
            </pre>
          )}
        </section>
      )}
    </div>
  );
}
