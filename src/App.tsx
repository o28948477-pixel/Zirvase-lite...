/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BottomNav } from "./components/BottomNav";
import { OfflineIndicator } from "./components/PWAInstallButton";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { useJarvisStore } from "./hooks/useJarvisStore";
import { ApprovalCenterView } from "./views/ApprovalCenterView";
import { AssistantView } from "./views/AssistantView";
import { BrainView } from "./views/BrainView";
import { DashboardView } from "./views/DashboardView";
import { SettingsView } from "./views/SettingsView";
import { SkillsView } from "./views/SkillsView";
import { WelcomeView } from "./views/WelcomeView";

export default function App() {
  const store = useJarvisStore();
  const {
    state,
    activeView,
    setActiveView,
    mobileNavOpen,
    setMobileNavOpen,
    pendingApprovalsCount,
  } = store;

  const renderActiveView = () => {
    switch (activeView) {
      case "welcome":
        return <WelcomeView store={store} />;
      case "dashboard":
        return <DashboardView store={store} />;
      case "assistant":
        return <AssistantView store={store} />;
      case "brain":
        return <BrainView store={store} />;
      case "skills":
        return <SkillsView store={store} />;
      case "approvals":
        return <ApprovalCenterView store={store} />;
      case "settings":
      case "models":
      case "coding":
      case "github":
      case "memory":
      case "voice":
      case "diagnostics":
      case "evolution":
        return <SettingsView store={store} />;
    }
  };

  const showMobileBottomNav = activeView !== "welcome" && activeView !== "assistant";

  return (
    <div
      className={`min-h-screen flex jarvis-cosmic-canvas text-zinc-900 dark:text-slate-100 ${
        !state.uiPrefs.backgroundAnimation ? "jarvis-no-motion" : ""
      }`}
    >
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        pendingApprovalsCount={pendingApprovalsCount}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeView={activeView}
          pendingApprovalsCount={pendingApprovalsCount}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onNavigate={setActiveView}
        />

        <main
          className={`flex-1 px-4 py-4 sm:px-8 sm:py-6 max-w-[1160px] w-full mx-auto ${
            showMobileBottomNav ? "pb-24 lg:pb-6" : "pb-4"
          }`}
        >
          {renderActiveView()}
        </main>
      </div>

      {showMobileBottomNav && (
        <BottomNav activeView={activeView} onSelectView={setActiveView} />
      )}

      <OfflineIndicator />
    </div>
  );
}
