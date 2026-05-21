import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AgendaEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
};

type Props = {
  events: AgendaEvent[];
  onCreate: (startsAtLocal: string) => void;
  onEdit: (e: AgendaEvent) => void;
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const HOUR_START = 7;
const HOUR_END = 22;
const HOUR_PX = 48;
const DAY_MINUTES = (HOUR_END - HOUR_START + 1) * 60;

function startOfWeek(d: Date) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Segment = {
  event: AgendaEvent;
  startMin: number; // minutes from HOUR_START on this day, clipped
  endMin: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

type LaidOutSegment = Segment & { col: number; cols: number };

function layoutOverlaps(segs: Segment[]): LaidOutSegment[] {
  // Greedy column assignment for overlapping segments
  const sorted = [...segs].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  type Active = LaidOutSegment;
  const result: Active[] = [];
  // Cluster overlapping segments and compute max cols within cluster
  let cluster: Active[] = [];
  let clusterEnd = -Infinity;
  const flushCluster = () => {
    if (!cluster.length) return;
    const cols = Math.max(...cluster.map((c) => c.col)) + 1;
    cluster.forEach((c) => (c.cols = cols));
    result.push(...cluster);
    cluster = [];
    clusterEnd = -Infinity;
  };

  sorted.forEach((s) => {
    if (s.startMin >= clusterEnd) flushCluster();
    // Find first free column
    const usedCols = new Set(
      cluster.filter((c) => c.endMin > s.startMin).map((c) => c.col),
    );
    let col = 0;
    while (usedCols.has(col)) col++;
    const laid: Active = { ...s, col, cols: 1 };
    cluster.push(laid);
    clusterEnd = Math.max(clusterEnd, s.endMin);
  });
  flushCluster();
  return result;
}

export function WeekAgenda({ events, onCreate, onEdit }: Props) {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(anchor, i)), [anchor]);
  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i),
    [],
  );

  const weekLabel = useMemo(() => {
    const last = days[6];
    const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    return `${fmt(anchor)} – ${fmt(last)} ${last.getFullYear()}`;
  }, [anchor, days]);

  // Per-day list of laid-out segments (handles multi-day + overlap)
  const segmentsByDay = useMemo(() => {
    const m: LaidOutSegment[][] = Array.from({ length: 7 }, () => []);
    days.forEach((day, di) => {
      const dayStart = new Date(day);
      dayStart.setHours(HOUR_START, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(HOUR_END + 1, 0, 0, 0);

      const segs: Segment[] = [];
      events.forEach((e) => {
        const s = new Date(e.starts_at);
        const en = e.ends_at ? new Date(e.ends_at) : new Date(s.getTime() + 60 * 60 * 1000);
        if (en <= dayStart || s >= dayEnd) return; // not visible on this day
        const clippedStart = s < dayStart ? dayStart : s;
        const clippedEnd = en > dayEnd ? dayEnd : en;
        const startMin = Math.max(
          0,
          (clippedStart.getTime() - dayStart.getTime()) / 60000,
        );
        const endMin = Math.min(
          DAY_MINUTES,
          (clippedEnd.getTime() - dayStart.getTime()) / 60000,
        );
        if (endMin <= startMin) return;
        segs.push({
          event: e,
          startMin,
          endMin,
          continuesBefore: s < dayStart,
          continuesAfter: en > dayEnd,
        });
      });
      m[di] = layoutOverlaps(segs);
    });
    return m;
  }, [events, days]);

  const today = new Date();

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAnchor(startOfWeek(new Date()))}>
            Aujourd'hui
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setAnchor(addDays(anchor, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setAnchor(addDays(anchor, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium text-slate-700">{weekLabel}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          {/* Header row */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50">
            <div />
            {days.map((d, i) => {
              const isToday = sameDay(d, today);
              return (
                <div
                  key={i}
                  className={`border-l border-slate-200 px-2 py-2 text-center text-xs ${
                    isToday ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600"
                  }`}
                >
                  <div>{DAY_LABELS[i]}</div>
                  <div className="text-base font-semibold text-slate-900">{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Body grid */}
          <div className="relative grid grid-cols-[60px_repeat(7,1fr)]">
            {/* Hours column */}
            <div className="border-r border-slate-200">
              {hours.map((h) => (
                <div
                  key={h}
                  style={{ height: HOUR_PX }}
                  className="-mt-2 pr-2 text-right text-[11px] text-slate-400"
                >
                  {h}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((d, di) => (
              <div key={di} className="relative border-l border-slate-200">
                {hours.map((h) => (
                  <button
                    key={h}
                    type="button"
                    style={{ height: HOUR_PX }}
                    className="block w-full border-b border-slate-100 hover:bg-indigo-50/40"
                    onClick={() => {
                      const dt = new Date(d);
                      dt.setHours(h, 0, 0, 0);
                      onCreate(toLocalInput(dt));
                    }}
                  />
                ))}

                {/* Events */}
                {segmentsByDay[di].map((seg) => {
                  const e = seg.event;
                  const top = (seg.startMin / 60) * HOUR_PX;
                  const height = Math.max(20, ((seg.endMin - seg.startMin) / 60) * HOUR_PX - 2);
                  const widthPct = 100 / seg.cols;
                  const leftPct = seg.col * widthPct;
                  const s = new Date(e.starts_at);
                  const en = e.ends_at ? new Date(e.ends_at) : new Date(s.getTime() + 60 * 60 * 1000);
                  return (
                    <div
                      key={`${e.id}-${seg.startMin}`}
                      style={{
                        top,
                        height,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                      }}
                      className="absolute group"
                    >
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onEdit(e);
                        }}
                        className={`h-full w-full overflow-hidden rounded-md border border-indigo-300 bg-indigo-100 px-2 py-1 text-left text-[11px] leading-tight text-indigo-900 shadow-sm hover:bg-indigo-200 ${
                          seg.continuesBefore ? "rounded-t-none border-t-0" : ""
                        } ${seg.continuesAfter ? "rounded-b-none border-b-0" : ""}`}
                      >
                        <div className="font-semibold truncate">
                          {seg.continuesBefore && "↑ "}
                          {e.title}
                        </div>
                        <div className="opacity-80">
                          {pad(s.getHours())}:{pad(s.getMinutes())}
                          {e.ends_at && ` – ${pad(en.getHours())}:${pad(en.getMinutes())}`}
                        </div>
                        {e.location && <div className="truncate opacity-70">📍 {e.location}</div>}
                        {seg.continuesAfter && (
                          <div className="text-[10px] italic opacity-70">… suite</div>
                        )}
                      </button>
                      {/* "+" overlay : créer un rdv superposé au même créneau */}
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          const dt = new Date(d);
                          const startHour = Math.floor(seg.startMin / 60) + HOUR_START;
                          const startMinute = seg.startMin % 60;
                          dt.setHours(startHour, startMinute, 0, 0);
                          onCreate(toLocalInput(dt));
                        }}
                        className="absolute -top-1 -right-1 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md hover:bg-indigo-700 group-hover:flex"
                        title="Ajouter un rendez-vous superposé"
                        aria-label="Ajouter un rendez-vous superposé"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
