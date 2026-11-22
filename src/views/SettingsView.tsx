import { useState } from "react";
import {
  Activity,
  Archive,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Crown,
  Download,
  FileCode2,
  FolderOpen,
  GitBranch,
  Globe,
  Info,
  Link2,
  Loader2,
  Lock,
  Mic,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Shield,
  Sparkles,
  Sun,
  Type,
} from "lucide-react";
import { CLOUDFLARE_WORKER_REFERENCE } from "../data/initialState";
import type { JarvisStore } from "../hooks/useJarvisStore";
import type { AccentTheme, SettingsTab, ThemeMode, VoiceLanguageLabel } from "../types/jarvis";
import { getProxyBaseUrl, setProxyBaseUrl } from "../utils/apiUrl";
import { buildSingleFileHtml, downloadTextFile } from "../utils/exportHtml";
import { CodingStudioView } from "./CodingStudioView";
import { DiagnosticsView } from "./DiagnosticsView";
import { GitHubView } from "./GitHubView";
import { MemoryView } from "./MemoryView";
import { ModelsView } from "./ModelsView";
import { SelfEvolutionView } from "./SelfEvolutionView";
import { VoiceView } from "./VoiceView";

interface SettingsViewProps {
  store: JarvisStore;
}

const USER_AVATAR_URL = "/src/assets/images/jarvis_user_avatar_1795233558698.jpg";

