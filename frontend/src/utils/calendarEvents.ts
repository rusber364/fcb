import { stegaClean } from "@sanity/client/stega";
import type { Event } from "./sanity";

/** Подія у форматі, який розуміє utils/eventCalendar.mjs. Дати — YYYY-MM-DD за київським часом. */
export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  date: string;
  end_date: string | null;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  category_id: string;
  color: string | null;
  highlight_day: boolean;
  repeat: "none" | "weekly" | "biweekly" | "monthly" | "yearly";
  repeat_until: string | null;
}

const TZ = "Europe/Kyiv";
const REPEATS = new Set(["none", "weekly", "biweekly", "monthly", "yearly"]);
const dtf = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Sanity datetime (UTC ISO) → дата й час у Києві. */
function inKyiv(iso?: string): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(stegaClean(iso));
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(dtf.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** "9:30", "09.30", "10:00 – 12:00" → "09:30" (перший знайдений час) або null. */
function normTime(value?: string): string | null {
  const m = stegaClean(value || "").match(/([01]?\d|2[0-3])[:.]([0-5]\d)/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

export function toCalendarEvent(ev: Event): CalendarEvent | null {
  const start = inKyiv(ev.date);
  if (!start) return null;
  const end = inKyiv(ev.endDate);
  const rawTime = stegaClean(ev.time || "");
  const startTime = normTime(rawTime) ?? (start.time !== "00:00" ? start.time : null);
  // «10:00 – 12:00» в полі «Час» — друга година стає часом завершення
  const secondTime = rawTime.match(/([01]?\d|2[0-3])[:.]([0-5]\d)\D+([01]?\d|2[0-3])[:.]([0-5]\d)/);
  const endTime = normTime(ev.endTime) ?? (secondTime ? `${secondTime[3].padStart(2, "0")}:${secondTime[4]}` : null);
  const repeat = stegaClean(ev.repeat || "none");
  const color = stegaClean(ev.color || "");

  return {
    id: stegaClean(ev._id),
    title: ev.title,
    description: ev.description || null,
    location: ev.location || null,
    date: start.date,
    end_date: end && end.date > start.date ? end.date : null,
    all_day: !startTime,
    start_time: startTime,
    end_time: startTime && endTime && endTime > startTime ? endTime : null,
    category_id: stegaClean(ev.category || "other"),
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : null,
    highlight_day: !!ev.highlightDay,
    repeat: (REPEATS.has(repeat) ? repeat : "none") as CalendarEvent["repeat"],
    repeat_until: ev.repeatUntil ? stegaClean(ev.repeatUntil).slice(0, 10) : null,
  };
}

export function toCalendarEvents(events: Event[]): CalendarEvent[] {
  return events.map(toCalendarEvent).filter((e): e is CalendarEvent => e !== null);
}
