"use client";

import { useSlotStore } from "@/lib/store";

export default function CreditSelector() {
  const creditsPerLine = useSlotStore((s) => s.creditsPerLine);
  const setCreditsPerLine = useSlotStore((s) => s.setCreditsPerLine);
  const spinning = useSlotStore((s) => s.spinning);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 font-mono uppercase tracking-wider mr-1">
        Credits/line
      </span>
      {([1, 5, 10] as const).map((n) => (
        <button
          key={n}
          onClick={() => setCreditsPerLine(n)}
          disabled={spinning}
          className={[
            "w-10 h-8 rounded text-sm font-bold font-mono transition-all border",
            creditsPerLine === n
              ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_8px_rgba(59,130,246,0.4)]"
              : "bg-[#111827] border-[#1e2d4a] text-slate-400 hover:border-blue-600",
            spinning ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          ].join(" ")}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