export function SettingsView({ store }: SettingsViewProps) {
  const {
    state,
    settingsTab,
    setSettingsTab,
    activeProject,
    setTheme,
    setActiveView,
    updateUiPrefs,
    toggleSecurityFlag,
    resetAllData,
    logActivity,
  } = store;

  const [studioSection, setStudioSection] = useState<"coding" | "voice" | "github" | "export">("coding");
  const [systemSection, setSystemSection] = useState<"diagnostics" | "evolution" | "security">("diagnostics");

  const [copiedWorker, setCopiedWorker] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(state.uiPrefs.userName || "Imran");
  const [avatarError, setAvatarError] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const [exportBusy, setExportBusy] = useState<"html" | "zip" | "files" | null>(null);
  const [exportFeedback, setExportFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [sourceFiles, setSourceFiles] = useState<Array<{ path: string; size: number; content: string }>>([]);
  const [selectedSourcePath, setSelectedSourcePath] = useState<string>("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [copiedSourcePath, setCopiedSourcePath] = useState<string | null>(null);
  const [proxyDraft, setProxyDraft] = useState(() => getProxyBaseUrl());
  const [proxySavedNote, setProxySavedNote] = useState<string | null>(null);

  const cycleTheme = () => {
    const order: ThemeMode[] = ["dark", "light", "adaptive"];
    const next = order[(order.indexOf(state.theme) + 1) % order.length];
    setTheme(next);
  };

  const cycleVoiceLang = () => {
    const langs: VoiceLanguageLabel[] = ["Bangla (বাংলা)", "English (US)", "English (UK)"];
    const next = langs[(langs.indexOf(state.uiPrefs.voiceLanguage) + 1) % langs.length];
    updateUiPrefs({ voiceLanguage: next });
    logActivity("Settings", "Voice Language Updated", next);
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameDraft.trim()) {
      updateUiPrefs({ userName: nameDraft.trim() });
    }
    setEditingName(false);
  };

  const handleCopyWorker = async () => {
    await navigator.clipboard.writeText(CLOUDFLARE_WORKER_REFERENCE);
    setCopiedWorker(true);
    setTimeout(() => setCopiedWorker(false), 2000);
  };

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadFullJarvisHtml = async () => {
    setExportBusy("html");
    setExportFeedback(null);
    try {
      const resp = await fetch("/api/export/standalone-html");
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Standalone HTML bundle failed.");
      }
      const blob = await resp.blob();
      triggerBlobDownload(blob, "jarvis-ai-os.html");
      const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);
      setExportFeedback({
        type: "ok",
        text: `jarvis-ai-os.html (${sizeMb} MB) downloaded! Open it directly in Acode or upload as index.html to GitHub Pages.`,
      });
      logActivity(
        "Settings",
        "Exported Full JARVIS OS Single HTML",
        `Self-contained jarvis-ai-os.html (${sizeMb} MB) generated`
      );
    } catch (err) {
      setExportFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to download JARVIS OS HTML.",
      });
    } finally {
      setExportBusy(null);
    }
  };

  const handleDownloadProjectZip = async () => {
    setExportBusy("zip");
    setExportFeedback(null);
    try {
      const resp = await fetch("/api/export/project-zip");
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "ZIP archive creation failed.");
      }
      const blob = await resp.blob();
      triggerBlobDownload(blob, "jarvis-ai-os-project.zip");
      const sizeKb = Math.round(blob.size / 1024);
      setExportFeedback({
        type: "ok",
        text: `jarvis-ai-os-project.zip (${sizeKb} KB) downloaded! Extract with ZArchiver / Files and open folder in Acode or Termux.`,
      });
      logActivity(
        "Settings",
        "Exported Full Project ZIP",
        `jarvis-ai-os-project.zip (${sizeKb} KB) downloaded`
      );
    } catch (err) {
      setExportFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to download project ZIP.",
      });
    } finally {
      setExportBusy(null);
    }
  };

  const handleLoadSourceFiles = async () => {
    setExportBusy("files");
    setExportFeedback(null);
    try {
      const resp = await fetch("/api/export/source-files");
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to load source tree.");
      const files = Array.isArray(data.files) ? data.files : [];
      setSourceFiles(files);
      const preferred =
        files.find((f: { path: string }) => f.path === "src/App.tsx") || files[0];
      if (preferred) setSelectedSourcePath(preferred.path);
      setExportFeedback({
        type: "ok",
        text: `Loaded ${files.length} project files. Select any file below to inspect or copy into Acode.`,
      });
    } catch (err) {
      setExportFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Unable to load source files.",
      });
    } finally {
      setExportBusy(null);
    }
  };

  const handleCopySourceFile = async (file: { path: string; content: string }) => {
    await navigator.clipboard.writeText(file.content);
    setCopiedSourcePath(file.path);
    setTimeout(() => setCopiedSourcePath(null), 2000);
  };

  const handleSaveProxyUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = setProxyBaseUrl(proxyDraft);
    setProxyDraft(saved);
    setProxySavedNote(
      saved
        ? `Proxy saved: ${saved}. Checking connection...`
        : "Cleared custom proxy — using local /api backend."
    );
    await store.checkBackendHealth();
    logActivity(
      "Settings",
      "Updated Backend Proxy URL",
      saved || "Reverted to local Express /api backend"
    );
  };

  const handleExportDeliverableHtml = () => {
    const html = buildSingleFileHtml(activeProject);
    downloadTextFile("coding-studio-project.html", html, "text/html");
    logActivity(
      "Settings",
      "Exported Coding Studio Snippet HTML",
      `Bundled ${activeProject.name} for Acode / GitHub Pages`
    );
  };

  const handleExportFullBackup = () => {
    downloadTextFile(
      "jarvis-os-backup.json",
      JSON.stringify(state, null, 2),
      "application/json"
    );
    logActivity("Settings", "Exported Full System Backup", "jarvis-os-backup.json downloaded");
  };

  const themeLabel =
    state.theme === "dark" ? "Dark Mode" : state.theme === "light" ? "Light Mode" : "Adaptive";

  const mainTabs: { id: SettingsTab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "models", label: "AI Models" },
    { id: "memory", label: "Memory" },
    { id: "studio", label: "Studio & Tools" },
    { id: "system", label: "System & Security" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Top Profile & Unified Settings Tabs */}
      <section className="jarvis-surface p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-cyan-400 via-blue-500 to-violet-600 shrink-0">
              <div className="w-full h-full rounded-full overflow-hidden bg-[#08102A] flex items-center justify-center">
                {!avatarError ? (
                  <img
                    src={USER_AVATAR_URL}
                    alt={state.uiPrefs.userName}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-display text-lg font-bold text-white">
                    {(state.uiPrefs.userName || "I")[0]}
                  </span>
                )}
              </div>
            </div>

            <div>
              {editingName ? (
                <form onSubmit={handleSaveName} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="px-2.5 py-1 text-sm rounded-lg bg-blue-50 dark:bg-[#08102A] border border-blue-400/50 text-zinc-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-600 text-white"
                  >
                    Save
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="font-display text-lg font-bold text-zinc-900 dark:text-white hover:underline text-left"
                >
                  {state.uiPrefs.userName || "Imran"}
                </button>
              )}
              <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-slate-300 mt-0.5">
                <span>JARVIS User</span>
                <Crown className="w-3.5 h-3.5 text-amber-400" />
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveView("welcome")}
            className="text-xs font-medium text-blue-600 dark:text-cyan-300 hover:underline self-start sm:self-center"
          >
            Preview Welcome Portal
          </button>
        </div>

        {/* All Extra Settings & Tools Organized Inside Settings Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {mainTabs.map((t) => {
            const active = settingsTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSettingsTab(t.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  active
                    ? "jarvis-gradient-btn text-white"
                    : "bg-blue-50/70 dark:bg-[#08122E] border border-blue-200 dark:border-sky-400/25 text-zinc-700 dark:text-slate-200 hover:border-blue-400"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* TAB 1: General Preferences */}
      {settingsTab === "general" && (
        <section className="jarvis-surface p-5 sm:p-6 space-y-3">
          <button
            type="button"
            onClick={cycleTheme}
            className="w-full p-3.5 rounded-xl bg-blue-50/50 dark:bg-[#08122E] border border-blue-200/70 dark:border-sky-400/25 flex items-center justify-between hover:border-blue-400/60"
          >
            <span className="flex items-center gap-3 text-sm font-medium text-zinc-900 dark:text-white">
              {state.theme === "light" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : state.theme === "adaptive" ? (
                <Monitor className="w-4 h-4 text-cyan-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-400" />
              )}
              <span>Theme</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-slate-300">
              <span>{themeLabel}</span>
              <ChevronRight className="w-4 h-4" />
            </span>
          </button>

          <button
            type="button"
            onClick={cycleVoiceLang}
            className="w-full p-3.5 rounded-xl bg-blue-50/50 dark:bg-[#08122E] border border-blue-200/70 dark:border-sky-400/25 flex items-center justify-between hover:border-blue-400/60"
          >
            <span className="flex items-center gap-3 text-sm font-medium text-zinc-900 dark:text-white">
              <Globe className="w-4 h-4 text-sky-400" />
              <span>Voice Language</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-slate-300">
              <span>{state.uiPrefs.voiceLanguage}</span>
              <ChevronRight className="w-4 h-4" />
            </span>
          </button>

          <div className="w-full p-3.5 rounded-xl bg-blue-50/50 dark:bg-[#08122E] border border-blue-200/70 dark:border-sky-400/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="flex items-center gap-3 text-sm font-medium text-zinc-900 dark:text-white">
              <Palette className="w-4 h-4 text-violet-400" />
              <span>Accent Palette</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "cosmic-violet", label: "Violet", swatch: "bg-violet-500" },
                  { id: "cyber-cyan", label: "Cyan", swatch: "bg-cyan-500" },
                  { id: "emerald-matrix", label: "Emerald", swatch: "bg-emerald-500" },
                  { id: "rose-aurora", label: "Rose", swatch: "bg-rose-500" },
                  { id: "solar-gold", label: "Gold", swatch: "bg-amber-500" },
                ] as { id: AccentTheme; label: string; swatch: string }[]
              ).map((acc) => {
                const active = (state.uiPrefs.accentTheme || "cosmic-violet") === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => updateUiPrefs({ accentTheme: acc.id })}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? "border-violet-400 bg-violet-500/20 text-zinc-900 dark:text-white"
                        : "border-zinc-200 dark:border-sky-400/20 text-zinc-600 dark:text-slate-300"
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${acc.swatch}`} />
                    <span>{acc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {[
            {
              key: "autoHealOnConnect" as const,
              label: "Auto-Scan & Self-Heal on API Connect",
              icon: Activity,
              value: state.uiPrefs.autoHealOnConnect,
            },
            {
              key: "backgroundAnimation" as const,
              label: "Background Animation & Neon Pulse",
              icon: Sparkles,
              value: state.uiPrefs.backgroundAnimation,
            },
            {
              key: "typingEffect" as const,
              label: "Typing Effect",
              icon: Type,
              value: state.uiPrefs.typingEffect,
            },
            {
              key: "moodColors" as const,
              label: "Mood Colors",
              icon: Palette,
              value: state.uiPrefs.moodColors,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="w-full p-3.5 rounded-xl bg-blue-50/50 dark:bg-[#08122E] border border-blue-200/70 dark:border-sky-400/25 flex items-center justify-between"
              >
                <span className="flex items-center gap-3 text-sm font-medium text-zinc-900 dark:text-white">
                  <Icon className="w-4 h-4 text-blue-500 dark:text-cyan-300" />
                  <span>{item.label}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.value}
                  aria-label={item.label}
                  onClick={() => updateUiPrefs({ [item.key]: !item.value })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    item.value ? "bg-sky-500" : "bg-zinc-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      item.value ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            );
          })}

          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setSystemSection("security");
                setSettingsTab("system");
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50/70 dark:bg-[#08122E] border border-blue-200 dark:border-sky-400/25 text-xs font-medium text-zinc-700 dark:text-slate-200 hover:border-blue-400"
            >
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Privacy &amp; Security</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSystemSection("diagnostics");
                setSettingsTab("system");
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50/70 dark:bg-[#08122E] border border-blue-200 dark:border-sky-400/25 text-xs font-medium text-zinc-700 dark:text-slate-200 hover:border-blue-400"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Diagnostics</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAbout((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50/70 dark:bg-[#08122E] border border-blue-200 dark:border-sky-400/25 text-xs font-medium text-zinc-700 dark:text-slate-200 hover:border-blue-400"
            >
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              <span>About JARVIS</span>
            </button>
          </div>

          {showAbout && (
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-[#07112E] border border-blue-200 dark:border-sky-400/30 text-xs text-zinc-700 dark:text-slate-300 space-y-1">
              <p className="font-semibold text-zinc-900 dark:text-white">
                JARVIS Personal AI OS · Master Blueprint V1.0
              </p>
              <p>
                All advanced modules (AI Models, Memory Center, Coding Studio, Voice Studio,
                GitHub, Diagnostics, Self-Evolution, and Portable Exports) are neatly integrated right
                here inside Settings.
              </p>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: AI Models & Routing */}
      {settingsTab === "models" && <ModelsView store={store} />}

      {/* TAB 3: Memory Center */}
      {settingsTab === "memory" && <MemoryView store={store} />}

      {/* TAB 4: Studio & Tools (Coding, Voice, GitHub, Export) */}
      {settingsTab === "studio" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "coding" as const, label: "Coding Studio", icon: Code2 },
              { id: "voice" as const, label: "Voice Studio", icon: Mic },
              { id: "github" as const, label: "GitHub Manager", icon: GitBranch },
              { id: "export" as const, label: "Acode / HTML Export", icon: Download },
            ].map((item) => {
              const Icon = item.icon;
              const active = studioSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStudioSection(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? "bg-blue-600 text-white"
                      : "jarvis-surface text-zinc-700 dark:text-slate-200"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {studioSection === "coding" && <CodingStudioView store={store} />}
          {studioSection === "voice" && <VoiceView store={store} />}
          {studioSection === "github" && <GitHubView store={store} />}
          {studioSection === "export" && (
            <div className="space-y-4">
              {/* 1. Complete JARVIS AI OS Exports */}
              <section className="jarvis-surface p-5 sm:p-6 space-y-4">
                <div>
                  <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-white">
                    Download Complete JARVIS AI OS (Acode / Android / GitHub Pages)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Download the entire JARVIS Personal AI OS—either as one standalone self-contained
                    HTML file (all UI, CSS, JS, and images embedded) or as a complete source code
                    .zip folder ready for Acode, Termux, or GitHub.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={exportBusy !== null}
                    onClick={handleDownloadFullJarvisHtml}
                    className="jarvis-gradient-btn flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold rounded-xl text-white disabled:opacity-60"
                  >
                    {exportBusy === "html" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>Download Complete JARVIS OS (.html)</span>
                  </button>

                  <button
                    type="button"
                    disabled={exportBusy !== null}
                    onClick={handleDownloadProjectZip}
                    className="flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold rounded-xl bg-blue-50/70 dark:bg-[#08122E] border border-blue-200 dark:border-sky-400/35 text-zinc-900 dark:text-white hover:border-blue-400 disabled:opacity-60"
                  >
                    {exportBusy === "zip" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Archive className="w-4 h-4 text-cyan-400" />
                    )}
                    <span>Download Full Source Code (.zip)</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={exportBusy !== null}
                    onClick={handleLoadSourceFiles}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full bg-blue-50/70 dark:bg-[#08122E] border border-blue-200 dark:border-sky-400/30 text-zinc-700 dark:text-slate-200 hover:border-blue-400"
                  >
                    {exportBusy === "files" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FolderOpen className="w-3.5 h-3.5 text-violet-400" />
                    )}
                    <span>Browse &amp; Copy Source Files (For Acode)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportFullBackup}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full border border-blue-200 dark:border-sky-400/25 text-zinc-700 dark:text-slate-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export OS Memory Backup (.json)</span>
                  </button>
                </div>

                {exportFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs border ${
                      exportFeedback.type === "ok"
                        ? "bg-emerald-500/10 border-emerald-400/35 text-emerald-700 dark:text-emerald-300"
                        : "bg-red-500/10 border-red-400/35 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {exportFeedback.text}
                  </div>
                )}
              </section>

              {/* 2. Interactive Source File Browser & 1-Tap Copy for Acode */}
              {sourceFiles.length > 0 && (() => {
                const filteredFiles = sourceFiles.filter((f) =>
                  !sourceSearch.trim()
                    ? true
                    : f.path.toLowerCase().includes(sourceSearch.trim().toLowerCase())
                );
                const activeFile =
                  sourceFiles.find((f) => f.path === selectedSourcePath) || filteredFiles[0];
                return (
                  <section className="jarvis-surface p-5 sm:p-6 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-display text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                          <FileCode2 className="w-4 h-4 text-violet-400" />
                          <span>Project Source Browser ({sourceFiles.length} files)</span>
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-slate-400">
                          Pick any folder/file path and copy or save it directly into your Acode project folder.
                        </p>
                      </div>
                      <input
                        type="text"
                        value={sourceSearch}
                        onChange={(e) => setSourceSearch(e.target.value)}
                        placeholder="Filter path (e.g. App.tsx, server)"
                        className="px-3 py-1.5 text-xs rounded-lg bg-blue-50/70 dark:bg-[#08122E] border border-blue-200 dark:border-sky-400/25 text-zinc-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-1 max-h-72 overflow-y-auto rounded-xl border border-blue-200 dark:border-sky-400/25 bg-blue-50/40 dark:bg-[#071026] divide-y divide-blue-100 dark:divide-sky-400/10">
                        {filteredFiles.map((file) => {
                          const isSel = activeFile?.path === file.path;
                          return (
                            <button
                              key={file.path}
                              type="button"
                              onClick={() => setSelectedSourcePath(file.path)}
                              className={`w-full px-3 py-2 text-left text-xs font-mono flex items-center justify-between gap-2 transition-colors ${
                                isSel
                                  ? "bg-violet-600/20 text-violet-700 dark:text-cyan-300 font-semibold"
                                  : "text-zinc-700 dark:text-slate-300 hover:bg-blue-100/50 dark:hover:bg-white/5"
                              }`}
                            >
                              <span className="truncate">{file.path}</span>
                              <span className="text-[10px] text-zinc-400 shrink-0">
                                {(file.size / 1024).toFixed(1)}K
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {activeFile && (
                        <div className="md:col-span-2 rounded-xl border border-blue-200 dark:border-sky-400/25 overflow-hidden flex flex-col">
                          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-blue-50/70 dark:bg-[#08102A] border-b border-blue-200 dark:border-sky-400/20">
                            <span className="text-xs font-mono text-zinc-800 dark:text-slate-200 truncate">
                              {activeFile.path}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleCopySourceFile(activeFile)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-violet-600 text-white text-[11px] font-medium"
                              >
                                {copiedSourcePath === activeFile.path ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                <span>{copiedSourcePath === activeFile.path ? "Copied!" : "Copy Code"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  downloadTextFile(
                                    activeFile.path.split("/").pop() || "file.txt",
                                    activeFile.content,
                                    "text/plain"
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-blue-200 dark:border-sky-400/30 text-[11px] font-medium text-zinc-700 dark:text-slate-200"
                              >
                                <Download className="w-3 h-3" />
                                <span>Save File</span>
                              </button>
                            </div>
                          </div>
                          <pre className="p-3.5 text-[11px] font-mono text-zinc-800 dark:text-slate-200 bg-white dark:bg-[#060C20] overflow-auto max-h-64 leading-relaxed">
                            {activeFile.content}
                          </pre>
                        </div>
                      )}
                    </div>
                  </section>
                );
              })()}

              {/* 3. Cloudflare Worker Proxy Setup (For Standalone HTML / GitHub Pages API Connection) */}
              <section className="jarvis-surface p-5 sm:p-6 space-y-4">
                <div>
                  <h4 className="font-display text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-cyan-400" />
                    <span>Static Hosting / GitHub Pages Backend Proxy URL</span>
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Leave blank when running inside AI Studio, Termux, or Node.js. If you host the
                    standalone HTML on GitHub Pages or open it offline in Acode, deploy the free
                    Cloudflare Worker below (with your GEMINI_API_KEY stored inside Cloudflare Secrets)
                    and paste your Worker URL here.
                  </p>
                </div>

                <form onSubmit={handleSaveProxyUrl} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={proxyDraft}
                    onChange={(e) => setProxyDraft(e.target.value)}
                    placeholder="https://jarvis-proxy.yourname.workers.dev"
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-blue-50/70 dark:bg-[#08122E] border border-blue-200 dark:border-sky-400/25 text-zinc-900 dark:text-white font-mono"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
                  >
                    Save Proxy URL
                  </button>
                </form>

                {proxySavedNote && (
                  <p className="text-xs text-cyan-700 dark:text-cyan-300">{proxySavedNote}</p>
                )}

                <div className="rounded-xl border border-blue-200 dark:border-sky-400/25 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/70 dark:bg-[#08102A] border-b border-blue-200 dark:border-sky-400/20">
                    <span className="text-xs font-mono text-zinc-600 dark:text-slate-300">
                      cloudflare-worker-gemini-proxy.js
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyWorker}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-cyan-300 hover:underline"
                    >
                      {copiedWorker ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedWorker ? "Copied" : "Copy Worker Code"}</span>
                    </button>
                  </div>
                  <pre className="p-4 text-xs font-mono text-zinc-800 dark:text-slate-200 bg-white dark:bg-[#060C20] overflow-x-auto max-h-60">
                    {CLOUDFLARE_WORKER_REFERENCE}
                  </pre>
                </div>
              </section>

              {/* 4. Active Coding Studio Project Export */}
              <section className="jarvis-surface p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-display text-sm font-semibold text-zinc-900 dark:text-white">
                    Coding Studio Snippet Export ({activeProject.name})
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5">
                    Exports only the HTML/CSS/JS snippet currently open in your Coding Studio tab.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportDeliverableHtml}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full border border-blue-200 dark:border-sky-400/30 text-zinc-700 dark:text-slate-200 whitespace-nowrap self-start sm:self-center"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Coding Studio HTML</span>
                </button>
              </section>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: System & Security (Diagnostics, Self-Evolution, Locks, Reset) */}
      {settingsTab === "system" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "diagnostics" as const, label: "System Diagnostics", icon: Activity },
              { id: "evolution" as const, label: "Self-Evolution", icon: Sparkles },
              { id: "security" as const, label: "Security & Reset", icon: Lock },
            ].map((item) => {
              const Icon = item.icon;
              const active = systemSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSystemSection(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? "bg-blue-600 text-white"
                      : "jarvis-surface text-zinc-700 dark:text-slate-200"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {systemSection === "diagnostics" && <DiagnosticsView store={store} />}
          {systemSection === "evolution" && <SelfEvolutionView store={store} />}
          {systemSection === "security" && (
            <section className="jarvis-surface p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600 dark:text-cyan-300" />
                <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-white">
                  Security &amp; Protected Core Controls
                </h3>
              </div>

              <div className="divide-y divide-blue-100 dark:divide-sky-400/15">
                <div className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                      Protected Core Files Lock
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-slate-400">
                      Prevents AI Brain or Skills from altering core rules without explicit approval.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSecurityFlag("protectedCoreLocked")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap ${
                      state.protectedCoreLocked
                        ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-700 dark:text-emerald-300"
                        : "border-amber-400 text-amber-600 dark:text-amber-300"
                    }`}
                  >
                    {state.protectedCoreLocked ? "Locked" : "Unlocked"}
                  </button>
                </div>

                <div className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                      Strict Sandboxed Skill Execution
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-slate-400">
                      Enforces permission boundaries on all Skill Store tests and iframe previews.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSecurityFlag("sandboxStrictMode")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap ${
                      state.sandboxStrictMode
                        ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-700 dark:text-emerald-300"
                        : "border-amber-400 text-amber-600 dark:text-amber-300"
                    }`}
                  >
                    {state.sandboxStrictMode ? "Strict Mode On" : "Relaxed"}
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-blue-200 dark:border-sky-400/15 flex items-center justify-between gap-4">
                <span className="text-xs text-zinc-500 dark:text-slate-400">
                  Reset local JARVIS workspace data back to defaults.
                </span>
                {confirmReset ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetAllData();
                        setConfirmReset(false);
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-full bg-red-600 text-white hover:bg-red-700 whitespace-nowrap"
                    >
                      Confirm Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="px-3 py-1.5 text-xs font-medium rounded-full border border-blue-200 dark:border-sky-400/30 text-zinc-600 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Workspace</span>
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
