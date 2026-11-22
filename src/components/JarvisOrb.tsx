interface JarvisOrbProps {
  size?: "hero" | "lg" | "md" | "sm" | "xs";
  animated?: boolean;
  active?: boolean;
}

export function JarvisOrb({ size = "sm", animated = true, active = false }: JarvisOrbProps) {
  if (size === "hero") {
    return (
      <div className="relative flex flex-col items-center justify-center select-none py-2">
        <div
          className="absolute w-72 h-72 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(139,92,246,0.42) 0%, rgba(56,189,248,0.22) 48%, transparent 72%)",
            filter: "blur(24px)",
          }}
        />

        <div
          className={`relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center ${
            animated ? "animate-jarvis-float" : ""
          }`}
        >
          <svg
            viewBox="0 0 260 260"
            className={`absolute inset-0 w-full h-full ${animated ? "animate-jarvis-spin" : ""}`}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="orbRingHero" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="50%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#C084FC" />
              </linearGradient>
            </defs>
            <circle
              cx="130"
              cy="130"
              r="116"
              fill="none"
              stroke="url(#orbRingHero)"
              strokeWidth="1.8"
              strokeDasharray="130 35 28 24"
              opacity="0.8"
            />
          </svg>

          {/* Concentric Neon Lens Core */}
          <div
            className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-full flex flex-col items-center justify-center text-center"
            style={{
              background:
                "radial-gradient(circle at 50% 45%, rgba(56,189,248,0.22) 0%, rgba(17,15,46,0.92) 56%, rgba(8,7,26,0.98) 100%)",
              border: "3px solid rgba(139, 92, 246, 0.9)",
              boxShadow:
                "0 0 42px rgba(139,92,246,0.6), 0 0 70px rgba(56,189,248,0.32), inset 0 0 28px rgba(56,189,248,0.35)",
            }}
          >
            <span className="font-display text-3xl sm:text-4xl font-bold tracking-wider text-white drop-shadow-[0_2px_14px_rgba(139,92,246,0.85)]">
              JARVIS
            </span>
            <span className="mt-1 text-xs font-medium text-violet-200 tracking-wide">
              Your AI Companion
            </span>
          </div>
        </div>

        <div className="relative -mt-3 flex flex-col items-center pointer-events-none" aria-hidden="true">
          <div
            className="w-40 h-4 rounded-full"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(139,92,246,0.75) 0%, rgba(56,189,248,0.28) 55%, transparent 78%)",
              boxShadow: "0 0 22px rgba(139,92,246,0.5)",
            }}
          />
          <div
            className="w-52 h-5 -mt-1.5 rounded-full border border-violet-400/50"
            style={{
              background: "linear-gradient(180deg, rgba(22,18,58,0.94) 0%, rgba(7,6,22,0.98) 100%)",
              boxShadow: "0 6px 24px rgba(124,58,237,0.45), inset 0 1px 6px rgba(56,189,248,0.45)",
            }}
          />
        </div>
      </div>
    );
  }

  const sizeClass =
    size === "lg"
      ? "w-28 h-28"
      : size === "md"
      ? "w-14 h-14"
      : size === "sm"
      ? "w-9 h-9"
      : "w-6 h-6";

  const coreDotSize =
    size === "lg"
      ? "w-4 h-4"
      : size === "md"
      ? "w-2.5 h-2.5"
      : size === "sm"
      ? "w-1.5 h-1.5"
      : "w-1 h-1";

  return (
    <div
      className={`relative ${sizeClass} rounded-full flex items-center justify-center shrink-0 select-none ${
        animated && size === "lg" ? "animate-jarvis-float" : ""
      }`}
      aria-hidden="true"
    >
      {/* Subtle outer aura ring */}
      <span
        className={`absolute -inset-2 rounded-full border border-violet-400/25 ${
          animated && active ? "animate-jarvis-neon" : ""
        }`}
      />

      {/* Glowing Outer Violet-Cyan Ring */}
      <div
        className="relative w-full h-full rounded-full p-[3px] flex items-center justify-center"
        style={{
          background:
            "conic-gradient(from 210deg, #A855F7, #6366F1, #38BDF8, #8B5CF6, #C084FC, #A855F7)",
          boxShadow: active
            ? "0 0 28px rgba(168,85,247,0.85), 0 0 48px rgba(56,189,248,0.55)"
            : "0 0 20px rgba(139,92,246,0.6), 0 0 34px rgba(56,189,248,0.28)",
        }}
      >
        {/* Inner Dark Lens Glass */}
        <div
          className="w-full h-full rounded-full flex items-center justify-center relative overflow-hidden"
          style={{
            background:
              "radial-gradient(circle at 50% 45%, #16143D 0%, #09081E 62%, #040311 100%)",
          }}
        >
          {/* Inner Cyan Precision Rim */}
          <div
            className="w-[70%] h-[70%] rounded-full border border-sky-400/55 flex items-center justify-center"
            style={{
              boxShadow: "inset 0 0 12px rgba(56,189,248,0.28), 0 0 10px rgba(56,189,248,0.3)",
            }}
          >
            {/* Inner Pupil Ring */}
            <div className="w-[46%] h-[46%] rounded-full border border-violet-400/45 bg-[#060516] flex items-center justify-center">
              <span
                className={`${coreDotSize} rounded-full bg-sky-300 shadow-[0_0_12px_#38BDF8] transition-transform duration-200 ${
                  active ? "scale-125" : "scale-100"
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
