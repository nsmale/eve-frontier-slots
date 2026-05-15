"use client";

import { useSlotStore } from "@/lib/store";

export default function GlobalStats() {
  const stats = useSlotStore((s) => s.stats);

  const items = [
    { label: "Spins", value: stats.spins.toLocaleString() },
    { label: "Wagered", value: stats.wagered.toLocaleString() + " CR" },
    { label: "Won", value: stats.won.toLocaleString() + " CR" },
    {
      label: "Session RTP",
      value: stats.wagered > 0
        ? ((stats.won / stats.wagered) * 100).toFixed(1) + "%"
        : "—",
    },
    { label: "Best Win", value: stats.biggestWin > 0 ? stats.biggestWin.toLocaleString() + " CR" : "—" },
  ];

  return (
    <div
      className="hud-panel"
      style={{ padding: "14px 24px" }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
        <div style={{ width: 4, height: 4, background: "var(--teal)", borderRadius: "50%" }} />
        <span className="hud-label">Session Stats</span>
      </div>
      <div className="flex gap-8 flex-wrap">
        {items.map(({ label, value }) => (
          <div key={label}>
            <p className="hud-label" style={{ marginBottom: 2 }}>{label}</p>
            <p style={{
              fontFamily: "var(--font-mono)",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--white)",
              letterSpacing: "0.04em",
            }}>
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
