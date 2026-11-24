// Календар подій у стилі Apple Calendar: рік → місяць → день, список, пошук,
// кольорові категорії, повтори, світла/темна тема.
// Розмітку рендерить components/calendar/EventCalendar.astro; події й категорії
// завантажуються з Supabase у браузері (utils/calendarApi.mjs).
// Допоміжні функції (дати, кольори, повтори) експортуються для адмінки (calendarAdmin.mjs).

import { calendarApi } from "./calendarApi.mjs";

export const M = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];
const MG = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];
const MS = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];
export const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
const WL = ["П", "В", "С", "Ч", "П", "С", "Н"];
const WF = ["понеділок", "вівторок", "середа", "четвер", "пʼятниця", "субота", "неділя"];
export const REPEAT = {
  none: "Не повторюється",
  weekly: "Щотижня",
  biweekly: "Раз на 2 тижні",
  monthly: "Щомісяця",
  yearly: "Щороку",
};

export const pad = (n) => String(n).padStart(2, "0");
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
export function plural(n, f) {
  const a = Math.abs(n) % 100,
    b = a % 10;
  if (a > 10 && a < 20) return f[2];
  if (b === 1) return f[0];
  if (b >= 2 && b <= 4) return f[1];
  return f[2];
}

/* ---------- Дати ---------- */
export const D = {
  ymd: (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()),
  ym: (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1),
  parse(s) {
    const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  },
  add: (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n),
  wd: (d) => (d.getDay() + 6) % 7, // Пн = 0 … Нд = 6
  startOfWeek: (d) => D.add(d, -D.wd(d)),
  same: (a, b) =>
    !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(),
  today() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  },
  daysIn: (y, m) => new Date(y, m + 1, 0).getDate(),
  diff: (a, b) =>
    Math.round(
      (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
        864e5,
    ),
  long: (d) => WF[D.wd(d)] + ", " + d.getDate() + " " + MG[d.getMonth()] + " " + d.getFullYear(),
  short: (d) => d.getDate() + " " + MG[d.getMonth()],
  t: (s) => (s ? String(s).slice(0, 5) : ""),
  min(s) {
    const [h, m] = String(s).split(":").map(Number);
    return h * 60 + (m || 0);
  },
};

