import { useEffect, useState } from "react";
import { subscribeDebug, clearDebug, type DebugEntry } from "@/lib/debug-bus";

export function DebugOverlay() {
  const [entries, setEntries] = useState<DebugEntry[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => subscribeDebug(setEntries), []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        zIndex: 99999,
        width: open ? 460 : 120,
        maxHeight: open ? "45vh" : 32,
        overflow: "hidden",
        background: "rgba(15,23,42,0.95)",
        color: "#e2e8f0",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        lineHeight: 1.35,
        border: "1px solid #334155",
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 8px",
          background: "#1e293b",
          cursor: "pointer",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ fontWeight: 600 }}>
          🔍 debug ({entries.length})
        </span>
        <span style={{ display: "flex", gap: 6 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearDebug();
            }}
            style={{
              background: "#334155",
              color: "#e2e8f0",
              border: "none",
              borderRadius: 3,
              padding: "1px 6px",
              cursor: "pointer",
              fontSize: 10,
            }}
          >
            clear
          </button>
          <span>{open ? "▾" : "▸"}</span>
        </span>
      </div>
      {open && (
        <div
          style={{
            overflowY: "auto",
            maxHeight: "calc(45vh - 28px)",
            padding: 6,
          }}
        >
          {entries.slice().reverse().map((e) => (
            <div key={e.id} style={{ marginBottom: 3, wordBreak: "break-word" }}>
              <span style={{ color: "#94a3b8" }}>
                {new Date(e.ts).toISOString().slice(11, 23)}{" "}
              </span>
              <span style={{ color: "#fbbf24" }}>[{e.tag}]</span>{" "}
              <span>{e.message}</span>
              {e.data !== undefined && (
                <pre
                  style={{
                    margin: "2px 0 0 12px",
                    color: "#94a3b8",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {safeStringify(e.data)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function safeStringify(v: unknown) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
