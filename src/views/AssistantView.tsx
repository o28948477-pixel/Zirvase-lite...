import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Lightbulb,
  Loader2,
  Mic,
  Paperclip,
  RotateCw,
  Search,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { JarvisCompanionStage } from "../components/JarvisCompanionStage";
import type { JarvisStore } from "../hooks/useJarvisStore";
import type { ChatMessage, GroundingSource } from "../types/jarvis";
import { resolveApiUrl } from "../utils/apiUrl";

interface AssistantViewProps {
  store: JarvisStore;
}

interface AttachedFile {
  name: string;
  mimeType: string;
  textContent?: string;
  base64Data?: string;
}

const USER_AVATAR_URL = "/src/assets/images/jarvis_user_avatar_1795233558698.jpg";
const ROBOT_AVATAR_URL = "/src/assets/images/jarvis_robot_avatar_1795331887461.jpg";

export function AssistantView({ store }: AssistantViewProps) {
  const {
    state,
    backendStatus,
    chatWebSearchPreset,
    setChatWebSearchPreset,
    appendChatMessages,
    updateChatMessage,
    clearChat,
    setMessageFeedback,
    updateUiPrefs,
    setActiveView,
    openSettings,
    applyChatAction,
    logActivity,
  } = store;

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reasoningMode, setReasoningMode] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const [attachment, setAttachment] = useState<AttachedFile | null>(null);
  const [listeningQuick, setListeningQuick] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageFilter, setMessageFilter] = useState("");
  const [userAvatarError, setUserAvatarError] = useState(false);
  const [robotAvatarError, setRobotAvatarError] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const autoTriggeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (chatWebSearchPreset) {
      setDeepResearch(true);
      setChatWebSearchPreset(false);
    }
  }, [chatWebSearchPreset, setChatWebSearchPreset]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages.length, loading]);

  const detectMoodFromText = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes("happy") || lower.includes("great") || lower.includes("motivate") || lower.includes("joke")) {
      updateUiPrefs({ detectedMood: "Happy" });
    } else if (lower.includes("code") || lower.includes("build") || lower.includes("debug")) {
      updateUiPrefs({ detectedMood: "Focused" });
    } else if (lower.includes("research") || lower.includes("why") || lower.includes("how")) {
      updateUiPrefs({ detectedMood: "Curious" });
    }
  };

  const runStreamingPrompt = async (
    promptText: string,
    appendUserMessage: boolean,
    opts?: { forceResearch?: boolean; forceReasoning?: boolean; attached?: AttachedFile | null }
  ) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;

    detectMoodFromText(trimmed);

    const activeAttachment = opts?.attached !== undefined ? opts.attached : attachment;
    const useResearch = opts?.forceResearch ?? deepResearch;
    const useReasoning = opts?.forceReasoning ?? reasoningMode;

    if (appendUserMessage) {
      appendChatMessages([
        {
          id: `msg-${Date.now()}-u`,
          role: "user",
          content: trimmed,
          attachmentName: activeAttachment?.name,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    const assistantId = `msg-${Date.now()}-a`;
    appendChatMessages([
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      },
    ]);

    setLoading(true);
    setAttachment(null);

    try {
      const activeMemories = state.memories
        .filter((m) => m.activeInContext)
        .slice(0, 5)
        .map((m) => ({ type: m.type, title: m.title, content: m.content.slice(0, 180) }));
      const activeSkills = state.skills
        .filter((s) => s.installed && s.enabled)
        .map((s) => s.name);

      const resp = await fetch(resolveApiUrl("/api/gemini/chat-stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: trimmed,
          memories: activeMemories,
          activeSkills,
          deepResearch: useResearch,
          reasoningMode: useReasoning,
          attachment: activeAttachment,
          history: state.messages.slice(-4).map((m) => ({
            role: m.role,
            content: m.content.slice(0, 500),
          })),
        }),
      });

      if (!resp.ok || !resp.body) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || "Unable to connect to JARVIS streaming backend.");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let finalSources: GroundingSource[] = [];
      let usedModel = "gemini-4-hydrogen";
      let latencyMs: number | undefined;
      let executedActionLabel: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          const evt = JSON.parse(jsonStr) as {
            type: string;
            text?: string;
            error?: string;
            model?: string;
            latencyMs?: number;
            sources?: GroundingSource[];
            action?: import("../types/jarvis").ChatActionPayload;
          };

          if (evt.type === "chunk" && evt.text) {
            accumulated += evt.text;
            updateChatMessage(assistantId, { content: accumulated });
          } else if (evt.type === "action" && evt.action) {
            const label = await applyChatAction(evt.action);
            if (label) {
              executedActionLabel = label;
            }
          } else if (evt.type === "done") {
            usedModel = evt.model || usedModel;
            latencyMs = evt.latencyMs;
            finalSources = evt.sources || [];
          } else if (evt.type === "error") {
            throw new Error(evt.error || "Streaming interrupted.");
          }
        }
      }

      if (!accumulated.trim()) {
        accumulated = "I received your request, but no text was returned. Please try again.";
      }

      updateChatMessage(assistantId, {
        content: accumulated,
        appliedAction: executedActionLabel,
        trace: {
          category: useResearch ? "Deep Research" : useReasoning ? "Reasoning" : "Assistant",
          executedModel: usedModel,
          selectedSkills: useResearch ? ["Research Skill", "Browser Skill"] : ["AI Brain"],
          reasoning: "",
          executionPlan: [],
          latencyMs,
          deepResearch: useResearch,
          reasoningMode: useReasoning,
          sources: finalSources,
        },
      });

      logActivity(
        "AI Assistant",
        useResearch ? "Deep Research Response" : "Assistant Reply",
        `Model: ${usedModel}${latencyMs ? ` · ${latencyMs}ms` : ""}`,
        "nominal"
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Backend request failed.";
      updateChatMessage(assistantId, {
        role: "error",
        content: errMsg,
      });
      logActivity("AI Assistant", "Response Error", errMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const last = state.messages[state.messages.length - 1];
    if (last && last.role === "user" && !loading && autoTriggeredRef.current !== last.id) {
      autoTriggeredRef.current = last.id;
      runStreamingPrompt(last.content, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    runStreamingPrompt(text, true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const base64 = result.split(",")[1] || "";
        setAttachment({
          name: file.name,
          mimeType: file.type,
          base64Data: base64,
        });
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachment({
          name: file.name,
          mimeType: file.type || "text/plain",
          textContent: String(reader.result || ""),
        });
      };
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  const handleQuickVoice = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        start: () => void;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        start: () => void;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
      };
    };
    const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Ctor) {
      openSettings("studio");
      return;
    }
    const rec = new Ctor();
    rec.lang = state.uiPrefs.voiceLanguage.includes("Bangla") ? "bn-BD" : "en-US";
    setListeningQuick(true);
    rec.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript || "";
      if (spoken) setInput((prev) => (prev ? `${prev} ${spoken}` : spoken));
    };
    rec.onerror = () => setListeningQuick(false);
    rec.onend = () => setListeningQuick(false);
    rec.start();
  };

  const retryLastUserMessage = (errorIndex: number) => {
    const prevUser = [...state.messages.slice(0, errorIndex)]
      .reverse()
      .find((m) => m.role === "user");
    if (prevUser && !loading) {
      runStreamingPrompt(prevUser.content, false);
    }
  };

  const renderRobotAvatar = () => (
    <div className="w-9 h-9 rounded-full overflow-hidden border border-cyan-400/50 shrink-0 bg-[#0A0820] flex items-center justify-center shadow-[0_0_12px_rgba(56,189,248,0.35)]">
      {!robotAvatarError ? (
        <img
          src={ROBOT_AVATAR_URL}
          alt="JARVIS AI"
          referrerPolicy="no-referrer"
          onError={() => setRobotAvatarError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-xs font-bold text-cyan-300">J</span>
      )}
    </div>
  );

  const visibleMessages = messageFilter.trim()
    ? state.messages.filter((m) =>
        m.content.toLowerCase().includes(messageFilter.trim().toLowerCase())
      )
    : state.messages;

  const isFreshChat = state.messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] lg:h-[calc(100vh-5.75rem)] max-w-3xl mx-auto">
      {/* Dedicated Mockup Chat Top Bar */}
      <div className="flex items-center justify-between gap-3 pb-2">
        <button
          type="button"
          onClick={() => setActiveView("dashboard")}
          aria-label="Back to Home"
          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-zinc-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-500/15 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h1 className="font-display text-base font-bold text-zinc-900 dark:text-white leading-tight">
            JARVIS Chat
          </h1>
          <p className="inline-flex items-center justify-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                backendStatus.apiKeyConfigured
                  ? "bg-emerald-400 shadow-[0_0_8px_#34D399]"
                  : "bg-amber-400"
              }`}
            />
            <span>{backendStatus.apiKeyConfigured ? "Online" : "Offline"}</span>
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search chat"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-zinc-600 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-500/15"
          >
            <Search className="w-4 h-4" />
          </button>
          {state.messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              disabled={loading}
              title="Clear Chat"
              aria-label="Clear Chat"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-zinc-600 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-500/15 disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {searchOpen && (
        <div className="mb-3">
          <input
            type="search"
            value={messageFilter}
            onChange={(e) => setMessageFilter(e.target.value)}
            placeholder="Search chat history..."
            className="w-full px-4 py-2 text-xs rounded-xl jarvis-surface text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none"
          />
        </div>
      )}

      {/* Central Neon Orb Stage (Large when fresh, sleek neon header when chatting) */}
      <div className="mb-2">
        <JarvisCompanionStage
          isTalking={loading}
          isListening={listeningQuick}
          online={backendStatus.apiKeyConfigured}
          animated={state.uiPrefs.backgroundAnimation}
          compact={!isFreshChat}
        />
      </div>

      {/* Chat History Stream */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-2">
        {isFreshChat && (
          <div className="flex items-start gap-2.5 justify-center pt-1">
            {renderRobotAvatar()}
            <div className="jarvis-surface px-4 py-3 max-w-sm">
              <p className="text-sm text-zinc-900 dark:text-white leading-relaxed">
                Hello {state.uiPrefs.userName || "Imran"}! 👋
                <br />
                How can I help you today?
              </p>
            </div>
          </div>
        )}

        {visibleMessages.map((msg: ChatMessage, idx: number) => {
          const isUser = msg.role === "user";
          const isError = msg.role === "error";
          const isLastEmpty = loading && idx === visibleMessages.length - 1 && !msg.content;

          if (isUser) {
            return (
              <div key={msg.id} className="flex items-end justify-end gap-2.5">
                <div
                  className="max-w-lg rounded-2xl rounded-br-sm px-4 py-3 text-sm text-white shadow-[0_6px_22px_-4px_rgba(124,58,237,0.5)]"
                  style={{
                    background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
                  }}
                >
                  {msg.attachmentName && (
                    <p className="mb-1 text-xs opacity-80 font-mono">
                      Attached: {msg.attachmentName}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <p className="mt-1 text-[10px] font-mono text-violet-100/80 text-right tabular-nums">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div className="w-8 h-8 rounded-full overflow-hidden border border-violet-400/50 shrink-0 bg-indigo-950 flex items-center justify-center">
                  {!userAvatarError ? (
                    <img
                      src={USER_AVATAR_URL}
                      alt={state.uiPrefs.userName || "Imran"}
                      referrerPolicy="no-referrer"
                      onError={() => setUserAvatarError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-white">
                      {(state.uiPrefs.userName || "I")[0]}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex items-start gap-2.5">
              {renderRobotAvatar()}
              <div
                className={`max-w-2xl rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed ${
                  isError
                    ? "bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/40 text-red-800 dark:text-red-200"
                    : "jarvis-surface text-zinc-900 dark:text-slate-100"
                }`}
              >
                <div className="whitespace-pre-wrap">
                  {msg.content ||
                    (isLastEmpty
                      ? state.uiPrefs.typingEffect
                        ? "● Speaking..."
                        : "Processing..."
                      : "")}
                </div>

                {msg.appliedAction && (
                  <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-emerald-500/12 border border-emerald-400/35 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    ✓ {msg.appliedAction}
                  </div>
                )}

                {isError && (
                  <button
                    type="button"
                    onClick={() => retryLastUserMessage(idx)}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-[#141132] border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-200"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Retry Request</span>
                  </button>
                )}

                {msg.trace && (
                  <div className="mt-2.5 pt-2 border-t border-violet-200/60 dark:border-violet-400/18 space-y-2 text-xs text-zinc-500 dark:text-slate-400">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-violet-600 dark:text-violet-300">
                          {msg.trace.category}
                        </span>
                        <span>·</span>
                        <span className="font-mono">{msg.trace.executedModel}</span>
                        {msg.trace.latencyMs !== undefined && (
                          <>
                            <span>·</span>
                            <span className="font-mono tabular-nums">{msg.trace.latencyMs}ms</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMessageFeedback(msg.id, "helpful")}
                          aria-label="Mark reply helpful"
                          className={`p-1 rounded-md transition-colors ${
                            msg.feedback === "helpful"
                              ? "text-emerald-400 bg-emerald-500/15"
                              : "hover:text-emerald-400"
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMessageFeedback(msg.id, "not_helpful")}
                          aria-label="Mark reply not helpful"
                          className={`p-1 rounded-md transition-colors ${
                            msg.feedback === "not_helpful"
                              ? "text-rose-400 bg-rose-500/15"
                              : "hover:text-rose-400"
                          }`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {msg.trace.sources && msg.trace.sources.length > 0 && (
                      <div className="pt-1 space-y-1">
                        <p className="font-medium text-zinc-700 dark:text-slate-300">Web Sources</p>
                        <ul className="space-y-1">
                          {msg.trace.sources.slice(0, 5).map((src) => (
                            <li key={src.uri}>
                              <a
                                href={src.uri}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-violet-600 dark:text-cyan-300 hover:underline truncate max-w-full"
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate">{src.title}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <p className="mt-1 text-[10px] font-mono text-zinc-400 dark:text-slate-400 text-right tabular-nums">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={feedEndRef} />
      </div>

      {/* Mockup 2x2 Quick Prompt Grid (when fresh) + Mode Toggles */}
      <div className="py-2 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => runStreamingPrompt("Tell me an inspiring short story.", true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-white/90 dark:bg-[#120F2B]/90 border border-violet-200 dark:border-violet-400/25 text-zinc-700 dark:text-slate-100 hover:border-violet-400 transition-colors whitespace-nowrap truncate"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">Tell me a story</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => runStreamingPrompt("Write a crisp essay on personal AI assistants.", true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-white/90 dark:bg-[#120F2B]/90 border border-violet-200 dark:border-violet-400/25 text-zinc-700 dark:text-slate-100 hover:border-violet-400 transition-colors whitespace-nowrap truncate"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">Write an essay</span>
          </button>

          <button
            type="button"
            onClick={() => setDeepResearch((v) => !v)}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-colors whitespace-nowrap truncate ${
              deepResearch
                ? "bg-cyan-500/20 border-cyan-400 text-cyan-700 dark:text-cyan-200"
                : "bg-white/90 dark:bg-[#120F2B]/90 border-violet-200 dark:border-violet-400/25 text-zinc-700 dark:text-slate-100 hover:border-violet-400"
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">Search on web{deepResearch ? " · ON" : ""}</span>
          </button>

          <button
            type="button"
            onClick={() => setReasoningMode((v) => !v)}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-colors whitespace-nowrap truncate ${
              reasoningMode
                ? "bg-violet-500/25 border-violet-400 text-violet-700 dark:text-violet-200"
                : "bg-white/90 dark:bg-[#120F2B]/90 border-violet-200 dark:border-violet-400/25 text-zinc-700 dark:text-slate-100 hover:border-violet-400"
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">Reasoning{reasoningMode ? " · ON" : ""}</span>
          </button>
        </div>
      </div>

      {/* Floating Bottom Pill Composer */}
      {attachment && (
        <div className="mb-2 flex items-center justify-between gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/15 border border-violet-400/30 text-xs text-violet-700 dark:text-violet-200">
          <span className="truncate font-mono">Attached: {attachment.name}</span>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            aria-label="Remove attachment"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-full bg-white/95 dark:bg-[#120F2B]/95 backdrop-blur-xl border border-violet-200 dark:border-violet-400/30 p-1.5 shadow-[0_8px_28px_-4px_rgba(124,58,237,0.28)]"
      >

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.json,.html,.css,.js,.ts,.tsx,.csv,image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            aria-label="Attach file"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-violet-50 dark:bg-[#19153A] text-zinc-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-white shrink-0"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-400 focus:outline-none"
          />

          <button
            type="button"
            onClick={handleQuickVoice}
            title="Voice Input"
            aria-label="Voice Input"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 ${
              listeningQuick
                ? "bg-rose-600 text-white"
                : "text-zinc-500 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-500/15"
            }`}
          >
            <Mic className="w-4 h-4" />
          </button>

          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="jarvis-gradient-btn w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-45 shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