/* ---------- Кольори ---------- */
export function rgb(hex) {
  let h = String(hex || "#8E8E93").replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = parseInt(h, 16);
  if (isNaN(n)) return [142, 142, 147];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (c, t, k) => c.map((v, i) => Math.round(v + (t[i] - v) * k));
export function colorVars(hex) {
  const c = rgb(hex);
  const l = mix(c, [0, 0, 0], 0.32),
    d = mix(c, [255, 255, 255], 0.22);
  const lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  return `--rgb:${c.join(",")};--fg-l:rgb(${l.join(",")});--fg-d:rgb(${d.join(",")});--on:${lum > 0.68 ? "#000" : "#fff"}`;
}

/* ---------- Повтори ---------- */
export const allDayish = (o) => !!(o.ev.all_day || o.span > 0 || !o.ev.start_time);

/** Розгортає події (з повторами й багатоденні) у { 'YYYY-MM-DD': [{ev, occ, dayIndex, span, key}] }. */
export function expand(events, from, to) {
  const map = {};
  const fromS = D.ymd(from),
    toS = D.ymd(to);
  for (const ev of events) {
    if (!ev || !ev.date) continue;
    const start = D.parse(ev.date);
    const span = ev.end_date ? Math.max(0, D.diff(start, D.parse(ev.end_date))) : 0;
    const until = ev.repeat_until ? D.parse(ev.repeat_until) : null;
    const skip = new Set((ev.exdates || []).map((x) => String(x).slice(0, 10)));
    const push = (os) => {
      const k0 = D.ymd(os);
      if (skip.has(k0)) return;
      for (let i = 0; i <= span; i++) {
        const k = i ? D.ymd(D.add(os, i)) : k0;
        if (k < fromS || k > toS) continue;
        (map[k] || (map[k] = [])).push({ ev, occ: k0, dayIndex: i, span, key: ev.id + "@" + k0 });
      }
    };
    const rep = ev.repeat || "none";
    const lead = D.add(from, -span);
    const ok = (d) => d <= to && (!until || d <= until);
    if (rep === "none") {
      push(start);
      continue;
    }
    if (rep === "weekly" || rep === "biweekly") {
      const step = rep === "weekly" ? 7 : 14;
      let cur = start;
      if (cur < lead) cur = D.add(cur, Math.floor(D.diff(cur, lead) / step) * step);
      for (let g = 0; ok(cur) && g < 5000; g++) {
        push(cur);
        cur = D.add(cur, step);
      }
      continue;
    }
    const stepM = rep === "yearly" ? 12 : 1;
    for (let i = 0; i < 2400; i++) {
      const cur = new Date(start.getFullYear(), start.getMonth() + i * stepM, start.getDate());
      if (cur.getDate() !== start.getDate()) continue; // 31-ше у коротких місяцях, 29 лютого
      if (!ok(cur)) break;
      if (cur >= lead) push(cur);
    }
  }
  for (const k in map)
    map[k].sort((a, b) => {
      const A = allDayish(a),
        B = allDayish(b);
      if (A !== B) return A ? -1 : 1;
      return (
        String(a.ev.start_time || "").localeCompare(String(b.ev.start_time || "")) ||
        String(a.ev.title).localeCompare(String(b.ev.title))
      );
    });
  return map;
}

/* ---------- Іконки ---------- */
const P = {
  chevL: '<path d="M15 18l-6-6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  cal: '<rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
  calPlus: '<rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M16 2.5v4M8 2.5v4M3 10h18M12 13v6M9 16h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  repeat:
    '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  layers: '<path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z"/><path d="M3 12l9 4.5 9-4.5"/><path d="M3 16.5L12 21l9-4.5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>',
  chevR: '<path d="M9 18l6-6-6-6"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  palette:
    '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.3" fill="currentColor"/><circle cx="12" cy="7.5" r="1.3" fill="currentColor"/><circle cx="16" cy="10" r="1.3" fill="currentColor"/><path d="M12 21a2.5 2.5 0 0 1 0-5h2a3 3 0 0 0 3-3"/>',
  share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"/>',
};
export const icon = (n) =>
  `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;

export const LS = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* приватний режим тощо */
    }
  },
};

/* ---------- .ics ---------- */
function icsFor(ev, startDate) {
  const span = ev.end_date ? Math.max(0, D.diff(D.parse(ev.date), D.parse(ev.end_date))) : 0;
  const e = (s) =>
    String(s || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/([,;])/g, "\\$1");
  const dd = (d) => D.ymd(d).replace(/-/g, "");
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const L = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//baptist.ck.ua//Calendar//UK",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:" + ev.id + "-" + dd(startDate) + "@baptist.ck.ua",
    "DTSTAMP:" + now,
  ];
  if (ev.all_day || !ev.start_time || span) {
    L.push("DTSTART;VALUE=DATE:" + dd(startDate), "DTEND;VALUE=DATE:" + dd(D.add(startDate, span + 1)));
  } else {
    const st = D.t(ev.start_time).replace(":", "") + "00";
    const et = ev.end_time ? D.t(ev.end_time).replace(":", "") + "00" : st;
    L.push(
      "DTSTART;TZID=Europe/Kyiv:" + dd(startDate) + "T" + st,
      "DTEND;TZID=Europe/Kyiv:" + dd(startDate) + "T" + et,
    );
  }
  L.push("SUMMARY:" + e(ev.title));
  if (ev.location) L.push("LOCATION:" + e(ev.location));
  if (ev.description) L.push("DESCRIPTION:" + e(ev.description));
  L.push("END:VEVENT", "END:VCALENDAR");
  return L.join("\r\n");
}

/** Шторка (bottom sheet на телефоні, модальне вікно на компʼютері) і тост усередині кореня .cc. */
export function createOverlay(root) {
  const el = (tag, cls) => Object.assign(document.createElement(tag), { className: cls });
  const backEl = el("div", "backdrop");
  const sheetEl = el("div", "sheet");
  sheetEl.setAttribute("role", "dialog");
  sheetEl.setAttribute("aria-modal", "true");
  root.append(backEl, sheetEl);
  let onCloseCb = null;
  function openSheet(html, bind, onClose) {
    sheetEl.innerHTML =
      `<div class="grab"></div><button class="sheet-x" aria-label="Закрити">${icon("x")}</button>` + html;
    sheetEl.querySelector(".sheet-x").addEventListener("click", closeSheet);
    sheetEl.scrollTop = 0;
    onCloseCb = onClose || null;
    if (bind) bind(sheetEl);
    requestAnimationFrame(() => root.classList.add("sheet-open"));
  }
  function closeSheet() {
    root.classList.remove("sheet-open");
    const cb = onCloseCb;
    onCloseCb = null;
    if (cb) cb();
  }
  backEl.addEventListener("click", closeSheet);
  {
    let y0 = null,
      dy = 0;
    sheetEl.addEventListener(
      "touchstart",
      (e) => {
        if (sheetEl.scrollTop > 0 || e.touches.length > 1) return void (y0 = null);
        y0 = e.touches[0].clientY;
        dy = 0;
      },
      { passive: true },
    );
    sheetEl.addEventListener(
      "touchmove",
      (e) => {
        if (y0 == null) return;
        dy = e.touches[0].clientY - y0;
        if (dy > 0 && innerWidth < 760) {
          sheetEl.style.transition = "none";
          sheetEl.style.transform = `translateY(${dy}px)`;
        }
      },
      { passive: true },
    );
    sheetEl.addEventListener("touchend", () => {
      if (y0 == null) return;
      sheetEl.style.transition = "";
      sheetEl.style.transform = "";
      if (dy > 110) closeSheet();
      y0 = null;
    });
  }
  let toastT;
  const toastEl = el("div", "toast");
  root.appendChild(toastEl);
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("on"), 2200);
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.classList.contains("sheet-open")) closeSheet();
  });
  return { openSheet, closeSheet, toast };
}

/* ================================================================ */

export async function initEventCalendar(root) {
  let events = [],
    cats = [];
  const $ = (s) => root.querySelector(s);
  const stage = $(".cc-stage");
  const LEVEL = { year: 0, month: 1, list: 1, day: 2 };
  const isWide = () => root.clientWidth >= 760;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const S = {
    view: null,
    focus: D.today(),
    hidden: new Set(LS.get("cc_hidden", [])),
    q: "",
    occ: {},
    minY: 0,
    maxY: 0,
    topMonth: null,
    beforeSearch: null,
    wide: isWide(),
  };

  const catOf = (id) => cats.find((c) => c.id === id);
  const colorOf = (ev) => ev.color || (catOf(ev.category_id) || {}).color || "#8E8E93";
  const occList = (d) => S.occ[D.ymd(d)] || [];
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  /* ---------- Тема ---------- */
  const Theme = {
    get: () => LS.get("cc_theme", root.dataset.defaultTheme || "light"),
    isDark() {
      const t = this.get();
      return t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    },
    apply() {
      root.dataset.theme = this.isDark() ? "dark" : "light";
    },
    set(t) {
      LS.set("cc_theme", t);
      this.apply();
    },
    toggle() {
      this.set(this.isDark() ? "light" : "dark");
    },
  };
  Theme.apply();

  const { openSheet, toast } = createOverlay(root);

  /* ---------- Дані ---------- */
  function computeOcc() {
    const t = D.today();
    let minY = t.getFullYear() - 2,
      maxY = t.getFullYear() + 7;
    for (const e of events) {
      const y = +String(e.date).slice(0, 4);
      if (y && y < minY) minY = y;
      if (y > maxY && y < t.getFullYear() + 30) maxY = y;
    }
    S.minY = minY;
    S.maxY = maxY;
    const evs = events.filter((e) => !S.hidden.has(e.category_id || "none"));
    S.occ = expand(evs, new Date(minY, 0, 1), new Date(maxY, 11, 31));
  }
  const clampDate = (d) => {
    const a = new Date(S.minY, 0, 1),
      b = new Date(S.maxY, 11, 31);
    return d < a ? a : d > b ? b : d;
  };
  function centerOf(node) {
    const r = node.getBoundingClientRect(),
      s = stage.getBoundingClientRect();
    return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
  }
  const timeRange = (ev) =>
    ev.all_day || !ev.start_time ? "Весь день" : D.t(ev.start_time) + (ev.end_time ? " – " + D.t(ev.end_time) : "");

  /* ================= Маршрутизація (hash) ================= */
  function hashOf(view, d) {
    if (view === "year") return "#/year/" + d.getFullYear();
    if (view === "month") return "#/month/" + D.ym(d);
    if (view === "day") return "#/day/" + D.ymd(d);
    return "#/list";
  }
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    const [path, qs] = h.split("?");
    const p = path.split("/");
    const params = new URLSearchParams(qs || "");
    const t = D.today();
    let view = "month",
      d = S.focus || t;
    if (p[0] === "year" && /^\d{4}$/.test(p[1] || "")) {
      view = "year";
      const y = +p[1];
      d = S.focus.getFullYear() === y ? S.focus : t.getFullYear() === y ? t : new Date(y, 0, 1);
    } else if (p[0] === "month" && /^\d{4}-\d{2}$/.test(p[1] || "")) {
      const [y, m] = p[1].split("-").map(Number);
      d =
        S.focus.getFullYear() === y && S.focus.getMonth() === m - 1
          ? S.focus
          : t.getFullYear() === y && t.getMonth() === m - 1
            ? t
            : new Date(y, m - 1, 1);
    } else if (p[0] === "day" && /^\d{4}-\d{2}-\d{2}$/.test(p[1] || "")) {
      view = "day";
      d = D.parse(p[1]);
    } else if (p[0] === "list") view = "list";
    else d = t;
    return { view, d: clampDate(d), ev: params.get("ev") };
  }
  let pending = null;
  function go(view, d, origin) {
    pending = { view, d, origin };
    const h = hashOf(view, d);
    if (location.hash === h) route();
    else location.hash = h;
  }
  function route() {
    const r = parseHash();
    let d = r.d,
      origin = null;
    if (pending && pending.view === r.view && hashOf(pending.view, pending.d) === hashOf(r.view, r.d)) {
      d = pending.d;
      origin = pending.origin;
    }
    pending = null;
    show(r.view, d, origin);
    if (r.ev) {
      const ev = events.find((e) => e.id === r.ev);
      if (ev) openEvent(ev, D.ymd(r.view === "day" ? d : D.parse(ev.date)));
    }
  }
  addEventListener("hashchange", route);

  /* ================= Види + анімація зуму ================= */
  function show(view, d, origin) {
    const prev = S.view;
    S.view = view;
    S.focus = d;
    const cur = stage.querySelector(".layer.active");
    if (prev === view && cur) {
      if (view === "day") renderDay(cur);
      else if (view === "month") scrollMonthTo(cur, d, true);
      else if (view === "year") scrollYearTo(cur, d, true);
      else fillList(cur);
      updateChrome();
      return;
    }
    const layer =
      view === "year" ? buildYear() : view === "day" ? buildDay() : view === "list" ? buildList() : buildMonth();
    let dir = "fade";
    if (prev && view !== "list" && prev !== "list") dir = LEVEL[view] > LEVEL[prev] ? "in" : "out";
    if (!prev) dir = "none";
    mount(layer, dir, origin);
    updateChrome();
  }
  function mount(layer, dir, origin) {
    const old = stage.querySelector(".layer.active");
    stage.querySelectorAll(".loading, .layer:not(.active)").forEach((n) => n.remove());
    layer.classList.add("layer", "active");
    stage.appendChild(layer);
    if (layer._afterMount) layer._afterMount();
    if (!old) return;
    old.classList.remove("active");
    old.style.pointerEvents = "none";
    if (reduced || dir === "none" || !layer.animate) return void old.remove();
    const W = stage.clientWidth,
      H = stage.clientHeight;
    let o = origin;
    if (!o && dir === "out" && layer._anchor) {
      const a = layer._anchor();
      if (a) o = centerOf(a);
    }
    if (!o) o = { x: W / 2, y: H / 3 };
    o = { x: Math.max(0, Math.min(W, o.x)), y: Math.max(0, Math.min(H, o.y)) };
    layer.style.transformOrigin = old.style.transformOrigin = `${o.x}px ${o.y}px`;
    const opt = { duration: 460, easing: "cubic-bezier(.32,.72,0,1)" };
    let a1, a2;
    if (dir === "in") {
      a1 = layer.animate(
        [
          { transform: "scale(.28)", opacity: 0 },
          { transform: "scale(1)", opacity: 1 },
        ],
        opt,
      );
      a2 = old.animate(
        [
          { transform: "scale(1)", opacity: 1 },
          { transform: "scale(2.6)", opacity: 0 },
        ],
        opt,
      );
    } else if (dir === "out") {
      a1 = layer.animate(
        [
          { transform: "scale(2.6)", opacity: 0 },
          { transform: "scale(1)", opacity: 1 },
        ],
        opt,
      );
      a2 = old.animate(
        [
          { transform: "scale(1)", opacity: 1 },
          { transform: "scale(.28)", opacity: 0 },
        ],
        opt,
      );
    } else {
      a1 = layer.animate(
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 260, easing: "ease-out" },
      );
      a2 = old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
    }
    a2.onfinish = () => old.remove();
    a1.onfinish = () => (layer.style.transformOrigin = "");
  }

  /* ================= РІК ================= */
  function buildYear() {
    const L = el("div", "year-layer");
    const t = D.today();
    let h = "";
    for (let y = S.minY; y <= S.maxY; y++) {
      h += `<section class="year" data-y="${y}"><h2 class="year-title${y === t.getFullYear() ? " cur" : ""}">${y}</h2><div class="ygrid">`;
      for (let m = 0; m < 12; m++) h += miniMonth(y, m, t);
      h += "</div></section>";
    }
    L.innerHTML = h;
    L._afterMount = () => scrollYearTo(L, S.focus, false);
    L._anchor = () => L.querySelector(`.mini[data-m="${D.ym(S.focus)}"]`);
    L.addEventListener("click", (e) => {
      const mini = e.target.closest(".mini");
      if (!mini) return;
      const [y, m] = mini.dataset.m.split("-").map(Number);
      const d =
        S.focus.getFullYear() === y && S.focus.getMonth() === m - 1
          ? S.focus
          : t.getFullYear() === y && t.getMonth() === m - 1
            ? t
            : new Date(y, m - 1, 1);
      go("month", d, centerOf(mini));
    });
    return L;
  }
  function miniMonth(y, m, t) {
    const lead = D.wd(new Date(y, m, 1)),
      n = D.daysIn(y, m);
    const cur = y === t.getFullYear() && m === t.getMonth();
    let h = `<div class="mini${cur ? " cur" : ""}" data-m="${y}-${pad(m + 1)}" role="button" tabindex="0" aria-label="${M[m]} ${y}"><div class="mini-name"><span class="short">${MS[m]}</span><span class="full">${M[m]}</span></div><div class="mini-wd">${WL.map((x) => `<span>${x}</span>`).join("")}</div><div class="mini-grid">`;
    for (let i = 0; i < lead; i++) h += "<span></span>";
    for (let d = 1; d <= n; d++) {
      const o = S.occ[y + "-" + pad(m + 1) + "-" + pad(d)];
      let dot = "";
      if (o && o.length) dot = `<i style="background:${esc(colorOf((o.find((x) => x.ev.tint_day) || o[0]).ev))}"></i>`;
      h += `<span class="md${cur && d === t.getDate() ? " t" : ""}">${d}${dot}</span>`;
    }
    return h + "</div></div>";
  }
  function scrollYearTo(L, d, smooth) {
    const s = L.querySelector(`.year[data-y="${d.getFullYear()}"]`);
    if (!s) return;
    let top = s.offsetTop;
    const mini = L.querySelector(`.mini[data-m="${D.ym(d)}"]`);
    if (mini && mini.offsetTop + mini.offsetHeight > top + L.clientHeight) top = mini.offsetTop - L.clientHeight / 3;
    L.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  }

  /* ================= МІСЯЦЬ ================= */
  function buildMonth() {
    const L = el("div", "month-layer");
    L.innerHTML = `<div class="weekdays">${WD.map((w, i) => `<div class="${i > 4 ? "we" : ""}">${w}</div>`).join("")}</div><div class="months"></div>`;
    const box = L.querySelector(".months");
    const f = S.focus;
    const minM = new Date(S.minY, 0, 1),
      maxM = new Date(S.maxY, 11, 1);
    L._start = new Date(f.getFullYear(), f.getMonth() - 4, 1);
    if (L._start < minM) L._start = minM;
    L._end = new Date(f.getFullYear(), f.getMonth() + 8, 1);
    if (L._end > maxM) L._end = maxM;
    for (let m = new Date(L._start); m <= L._end; m = new Date(m.getFullYear(), m.getMonth() + 1, 1))
      box.appendChild(monthBlock(m));
    L._afterMount = () => scrollMonthTo(L, S.focus, false);
    L._anchor = () =>
      L.querySelector(`.day[data-d="${D.ymd(S.focus)}"]`) || L.querySelector(`.month[data-m="${D.ym(S.focus)}"]`);
    L.addEventListener("scroll", () => onMonthScroll(L), { passive: true });
    L.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip[data-k]");
      if (chip && isWide()) return void openByKey(chip.dataset.k);
      const c = e.target.closest(".day[data-d]");
      if (!c) return;
      L.querySelectorAll(".day.sel").forEach((n) => n.classList.remove("sel"));
      c.classList.add("sel");
      go("day", D.parse(c.dataset.d), centerOf(c));
    });
    return L;
  }
  function monthBlock(m) {
    const y = m.getFullYear(),
      mo = m.getMonth(),
      n = D.daysIn(y, mo),
      lead = D.wd(new Date(y, mo, 1));
    const t = D.today(),
      wide = isWide();
    const sec = el("section", "month");
    sec.dataset.m = y + "-" + pad(mo + 1);
    const max = wide ? 4 : 3;
    let h = `<h3 class="month-title${y === t.getFullYear() && mo === t.getMonth() ? " cur" : ""}" style="--col:${wide ? 0 : Math.min(lead, 4)}"><span>${M[mo]}${wide ? ' <span style="color:var(--text2);font-weight:500">' + y + "</span>" : ""}</span></h3><div class="mgrid">`;
    for (let i = 0; i < lead; i++) h += '<div class="blank"></div>';
    for (let d = 1; d <= n; d++) {
      const dt = new Date(y, mo, d),
        k = D.ymd(dt),
        list = S.occ[k] || [];
      const tint = list.find((o) => o.ev.tint_day);
      let cls = "day";
      if (D.same(dt, t)) cls += " today";
      if (D.same(dt, S.focus)) cls += " sel";
      if (tint) cls += " tint";
      const style = tint ? ` style="--trgb:${rgb(colorOf(tint.ev)).join(",")}"` : "";
      let chips = "";
      if (list.length) {
        const shown = list.length > max ? list.slice(0, max - 1) : list;
        chips =
          '<div class="chips">' +
          shown
            .map((o) => {
              const ad = allDayish(o);
              return `<span class="chip${ad ? " solid" : ""}" data-k="${esc(o.key)}" style="${colorVars(colorOf(o.ev))}">${wide && !ad ? `<b>${D.t(o.ev.start_time)}</b>` : ""}${esc(o.ev.title)}</span>`;
            })
            .join("") +
          (list.length > shown.length
            ? `<span class="more">+${list.length - shown.length}${wide ? " ще" : ""}</span>`
            : "") +
          "</div>";
      }
      h += `<button class="${cls}" data-d="${k}"${style} aria-label="${D.long(dt)}${list.length ? ", " + list.length + " " + plural(list.length, ["подія", "події", "подій"]) : ""}"><span class="num">${d}</span>${chips}</button>`;
    }
    sec.innerHTML = h + "</div>";
    return sec;
  }
  function scrollMonthTo(L, d, smooth) {
    const sec = L.querySelector(`.month[data-m="${D.ym(d)}"]`);
    if (!sec) {
      S.focus = d;
      const nl = buildMonth();
      nl.classList.add("layer", "active");
      L.replaceWith(nl);
      return scrollMonthTo(nl, d, false);
    }
    const wdH = L.querySelector(".weekdays").offsetHeight;
    let top = sec.offsetTop - wdH;
    const cell = sec.querySelector(`.day[data-d="${D.ymd(d)}"]`);
    if (cell && cell.offsetTop + cell.offsetHeight - top > L.clientHeight - 20)
      top = cell.offsetTop - L.clientHeight / 2;
    L.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
    onMonthScroll(L, true);
  }
  function onMonthScroll(L, now) {
    const run = () => {
      L._tick = false;
      const box = L.querySelector(".months");
      if (!box) return;
      const minM = new Date(S.minY, 0, 1),
        maxM = new Date(S.maxY, 11, 1);
      if (L.scrollTop < 900 && L._start > minM) {
        const before = L.scrollHeight,
          blocks = [];
        let s = L._start;
        for (let i = 0; i < 6 && s > minM; i++) {
          s = new Date(s.getFullYear(), s.getMonth() - 1, 1);
          blocks.unshift(monthBlock(s));
        }
        L._start = s;
        box.prepend(...blocks);
        L.scrollTop += L.scrollHeight - before;
      }
      if (L.scrollHeight - L.scrollTop - L.clientHeight < 1200 && L._end < maxM) {
        let s = L._end;
        for (let i = 0; i < 6 && s < maxM; i++) {
          s = new Date(s.getFullYear(), s.getMonth() + 1, 1);
          box.appendChild(monthBlock(s));
        }
        L._end = s;
      }
      const wdH = L.querySelector(".weekdays").offsetHeight;
      let top = null;
      for (const sec of box.children) {
        if (sec.offsetTop + sec.offsetHeight > L.scrollTop + wdH + 40) {
          top = sec;
          break;
        }
      }
      if (top) {
        const [y, m] = top.dataset.m.split("-").map(Number);
        const tm = new Date(y, m - 1, 1);
        if (!S.topMonth || D.ym(S.topMonth) !== D.ym(tm)) {
          S.topMonth = tm;
          if (S.view === "month") history.replaceState(null, "", hashOf("month", tm));
          updateChrome();
        }
      }
    };
    if (now) return run();
    if (L._tick) return;
    L._tick = true;
    requestAnimationFrame(run);
  }

  /* ================= ДЕНЬ ================= */
  function buildDay() {
    const L = el("div", "day-layer");
    L.innerHTML = `<div class="ws-wrap"><div class="weekstrip"></div><div class="day-title"></div></div>
      <div class="day-body"><div class="day-main"><div class="allday"></div><div class="tl-scroll"><div class="timeline"></div></div></div><aside class="day-side"></aside></div>`;
    L._afterMount = () => renderDay(L);
    L.addEventListener("click", (e) => {
      const ws = e.target.closest(".ws[data-d]");
      if (ws) return void setDay(L, D.parse(ws.dataset.d));
      const k = e.target.closest("[data-k]");
      if (k) openByKey(k.dataset.k);
    });
    let sx = null,
      sy = 0,
      onStrip = false;
    L.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return void (sx = null);
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
        onStrip = !!e.target.closest(".ws-wrap");
      },
      { passive: true },
    );
    L.addEventListener(
      "touchend",
      (e) => {
        if (sx == null) return;
        const dx = e.changedTouches[0].clientX - sx,
          dy = e.changedTouches[0].clientY - sy;
        sx = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4)
          setDay(L, D.add(S.focus, (dx < 0 ? 1 : -1) * (onStrip ? 7 : 1)));
      },
      { passive: true },
    );
    return L;
  }
  function setDay(L, d) {
    d = clampDate(d);
    if (D.same(d, S.focus)) return;
    const dir = d > S.focus ? 1 : -1;
    S.focus = d;
    history.replaceState(null, "", hashOf("day", d));
    renderDay(L, dir);
    updateChrome();
  }
  function renderDay(L, dir) {
    const d = S.focus,
      t = D.today(),
      ws = D.startOfWeek(d);
    let h = "";
    for (let i = 0; i < 7; i++) {
      const x = D.add(ws, i);
      h += `<button class="ws${D.same(x, t) ? " today" : ""}${D.same(x, d) ? " sel" : ""}" data-d="${D.ymd(x)}"><small>${WL[i]}</small><span>${x.getDate()}</span><i class="${occList(x).length ? "on" : ""}"></i></button>`;
    }
    L.querySelector(".weekstrip").innerHTML = h;
    const list = occList(d);
    const cnt = list.length ? list.length + " " + plural(list.length, ["подія", "події", "подій"]) : "Немає подій";
    L.querySelector(".day-title").innerHTML =
      `${cap(D.long(d))}<small>${D.same(d, t) ? "Сьогодні · " : ""}${cnt}</small>`;

    const all = list.filter(allDayish),
      timed = list.filter((o) => !allDayish(o));
    L.querySelector(".allday").innerHTML = all
      .map(
        (o) =>
          `<button class="ad" data-k="${esc(o.key)}" style="${colorVars(colorOf(o.ev))}">${esc(o.ev.title)}${o.span ? `<small>день ${o.dayIndex + 1} з ${o.span + 1}</small>` : ""}</button>`,
      )
      .join("");

    const HH = isWide() ? 56 : 50;
    const tl = L.querySelector(".timeline");
    tl.style.height = 24 * HH + "px";
    let th = "";
    for (let i = 0; i < 24; i++) th += `<div class="hr" style="top:${i * HH}px"><span>${pad(i)}:00</span></div>`;
    const items = timed.map((o) => {
      const s = D.min(o.ev.start_time);
      let e = o.ev.end_time ? D.min(o.ev.end_time) : s + 60;
      if (e <= s) e = s + 30;
      return { o, s, e };
    });
    layoutCols(items);
    th +=
      '<div class="tl-events">' +
      items
        .map((it) => {
          const hgt = Math.max(((it.e - it.s) / 60) * HH - 2, 22),
            short = hgt < 40,
            ev = it.o.ev;
          return `<button class="tev" data-k="${esc(it.o.key)}" style="top:${(it.s / 60) * HH}px;height:${hgt}px;left:${(it.col / it.ncol) * 100}%;width:calc(${100 / it.ncol}% - 3px);${colorVars(colorOf(ev))}"><b>${esc(ev.title)}${short ? ` <span style="font-weight:400">${D.t(ev.start_time)}</span>` : ""}</b>${short ? "" : `<span>${timeRange(ev)}${ev.location ? " · " + esc(ev.location) : ""}</span>`}</button>`;
        })
        .join("") +
      "</div>";
    if (D.same(d, t)) {
      const n = new Date(),
        mins = n.getHours() * 60 + n.getMinutes();
      th += `<div class="now" style="top:${(mins / 60) * HH}px"></div><div class="now-t" style="top:${(mins / 60) * HH - 8}px">${pad(n.getHours())}:${pad(n.getMinutes())}</div>`;
    }
    tl.innerHTML = th;
    let target = 7.5 * 60;
    if (D.same(d, t)) target = new Date().getHours() * 60 - 90;
    else if (items.length) target = Math.min(...items.map((i) => i.s)) - 30;
    L.querySelector(".tl-scroll").scrollTop = Math.max(0, (target / 60) * HH);

    const side = L.querySelector(".day-side");
    side.innerHTML = list.length
      ? `<div class="side-h">Події дня</div>` + list.map(cardHtml).join("")
      : `<div class="side-empty">${icon("cal")}Цього дня подій немає</div>`;
    if (dir && !reduced) {
      L.querySelector(".day-main").animate(
        [
          { transform: `translateX(${dir * 40}px)`, opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
      side.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
    }
  }
  function cardHtml(o) {
    const ev = o.ev,
      cat = catOf(ev.category_id);
    return `<button class="card" data-k="${esc(o.key)}" style="${colorVars(colorOf(ev))}">
      ${cat ? `<div class="c-cat">${esc(cat.name)}</div>` : ""}<h4>${esc(ev.title)}</h4>
      <div class="meta"><span>${timeRange(ev)}</span>${ev.location ? `<span>${esc(ev.location)}</span>` : ""}${ev.repeat && ev.repeat !== "none" ? `<span>${REPEAT[ev.repeat]}</span>` : ""}</div>
      ${ev.description ? `<p>${esc(ev.description)}</p>` : ""}</button>`;
  }
  function layoutCols(items) {
    items.sort((a, b) => a.s - b.s || b.e - a.e);
    let cluster = [],
      end = -1;
    const flush = () => {
      const cols = [];
      for (const it of cluster) {
        let i = cols.findIndex((e) => e <= it.s);
        if (i < 0) {
          i = cols.length;
          cols.push(0);
        }
        cols[i] = it.e;
        it.col = i;
      }
      cluster.forEach((it) => (it.ncol = cols.length));
      cluster = [];
      end = -1;
    };
    for (const it of items) {
      if (cluster.length && it.s >= end) flush();
      cluster.push(it);
      end = Math.max(end, it.e);
    }
    if (cluster.length) flush();
  }

  /* ================= СПИСОК / ПОШУК ================= */
  function buildList() {
    const L = el("div", "list-layer");
    L.addEventListener("click", (e) => {
      const k = e.target.closest("[data-k]");
      if (k) openByKey(k.dataset.k);
    });
    fillList(L);
    return L;
  }
  function fillList(L) {
    const t = D.today(),
      q = S.q.toLowerCase();
    const from = q ? D.ymd(new Date(S.minY, 0, 1)) : D.ymd(t);
    const to = q ? D.ymd(new Date(S.maxY, 11, 31)) : D.ymd(D.add(t, 366));
    const keys = Object.keys(S.occ)
      .filter((k) => k >= from && k <= to)
      .sort();
    const match = (ev) =>
      !q ||
      [ev.title, ev.description, ev.location, (catOf(ev.category_id) || {}).name].some(
        (x) => x && String(x).toLowerCase().includes(q),
      );
    const hl = (s) => {
      const e = esc(s);
      if (!q) return e;
      const qe = esc(q),
        i = e.toLowerCase().indexOf(qe.toLowerCase());
      return i < 0 ? e : e.slice(0, i) + "<mark>" + e.slice(i, i + qe.length) + "</mark>" + e.slice(i + qe.length);
    };
    let h = "",
      count = 0;
    for (const k of keys) {
      const items = S.occ[k].filter((o) => (o.dayIndex === 0 || k === from) && match(o.ev));
      if (!items.length) continue;
      const d = D.parse(k),
        diff = D.diff(t, d);
      h += `<div class="lg-h${diff === 0 ? " today" : ""}">${diff === 0 ? "Сьогодні · " : diff === 1 ? "Завтра · " : ""}${cap(D.long(d))}</div>`;
      for (const o of items) {
        const ev = o.ev,
          cat = catOf(ev.category_id);
        h += `<button class="li" data-k="${esc(o.key)}" style="${colorVars(colorOf(ev))}"><span class="li-bar"></span><span class="li-time">${allDayish(o) ? "весь<small>день</small>" : D.t(ev.start_time) + (ev.end_time ? `<small>${D.t(ev.end_time)}</small>` : "")}</span><span class="li-main"><b>${hl(ev.title)}</b><small>${[cat ? esc(cat.name) : "", ev.location ? hl(ev.location) : ""].filter(Boolean).join(" · ")}</small></span></button>`;
        count++;
      }
      if (count > 400) break;
    }
    L.innerHTML = `<div class="list-inner">${h || `<div class="empty">${icon(q ? "search" : "cal")}${q ? "Нічого не знайдено" : "Найближчим часом подій немає"}</div>`}</div>`;
  }

  /* ================= Картка події ================= */
  function openByKey(key) {
    const i = key.lastIndexOf("@");
    const ev = events.find((e) => e.id === key.slice(0, i));
    if (ev) openEvent(ev, key.slice(i + 1));
  }
  function openEvent(ev, occ) {
    const d = D.parse(occ),
      cat = catOf(ev.category_id);
    const span = ev.end_date ? Math.max(0, D.diff(D.parse(ev.date), D.parse(ev.end_date))) : 0;
    const end = D.add(d, span);
    const dateLine = span ? `${D.short(d)} – ${D.short(end)} ${end.getFullYear()}` : cap(D.long(d));
    const rep =
      ev.repeat && ev.repeat !== "none"
        ? REPEAT[ev.repeat] +
          (ev.repeat_until ? " до " + D.short(D.parse(ev.repeat_until)) + " " + ev.repeat_until.slice(0, 4) : "")
        : "";
    const maps = ev.location
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location + ", Черкаси")}`
      : "";
    const html = `<div style="${colorVars(colorOf(ev))}">
      ${cat ? `<div class="ev-cat">${esc(cat.name)}</div>` : ""}
      <h2 class="ev-title">${esc(ev.title)}</h2>
      <div class="group">
        <div class="row">${icon("cal")}<div>${dateLine}${span ? `<small>${span + 1} ${plural(span + 1, ["день", "дні", "днів"])}</small>` : ""}</div></div>
        <div class="row">${icon("clock")}<div>${timeRange(ev)}</div></div>
        ${rep ? `<div class="row">${icon("repeat")}<div>${rep}</div></div>` : ""}
        ${ev.location ? `<div class="row">${icon("pin")}<div><a href="${maps}" target="_blank" rel="noopener">${esc(ev.location)}</a></div></div>` : ""}
      </div>
      ${ev.description ? `<div class="sub-h">Опис</div><div class="group"><p class="ev-desc">${esc(ev.description)}</p></div>` : ""}
      <div class="actions">
        <button class="cc-btn" data-a="ics">${icon("calPlus")}До календаря</button>
        <button class="cc-btn" data-a="share">${icon("share")}Поділитися</button>
      </div></div>`;
    const base = location.hash.split("?")[0];
    history.replaceState(null, "", (base || hashOf(S.view, S.focus)) + "?ev=" + encodeURIComponent(ev.id));
    openSheet(
      html,
      (r) => {
        r.querySelector("[data-a=ics]").addEventListener("click", () => {
          const blob = new Blob([icsFor(ev, d)], { type: "text/calendar;charset=utf-8" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = (ev.title || "event").replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40) + ".ics";
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            URL.revokeObjectURL(a.href);
            a.remove();
          }, 1000);
        });
        r.querySelector("[data-a=share]").addEventListener("click", async () => {
          const url = location.href.split("#")[0] + "#/day/" + occ + "?ev=" + encodeURIComponent(ev.id);
          const text = `${ev.title} — ${dateLine}, ${timeRange(ev)}`;
          try {
            if (navigator.share) return void (await navigator.share({ title: ev.title, text, url }));
            await navigator.clipboard.writeText(text + "\n" + url);
            toast("Посилання скопійовано");
          } catch {
            /* користувач скасував */
          }
        });
      },
      () => history.replaceState(null, "", location.hash.split("?")[0]),
    );
  }

  /* ================= Категорії ================= */
  function openCategories() {
    const counts = {};
    events.forEach((e) => {
      const k = e.category_id || "none";
      counts[k] = (counts[k] || 0) + 1;
    });
    const used = cats.filter((c) => counts[c.id]);
    const rows = used
      .map(
        (c) =>
          `<button class="cat-row${S.hidden.has(c.id) ? "" : " on"}" data-id="${esc(c.id)}" style="${colorVars(c.color)}"><span class="cat-check">${icon("check")}</span><span>${esc(c.name)}</span><span class="cat-count">${counts[c.id]}</span></button>`,
      )
      .join("");
    const th = Theme.get();
    openSheet(
      `<h3 class="sheet-h">Категорії</h3>
      <div class="group" data-cats>${rows || '<div class="row">Подій ще немає</div>'}</div>
      ${used.length ? '<div class="actions"><button class="cc-btn" data-a="all">Показати всі</button><button class="cc-btn" data-a="none">Сховати всі</button></div>' : ""}
      <div class="sub-h">Тема</div>
      <div class="seg" data-theme-seg><button data-t="auto" class="${th === "auto" ? "on" : ""}">Авто</button><button data-t="light" class="${th === "light" ? "on" : ""}">Світла</button><button data-t="dark" class="${th === "dark" ? "on" : ""}">Темна</button></div>`,
      (r) => {
        const setAll = (hide) => {
          used.forEach((c) => (hide ? S.hidden.add(c.id) : S.hidden.delete(c.id)));
          r.querySelectorAll(".cat-row").forEach((x) => x.classList.toggle("on", !hide));
          saveHidden();
        };
        r.querySelector("[data-cats]").addEventListener("click", (e) => {
          const row = e.target.closest(".cat-row");
          if (!row) return;
          const id = row.dataset.id;
          if (S.hidden.has(id)) S.hidden.delete(id);
          else S.hidden.add(id);
          row.classList.toggle("on", !S.hidden.has(id));
          saveHidden();
        });
        r.querySelector("[data-a=all]")?.addEventListener("click", () => setAll(false));
        r.querySelector("[data-a=none]")?.addEventListener("click", () => setAll(true));
        r.querySelector("[data-theme-seg]").addEventListener("click", (e) => {
          const b = e.target.closest("[data-t]");
          if (!b) return;
          Theme.set(b.dataset.t);
          r.querySelectorAll("[data-theme-seg] button").forEach((x) => x.classList.toggle("on", x === b));
          updateChrome();
        });
      },
    );
  }
  function saveHidden() {
    LS.set("cc_hidden", [...S.hidden]);
    refresh();
  }
  function refresh() {
    computeOcc();
    const L = stage.querySelector(".layer.active");
    if (!L) return;
    if (S.view === "day") return renderDay(L);
    if (S.view === "list") return fillList(L);
    if (S.view === "month") {
      L.querySelectorAll(".month").forEach((sec) => {
        const [y, m] = sec.dataset.m.split("-").map(Number);
        sec.replaceWith(monthBlock(new Date(y, m - 1, 1)));
      });
      return;
    }
    const st = L.scrollTop,
      nl = buildYear();
    nl.classList.add("layer", "active");
    L.replaceWith(nl);
    nl.scrollTop = st;
  }

  /* ================= Шапка ================= */
  function updateChrome() {
    const v = S.view;
    let backText = "",
      title = "";
    if (v === "month") {
      const tm = S.topMonth || S.focus;
      backText = String(tm.getFullYear());
      title = M[tm.getMonth()];
    } else if (v === "day") backText = M[S.focus.getMonth()];
    else if (v === "list") title = S.q ? "Пошук" : "Найближчі події";
    $(".back").hidden = !backText;
    $(".back-label").textContent = backText;
    $(".brand").style.display = backText ? "none" : "";
    $(".brand-title").textContent = v === "list" && !isWide() ? title : "Календар подій";
    $(".nav-title").textContent = v === "list" ? "" : title;
    $(".nav").classList.toggle("line", v !== "month" && v !== "day");
    root.querySelectorAll(".seg-views button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
    $("[data-act=list]").textContent = v === "list" ? "Календар" : "Список";
    $("[data-act=theme]").innerHTML = icon(Theme.isDark() ? "sun" : "moon");
  }

  /* ================= Зум: щипок, трекпад, клавіші ================= */
  function zoomOut(origin) {
    if (S.view === "day") go("month", S.focus, origin);
    else if (S.view === "month") {
      const tm = S.topMonth || S.focus;
      const d =
        S.focus.getFullYear() === tm.getFullYear() && Math.abs(S.focus.getMonth() - tm.getMonth()) <= 1 ? S.focus : tm;
      go("year", d, null);
    } else if (S.view === "list") go("month", S.focus);
  }
  function zoomIn(pt) {
    const hit = pt ? document.elementFromPoint(pt.cx, pt.cy) : null;
    if (S.view === "year") {
      const mini = hit && hit.closest(".mini");
      if (mini) return void mini.click();
      go("month", S.focus, null);
    } else if (S.view === "month") {
      const c = hit && hit.closest(".day[data-d]");
      if (c) return void c.click();
      go("day", S.focus, null);
    } else if (S.view === "list") go("day", S.focus);
  }
  let zoomLock = 0;
  function zoom(dir, pt) {
    const now = Date.now();
    if (now - zoomLock < 650) return;
    zoomLock = now;
    if (dir < 0) zoomOut(pt ? { x: pt.x, y: pt.y } : null);
    else zoomIn(pt);
  }
  const ptFromClient = (cx, cy) => {
    const s = stage.getBoundingClientRect();
    return { cx, cy, x: cx - s.left, y: cy - s.top };
  };
  {
    let pinch = null;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    stage.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 2)
          pinch = {
            d: dist(e.touches),
            fired: false,
            cx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
            cy: (e.touches[0].clientY + e.touches[1].clientY) / 2,
          };
      },
      { passive: true },
    );
    stage.addEventListener(
      "touchmove",
      (e) => {
        if (!pinch || e.touches.length !== 2) return;
        e.preventDefault();
        if (pinch.fired) return;
        const r = dist(e.touches) / pinch.d;
        if (r < 0.72) {
          pinch.fired = true;
          zoom(-1, ptFromClient(pinch.cx, pinch.cy));
        } else if (r > 1.38) {
          pinch.fired = true;
          zoom(1, ptFromClient(pinch.cx, pinch.cy));
        }
      },
      { passive: false },
    );
    stage.addEventListener(
      "touchend",
      (e) => {
        if (e.touches.length < 2) pinch = null;
      },
      { passive: true },
    );
    let acc = 0,
      wt;
    stage.addEventListener(
      "wheel",
      (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        acc += e.deltaY;
        clearTimeout(wt);
        wt = setTimeout(() => (acc = 0), 200);
        if (acc > 35) {
          acc = 0;
          zoom(-1, ptFromClient(e.clientX, e.clientY));
        } else if (acc < -35) {
          acc = 0;
          zoom(1, ptFromClient(e.clientX, e.clientY));
        }
      },
      { passive: false },
    );
    let gScale = 1,
      gPt = null;
    stage.addEventListener("gesturestart", (e) => {
      e.preventDefault();
      gScale = 1;
      gPt = ptFromClient(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2);
    });
    stage.addEventListener("gesturechange", (e) => {
      e.preventDefault();
      gScale = e.scale;
    });
    stage.addEventListener("gestureend", (e) => {
      e.preventDefault();
      if (gScale < 0.8) zoom(-1, gPt);
      else if (gScale > 1.25) zoom(1, gPt);
    });
  }
  root.addEventListener("keydown", (e) => {
    if (
      root.classList.contains("sheet-open") ||
      e.target.matches("input,textarea,select") ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey
    )
      return;
    if (e.key === "-" || e.key === "_") zoom(-1);
    else if (e.key === "+" || e.key === "=") zoom(1);
    else if (S.view === "day" && (e.key === "ArrowLeft" || e.key === "ArrowRight"))
      setDay(stage.querySelector(".layer.active"), D.add(S.focus, e.key === "ArrowLeft" ? -1 : 1));
  });

  /* ================= Кнопки ================= */
  function goToday() {
    const t = D.today(),
      L = stage.querySelector(".layer.active");
    if (S.view === "day") return setDay(L, t);
    S.focus = t;
    if (S.view === "year") return scrollYearTo(L, t, true);
    if (S.view === "list") return L.scrollTo({ top: 0, behavior: "smooth" });
    L.querySelectorAll(".day.sel").forEach((n) => n.classList.remove("sel"));
    L.querySelector(`.day[data-d="${D.ymd(t)}"]`)?.classList.add("sel");
    scrollMonthTo(L, t, true);
  }
  const sInput = $(".search-input");
  function endSearch() {
    root.classList.remove("searching");
    const had = S.q;
    S.q = "";
    sInput.value = "";
    if (S.beforeSearch) {
      const b = S.beforeSearch;
      S.beforeSearch = null;
      go(b.view, b.d);
    } else if (had) fillList(stage.querySelector(".layer.active"));
    updateChrome();
  }
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act], .back, .seg-views [data-v]");
    if (!b || !root.contains(b) || b.closest(".sheet")) return;
    if (b.classList.contains("back")) return zoomOut();
    if (b.dataset.v) {
      if (b.dataset.v === "month" && S.view === "year") return go("month", S.focus, null);
      return go(b.dataset.v, S.focus);
    }
    const a = b.dataset.act;
    if (a === "today") goToday();
    else if (a === "cats") openCategories();
    else if (a === "list") S.view === "list" ? go("month", S.focus) : go("list", S.focus);
    else if (a === "theme") {
      Theme.toggle();
      updateChrome();
    } else if (a === "search") {
      if (root.classList.contains("searching")) return endSearch();
      root.classList.add("searching");
      sInput.focus();
    } else if (a === "search-cancel") endSearch();
  });
  let sT;
  sInput.addEventListener("input", () => {
    clearTimeout(sT);
    sT = setTimeout(() => {
      S.q = sInput.value.trim();
      if (S.q && S.view !== "list") {
        S.beforeSearch = { view: S.view, d: S.focus };
        go("list", S.focus);
      } else if (S.view === "list") fillList(stage.querySelector(".layer.active"));
      updateChrome();
    }, 140);
  });
  root.querySelectorAll("[data-icon]").forEach((n) => (n.innerHTML = icon(n.dataset.icon)));

  let rT;
  new ResizeObserver(() => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      const w = isWide();
      if (w === S.wide || !S.view) return updateChrome();
      S.wide = w;
      const v = S.view;
      S.view = null;
      show(v, S.focus);
    }, 200);
  }).observe(root);
  setInterval(() => {
    if (S.view !== "day") return;
    const L = stage.querySelector(".layer.active"),
      sc = L && L.querySelector(".tl-scroll"),
      st = sc ? sc.scrollTop : 0;
    renderDay(L);
    if (sc) sc.scrollTop = st;
  }, 60000);

  /* ================= Старт ================= */
  try {
    ({ events, categories: cats } = await calendarApi.loadAll());
  } catch (err) {
    stage.innerHTML = `<div class="loading"><div class="side-empty">Не вдалося завантажити календар.<br><small>${esc(err.message || err)}</small></div></div>`;
    return;
  }
  computeOcc();
  if (!/^#\/(year|month|day|list)/.test(location.hash)) history.replaceState(null, "", hashOf("month", D.today()));
  route();
}
