import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

function startOfWeek(d: Date) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // 0 = Mon
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
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  const eventsByDay = useMemo(() => {
    const m: Record<number, AgendaEvent[]> = {};
    for (let i = 0; i < 7; i++) m[i] = [];
    events.forEach((e) => {
      const s = new Date(e.starts_at);
      for (let i = 0; i < 7; i++) {
        if (sameDay(s, days[i])) {
          m[i].push(e);
          break;
        }
      }
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
                {eventsByDay[di].map((e) => {
                  const s = new Date(e.starts_at);
                  const en = e.ends_at ? new Date(e.ends_at) : new Date(s.getTime() + 60 * 60 * 1000);
                  const startMin = Math.max(0, (s.getHours() - HOUR_START) * 60 + s.getMinutes());
                  const endMin = Math.min(
                    (HOUR_END - HOUR_START + 1) * 60,
                    (en.getHours() - HOUR_START) * 60 + en.getMinutes(),
                  );
                  const top = (startMin / 60) * HOUR_PX;
                  const height = Math.max(20, ((endMin - startMin) / 60) * HOUR_PX - 2);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEdit(e);
                      }}
                      style={{ top, height }}
                      className="absolute left-1 right-1 overflow-hidden rounded-md border border-indigo-300 bg-indigo-100 px-2 py-1 text-left text-[11px] leading-tight text-indigo-900 shadow-sm hover:bg-indigo-200"
                    >
                      <div className="font-semibold truncate">{e.title}</div>
                      <div className="opacity-80">
                        {pad(s.getHours())}:{pad(s.getMinutes())}
                        {e.ends_at && ` – ${pad(en.getHours())}:${pad(en.getMinutes())}`}
                      </div>
                      {e.location && <div className="truncate opacity-70">📍 {e.location}</div>}
                    </button>
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
