"use client";

import { useSlotStore } from "@/lib/store";

export default function CreditSelector() {
  const creditsPerLine = useSlotStore((s) => s.creditsPerLine);
  const setCreditsPerLine = useSlotStore((s) => s.setCreditsPerLine);
  const spinning = useSlotStore((s) => s.spinning);

  return (
    <div className="flex items-center gap-3">
      <span className="hud-label" style={{ minWidth: 64 }}>Cr / Line</span>
      <div className="flex gap-1.5">
        {([1, 5, 10] as const).map((n) => {
          const active = creditsPerLine === n;
          return (
            <button
              key={n}
              onClick={() => setCreditsPerLine(n)}
              disabled={spinning}
              style={{
                width: 42,
                height: 34,
                background: active ? "var(--teal)" : "transparent",
                color: active ? "#0A0A0A" : "rgba(24,124,155,0.6)",
                border: `1px solid ${active ? "var(--teal)" : "rgba(24,124,155,0.25)"}`,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 700,
                cursor: spinning ? "not-allowed" : "pointer",
                opacity: spinning ? 0.45 : 1,
                transition: "all 0.15s",
                borderRadius: 0,
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
