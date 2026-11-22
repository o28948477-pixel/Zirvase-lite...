export type NavView =
  | "welcome"
  | "dashboard"
  | "assistant"
  | "brain"
  | "models"
  | "skills"
  | "coding"
  | "github"
  | "memory"
  | "voice"
  | "diagnostics"
  | "evolution"
  | "approvals"
  | "settings";

export type ThemeMode = "light" | "dark" | "adaptive";

export type AccentTheme =
  | "cosmic-violet"
  | "cyber-cyan"
  | "emerald-matrix"
  | "rose-aurora"
  | "solar-gold";

export type SettingsTab = "general" | "models" | "memory" | "studio" | "system";

export type VoiceLanguageLabel = "Bangla (বাংলা)" | "English (US)" | "English (UK)";

export interface UIPreferences {
  userName: string;
  voiceLanguage: VoiceLanguageLabel;
  backgroundAnimation: boolean;
  typingEffect: boolean;
  moodColors: boolean;
  hasCompletedWelcome: boolean;
  detectedMood: "Happy" | "Focused" | "Curious" | "Calm";
  accentTheme: AccentTheme;
  autoHealOnConnect: boolean;
}

export interface AutoScanReport {
  trigger: "api_connected" | "manual" | "chat_command";
  scannedAt: string;
  status: "scanning" | "healthy" | "issues_found" | "healed";
  issuesFound: string[];
  fixesApplied: string[];
  summary: string;
  environmentNote: string;
}

export interface ChatActionPayload {
  actionType: "none" | "change_theme" | "scan_and_heal" | "toggle_animation";
  themeMode?: ThemeMode | "keep";
  accentTheme?: AccentTheme | "cycle_pretty" | "keep";
  animationEnabled?: boolean;
  actionSummary?: string;
}

export type ModelProviderId = "gemini" | "chatgpt" | "claude" | "deepseek";

export type ConnectionStatus =
  | "verified"
  | "configured_untested"
  | "not_connected"
  | "error";

export interface AIModelEntry {
  id: ModelProviderId;
  name: string;
  modelSlug: string;
  provider: string;
  status: ConnectionStatus;
  statusNote: string;
  strengths: string[];
  isDefault: boolean;
  lastTestedAt?: string;
  lastLatencyMs?: number;
  lastError?: string;
}

export type TaskCategory =
  | "Coding"
  | "Web Development"
  | "Research"
  | "Writing"
  | "Diagnostics"
  | "General";

export type RoutingPreferences = Record<TaskCategory, ModelProviderId>;

export interface SkillEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  source: "JARVIS Skill Store" | "GitHub" | "Custom";
  version: string;
  installed: boolean;
  enabled: boolean;
  permissions: string[];
  sandboxed: boolean;
}

export type MemoryType =
  | "User Preferences"
  | "Project Memory"
  | "Conversation Context"
  | "Task History"
  | "Important Instructions"
  | "Skill Configuration"
  | "System Settings";

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  title: string;
  content: string;
  activeInContext: boolean;
  protected: boolean;
  updatedAt: string;
}

export type UpdateStatus =
  | "Detected"
  | "Preparing"
  | "Waiting for Approval"
  | "Approved"
  | "Applying"
  | "Testing"
  | "Completed"
  | "Failed"
  | "Rolled Back";

export type ApprovalActionType =
  | "toggle_theme"
  | "enable_skill"
  | "disable_skill"
  | "install_skill"
  | "uninstall_skill"
  | "apply_code"
  | "add_memory_rule"
  | "update_routing"
  | "config_hardening";

export interface ApprovalItem {
  id: string;
  title: string;
  source: "Self-Evolution" | "System Diagnostics" | "Skill Store" | "Coding Studio" | "AI Brain";
  area: string;
  status: UpdateStatus;
  problemOrReason: string;
  proposedSolution: string;
  securityImpact: string;
  beforePreview: string;
  afterPreview: string;
  actionType: ApprovalActionType;
  actionPayload: Record<string, unknown>;
  rollbackSnapshot?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CodingProject {
  id: string;
  name: string;
  description: string;
  html: string;
  css: string;
  js: string;
  updatedAt: string;
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface BrainTrace {
  category: string;
  executedModel: string;
  selectedSkills: string[];
  reasoning: string;
  executionPlan: string[];
  latencyMs?: number;
  deepResearch?: boolean;
  reasoningMode?: boolean;
  sources?: GroundingSource[];
  suggestedActionType?: string;
  suggestedActionTitle?: string;
  suggestedMemoryContent?: string;
  suggestedCodeHtml?: string;
  suggestedCodeCss?: string;
  suggestedCodeJs?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  timestamp: string;
  attachmentName?: string;
  feedback?: "helpful" | "not_helpful";
  appliedAction?: string;
  trace?: BrainTrace;
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  module: string;
  action: string;
  detail: string;
  status: "nominal" | "pending" | "warning" | "error";
}

export interface DiagnosticCheck {
  id: string;
  name: string;
  category: "Backend" | "Frontend Code" | "Security" | "Capabilities" | "Storage";
  status: "pass" | "warning" | "fail";
  summary: string;
  detail: string;
  suggestedFix?: {
    title: string;
    solution: string;
    actionType: ApprovalActionType;
    actionPayload: Record<string, unknown>;
  };
}
