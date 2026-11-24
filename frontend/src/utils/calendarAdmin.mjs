// Адмінка календаря подій (/calendar/admin): вхід через Supabase, місячна сітка,
// події вибраного дня, форма події, категорії з кольорами.

import { calendarApi as api } from "./calendarApi.mjs";
import {
  D,
  M,
  WD,
  REPEAT,
  LS,
  allDayish,
  cap,
  colorVars,
  createOverlay,
  esc,
  expand,
  icon,
  plural,
  rgb,
} from "./eventCalendar.mjs";

const PRESETS = [
  "#FF3B30",
  "#FF9500",
  "#FFCC00",
  "#34C759",
  "#00C7BE",
  "#32ADE6",
  "#007AFF",
  "#5856D6",
  "#AF52DE",
  "#FF2D55",
  "#A2845E",
  "#8E8E93",
];

export function initCalendarAdmin(root) {
  const { openSheet, closeSheet, toast } = createOverlay(root);
  const t0 = D.today();
  const A = { month: new Date(t0.getFullYear(), t0.getMonth(), 1), sel: t0, edit: null, occ: null };
  let events = [],
    cats = [];
  const catOf = (id) => cats.find((c) => c.id === id);
  const colorOf = (ev) => ev.color || (catOf(ev.category_id) || {}).color || "#8E8E93";
  const isNarrow = () => innerWidth < 1000;
  const err = (e) => toast("Помилка: " + (e.message || e));

  const isDark = () => {
    const t = LS.get("cc_theme", "light");
    return t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  };
  const applyTheme = () => (root.dataset.theme = isDark() ? "dark" : "light");
  applyTheme();

  // Шторка й тост живуть усередині кореня, тому рендеримо в окремий контейнер
  const view = document.createElement("div");
  root.prepend(view);
  root.querySelector(":scope > .login")?.remove();

  /* ---------- Вхід ---------- */
  function showLogin(msg) {
    view.innerHTML = `<div class="login"><div class="login-card">
      <div class="login-icon">${icon("lock")}</div>
      <h2>Адмінка календаря</h2>
      <p>Вхід для адміністраторів сайту</p>
      <form data-login>
        <input class="field" type="email" name="email" placeholder="Email" autocomplete="username" required>
        <input class="field" type="password" name="password" placeholder="Пароль" autocomplete="current-password" required>
        <div class="err">${msg ? esc(msg) : ""}</div>
        <button class="cc-btn primary" type="submit">Увійти</button>
      </form>
      <p class="note"><a href="/calendar">← До календаря</a></p>
    </div></div>`;
    const f = view.querySelector("[data-login]");
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = f.querySelector("button");
      btn.disabled = true;
      btn.textContent = "Вхід…";
      try {
        await api.signIn(f.email.value.trim(), f.password.value);
        await enter();
      } catch (x) {
        f.querySelector(".err").textContent = /invalid/i.test(x.message) ? "Невірний email або пароль" : x.message;
        btn.disabled = false;
        btn.textContent = "Увійти";
      }
    });
  }

  async function enter() {
    if (!(await api.isAdmin())) {
      view.innerHTML = `<div class="login"><div class="login-card"><h2>Немає доступу</h2><p>Акаунт ${esc(api.email)} не має прав редагувати календар.</p><button class="cc-btn" data-out>Вийти</button></div></div>`;
      view.querySelector("[data-out]").onclick = async () => {
        await api.signOut();
        showLogin();
      };
      return;
    }
    ({ events, categories: cats } = await api.loadAll());
    showAdmin();
  }

  /* ---------- Головний екран ---------- */
  function showAdmin() {
    view.innerHTML = `
      <header class="a-head">
        <div class="a-brand"><span class="dot">${icon("cal")}</span><span class="txt">Календар <small style="color:var(--text2);font-weight:500">· адмінка</small></span></div>
        <div class="a-actions">
          <a class="a-btn" href="/calendar">${icon("eye")}<span>Календар</span></a>
          <button class="a-btn" data-a="cats">${icon("palette")}<span>Категорії</span></button>
          <button class="a-btn" data-a="theme"></button>
          <button class="a-btn" data-a="out" title="${esc(api.email)}">${icon("out")}<span>Вийти</span></button>
        </div>
      </header>
      <div class="a-main">
        <section class="a-card">
          <div class="a-cal-head">
            <h2 data-title></h2>
            <button class="a-btn keep" data-a="today">Сьогодні</button>
            <button class="round" data-a="prev" aria-label="Попередній місяць">${icon("chevL")}</button>
            <button class="round" data-a="next" aria-label="Наступний місяць">${icon("chevR")}</button>
          </div>
          <div class="a-wd">${WD.map((w) => `<div>${w}</div>`).join("")}</div>
          <div class="a-grid" data-grid></div>
          <p class="note" style="text-align:left;margin:12px 4px 0">Клік — вибрати день · подвійний клік — одразу нова подія</p>
        </section>
        <aside class="a-card a-panel" data-panel></aside>
      </div>`;
    view.querySelector(".a-head").addEventListener("click", async (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "cats") openCats();
      else if (a === "theme") {
        LS.set("cc_theme", isDark() ? "light" : "dark");
        applyTheme();
        setThemeIcon();
      } else if (a === "out") {
        await api.signOut();
        showLogin();
      }
    });
    view.querySelector(".a-cal-head").addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "prev") A.month = new Date(A.month.getFullYear(), A.month.getMonth() - 1, 1);
      else if (a === "next") A.month = new Date(A.month.getFullYear(), A.month.getMonth() + 1, 1);
      else if (a === "today") return selectDay(D.today());
      else return;
      renderGrid();
    });
    const grid = view.querySelector("[data-grid]");
    grid.addEventListener("click", (e) => {
      const c = e.target.closest(".a-day");
      if (c) selectDay(D.parse(c.dataset.d), true);
    });
    grid.addEventListener("dblclick", (e) => {
      const c = e.target.closest(".a-day");
      if (!c) return;
      selectDay(D.parse(c.dataset.d));
      openForm(null);
    });
    setThemeIcon();
    renderGrid();
    renderPanel();
  }
  function setThemeIcon() {
    const b = view.querySelector('[data-a="theme"]');
    if (b) b.innerHTML = icon(isDark() ? "sun" : "moon") + `<span>${isDark() ? "Світла" : "Темна"}</span>`;
  }

  function renderGrid() {
    const y = A.month.getFullYear(),
      m = A.month.getMonth();
    const start = D.startOfWeek(new Date(y, m, 1));
    const end = D.add(D.startOfWeek(new Date(y, m, D.daysIn(y, m))), 6);
    const occ = expand(events, start, end);
    const t = D.today();
    let h = "";
    for (let d = start; d <= end; d = D.add(d, 1)) {
      const list = occ[D.ymd(d)] || [];
      const tint = list.find((o) => o.ev.tint_day);
      let cls = "a-day";
      if (d.getMonth() !== m) cls += " out";
      if (D.same(d, t)) cls += " today";
      if (D.same(d, A.sel)) cls += " sel";
      if (tint) cls += " tint";
      const shown = list.length > 3 ? list.slice(0, 2) : list;
      h += `<button class="${cls}" data-d="${D.ymd(d)}"${tint ? ` style="--trgb:${rgb(colorOf(tint.ev)).join(",")}"` : ""}><span class="n">${d.getDate()}</span>${
        list.length
          ? `<div class="chips">${shown.map((o) => `<span class="chip${allDayish(o) ? " solid" : ""}" style="${colorVars(colorOf(o.ev))}">${esc(o.ev.title)}</span>`).join("")}${list.length > shown.length ? `<span class="more">+${list.length - shown.length}</span>` : ""}</div>`
          : ""
      }</button>`;
    }
    view.querySelector("[data-grid]").innerHTML = h;
    view.querySelector("[data-title]").innerHTML = `${M[m]} <span>${y}</span>`;
  }

  function selectDay(d, scroll) {
    A.sel = d;
    A.month = new Date(d.getFullYear(), d.getMonth(), 1);
    A.edit = null;
    A.occ = null;
    renderGrid();
    renderPanel();
    if (scroll && isNarrow()) view.querySelector("[data-panel]").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderPanel() {
    const list = expand(events, A.sel, A.sel)[D.ymd(A.sel)] || [];
    const cnt = list.length ? list.length + " " + plural(list.length, ["подія", "події", "подій"]) : "Подій немає";
    let h = `<div class="a-day-head"><h3>${cap(D.long(A.sel))}<small>${cnt}</small></h3><button class="cc-btn primary" data-add>${icon("plus")}Додати</button></div>`;
    h += list.length
      ? list
          .map((o) => {
            const ev = o.ev,
              cat = catOf(ev.category_id);
            return `<button class="a-ev${A.edit && A.edit.id === ev.id ? " on" : ""}" data-id="${esc(ev.id)}" data-occ="${o.occ}" style="${colorVars(colorOf(ev))}">
          <span class="t">${allDayish(o) ? "весь<small>день</small>" : D.t(ev.start_time) + (ev.end_time ? `<small>${D.t(ev.end_time)}</small>` : "")}</span>
          <span class="m"><b>${esc(ev.title)}</b><small>${cat ? esc(cat.name) : "Без категорії"}${ev.repeat && ev.repeat !== "none" ? " · " + icon("repeat") + REPEAT[ev.repeat] : ""}${ev.location ? " · " + esc(ev.location) : ""}</small></span></button>`;
          })
          .join("")
      : `<div class="a-empty">На цей день ще нічого не заплановано.<br>Натисніть «Додати».</div>`;
    h += "<div data-form></div>";
    const p = view.querySelector("[data-panel]");
    p.innerHTML = h;
    p.querySelector("[data-add]").onclick = () => openForm(null);
    p.querySelectorAll(".a-ev").forEach((b) => {
      b.onclick = () => {
        const ev = events.find((e) => e.id === b.dataset.id);
        if (ev) openForm(ev, b.dataset.occ);
      };
    });
    if (A.edit) renderForm();
  }

  /* ---------- Форма події ---------- */
  function openForm(ev, occ) {
    const last = LS.get("cc_last_cat", null);
    A.edit = ev
      ? structuredClone(ev)
      : {
          id: null,
          title: "",
          date: D.ymd(A.sel),
          end_date: null,
          all_day: false,
          start_time: "18:00",
          end_time: "20:00",
          category_id: last && catOf(last) ? last : (cats[0] || {}).id || null,
          color: null,
          tint_day: false,
          repeat: "none",
          repeat_until: null,
          location: "",
          description: "",
          exdates: [],
        };
    A.occ = occ || null;
    renderPanel();
    const host = view.querySelector("[data-form]");
    if (isNarrow()) host.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!ev) setTimeout(() => host.querySelector("[name=title]")?.focus({ preventScroll: true }), 120);
  }

  function renderForm() {
    const e = A.edit;
    const host = view.querySelector("[data-form]");
    host.innerHTML = `<form class="a-form" novalidate>
      <div class="form-h">${e.id ? "Редагувати подію" : "Нова подія"}</div>
      ${e.id && e.repeat && e.repeat !== "none" ? '<p class="note" style="text-align:left;margin:-6px 2px 0">Подія повторюється: зміни застосуються до всієї серії. Дата нижче — початок серії.</p>' : ""}
      <div><label class="lbl">Назва</label><input class="field" name="title" placeholder="Напр.: Вечір хвали" maxlength="200"></div>
      <div><label class="lbl">Категорія</label><div class="cat-pick" data-cats>${cats.map((c) => `<button type="button" data-id="${esc(c.id)}" class="${c.id === e.category_id ? "on" : ""}" style="${colorVars(c.color)}">${esc(c.name)}</button>`).join("")}</div></div>
      <div class="two"><div><label class="lbl">Дата</label><input class="field" type="date" name="date"></div><div><label class="lbl">Кінцева дата</label><input class="field" type="date" name="end_date" title="Для подій на кілька днів"></div></div>
      <label class="switch"><span>Весь день</span><input type="checkbox" class="tg" name="all_day"></label>
      <div class="two" data-times><div><label class="lbl">Початок</label><input class="field" type="time" name="start_time"></div><div><label class="lbl">Кінець</label><input class="field" type="time" name="end_time"></div></div>
      <div class="two"><div><label class="lbl">Повтор</label><select class="field" name="repeat">${Object.entries(
        REPEAT,
      )
        .map(([k, v]) => `<option value="${k}">${v}</option>`)
        .join(
          "",
        )}</select></div><div data-until><label class="lbl">Повторювати до</label><input class="field" type="date" name="repeat_until"></div></div>
      <div><label class="lbl">Місце</label><input class="field" name="location" placeholder="Головний зал" maxlength="160"></div>
      <div><label class="lbl">Опис</label><textarea class="field" name="description" rows="3" placeholder="Деталі для відвідувачів"></textarea></div>
      <div><label class="lbl">Колір події</label><div class="swatches" data-sw>
        <button type="button" class="sw-auto" data-c="">За категорією</button>
        ${PRESETS.map((c) => `<button type="button" class="sw" data-c="${c}" style="--c:${c}" aria-label="${c}"></button>`).join("")}
        <label class="sw-custom" title="Свій колір"><input type="color" data-custom></label></div></div>
      <label class="switch"><span>Підсвітити клітинку дня<small>Фон дня в календарі стане кольором події — для свят і особливих подій</small></span><input type="checkbox" class="tg" name="tint_day"></label>
      <div class="form-actions">
        <button class="cc-btn primary" type="submit">${icon("check")}Зберегти</button>
        <button class="cc-btn ghost" type="button" data-cancel>Скасувати</button>
        ${e.id ? `<button class="cc-btn danger" type="button" data-del>${icon("trash")}Видалити</button>` : ""}
      </div></form>`;
    const f = host.querySelector("form");
    for (const n of [
      "title",
      "date",
      "end_date",
      "start_time",
      "end_time",
      "repeat",
      "repeat_until",
      "location",
      "description",
    ])
      f.elements[n].value = e[n] == null ? "" : e[n];
    f.elements.all_day.checked = !!e.all_day;
    f.elements.tint_day.checked = !!e.tint_day;
    const sync = () => {
      host.querySelector("[data-times]").classList.toggle("hidden", f.elements.all_day.checked);
      host.querySelector("[data-until]").style.visibility = f.elements.repeat.value === "none" ? "hidden" : "visible";
      host
        .querySelectorAll("[data-sw] [data-c]")
        .forEach((b) => b.classList.toggle("on", (b.dataset.c || null) === (e.color || null)));
      const custom = e.color && !PRESETS.includes(e.color);
      const sc = host.querySelector(".sw-custom");
      sc.classList.toggle("on", !!custom);
      sc.style.background = custom ? e.color : "";
    };
    sync();
    f.elements.all_day.onchange = sync;
    f.elements.repeat.onchange = sync;
    host.querySelector("[data-cats]").addEventListener("click", (ev) => {
      const b = ev.target.closest("button[data-id]");
      if (!b) return;
      e.category_id = b.dataset.id;
      host.querySelectorAll("[data-cats] button").forEach((x) => x.classList.toggle("on", x === b));
    });
    host.querySelector("[data-sw]").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-c]");
      if (!b) return;
      e.color = b.dataset.c || null;
      sync();
    });
    const cc = host.querySelector("[data-custom]");
    cc.value = e.color || "#007AFF";
    cc.addEventListener("input", () => {
      e.color = cc.value.toUpperCase();
      sync();
    });
    host.querySelector("[data-cancel]").onclick = () => {
      A.edit = null;
      renderPanel();
    };
    host.querySelector("[data-del]")?.addEventListener("click", () => askDelete(e));
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const v = (n) => f.elements[n].value.trim();
      const row = {
        ...e,
        title: v("title"),
        date: v("date"),
        end_date: v("end_date") || null,
        all_day: f.elements.all_day.checked,
        start_time: v("start_time") || null,
        end_time: v("end_time") || null,
        repeat: v("repeat"),
        repeat_until: v("repeat_until") || null,
        location: v("location") || null,
        description: v("description") || null,
        tint_day: f.elements.tint_day.checked,
      };
      if (!row.title) {
        f.elements.title.focus();
        return toast("Вкажіть назву");
      }
      if (!row.date) return toast("Вкажіть дату");
      if (!row.all_day && !row.start_time) row.all_day = true;
      if (row.all_day) row.start_time = row.end_time = null;
      if (row.start_time && row.end_time && row.end_time <= row.start_time) row.end_time = null;
      if (row.end_date && row.end_date <= row.date) row.end_date = null;
      if (row.repeat === "none") row.repeat_until = null;
      if (!row.id) delete row.id;
      const btn = f.querySelector("[type=submit]");
      btn.disabled = true;
      try {
        const saved = await api.saveEvent(row);
        const i = events.findIndex((x) => x.id === saved.id);
        if (i >= 0) events[i] = saved;
        else events.push(saved);
        if (saved.category_id) LS.set("cc_last_cat", saved.category_id);
        A.edit = null;
        const d = D.parse(saved.date);
        if (!A.occ && !D.same(d, A.sel)) return (selectDay(d), toast("Збережено"));
        renderGrid();
        renderPanel();
        toast("Збережено");
      } catch (x) {
        err(x);
        btn.disabled = false;
      }
    });
  }

  function askDelete(e) {
    const orig = events.find((x) => x.id === e.id);
    if (!orig) return;
    const recurring = orig.repeat && orig.repeat !== "none" && A.occ;
    const done = () => {
      closeSheet();
      A.edit = null;
      renderGrid();
      renderPanel();
      toast("Видалено");
    };
    openSheet(
      `<h3 class="sheet-h">Видалити подію?</h3>
      <div class="group"><div class="row">${icon("cal")}<div><b>${esc(orig.title)}</b><small>${recurring ? REPEAT[orig.repeat] : cap(D.long(D.parse(orig.date)))}</small></div></div></div>
      <div class="choice">
        ${recurring ? `<button class="cc-btn danger" data-a="one">Видалити лише ${D.short(D.parse(A.occ))}</button>` : ""}
        <button class="cc-btn danger" data-a="all">${recurring ? "Видалити всю серію" : "Видалити"}</button>
        <button class="cc-btn ghost" data-a="no">Скасувати</button>
      </div>`,
      (r) => {
        r.querySelector("[data-a=no]").onclick = closeSheet;
        r.querySelector("[data-a=all]").onclick = async () => {
          try {
            await api.deleteEvent(orig.id);
            events = events.filter((x) => x.id !== orig.id);
            done();
          } catch (x) {
            err(x);
          }
        };
        const one = r.querySelector("[data-a=one]");
        if (one)
          one.onclick = async () => {
            try {
              const saved = await api.saveEvent({ ...orig, exdates: [...(orig.exdates || []), A.occ] });
              events = events.map((x) => (x.id === saved.id ? saved : x));
              done();
            } catch (x) {
              err(x);
            }
          };
      },
    );
  }

  /* ---------- Категорії ---------- */
  function openCats() {
    const draw = (r) => {
      r.querySelector("[data-rows]").innerHTML =
        cats
          .map(
            (c) => `<div class="cat-edit" data-id="${esc(c.id)}">
          <label class="clr" style="--c:${esc(c.color)}"><input type="color" value="${esc(c.color)}"></label>
          <input class="field" value="${esc(c.name)}" maxlength="40">
          <button class="del" aria-label="Видалити">${icon("trash")}</button></div>`,
          )
          .join("") || '<div class="row">Категорій ще немає</div>';
    };
    openSheet(
      `<h3 class="sheet-h">Категорії</h3>
      <div class="group" data-rows></div>
      <div class="actions" style="grid-template-columns:1fr"><button class="cc-btn" data-new>${icon("plus")}Нова категорія</button></div>
      <p class="note">Колір категорії — колір її подій у календарі. Зміни зберігаються одразу.</p>`,
      (r) => {
        draw(r);
        const rows = r.querySelector("[data-rows]");
        rows.addEventListener("input", (e) => {
          if (e.target.type === "color") e.target.closest(".clr").style.setProperty("--c", e.target.value);
        });
        rows.addEventListener("change", async (e) => {
          const row = e.target.closest(".cat-edit"),
            c = row && catOf(row.dataset.id);
          if (!c) return;
          const next = {
            ...c,
            color: row.querySelector("input[type=color]").value.toUpperCase(),
            name: row.querySelector(".field").value.trim() || c.name,
          };
          try {
            const saved = await api.saveCategory(next);
            cats = cats.map((x) => (x.id === saved.id ? saved : x));
          } catch (x) {
            err(x);
          }
        });
        rows.addEventListener("click", async (e) => {
          const b = e.target.closest(".del");
          if (!b) return;
          const c = catOf(b.closest(".cat-edit").dataset.id);
          const n = events.filter((x) => x.category_id === c.id).length;
          if (!b.dataset.armed) {
            b.dataset.armed = "1";
            b.classList.add("armed");
            b.textContent = "Точно?";
            b.title = n
              ? `${n} ${plural(n, ["подія залишиться", "події залишаться", "подій залишаться"])} без категорії`
              : "";
            setTimeout(() => {
              if (!b.isConnected) return;
              delete b.dataset.armed;
              b.classList.remove("armed");
              b.innerHTML = icon("trash");
            }, 3000);
            return;
          }
          try {
            await api.deleteCategory(c.id);
            cats = cats.filter((x) => x.id !== c.id);
            events.forEach((x) => {
              if (x.category_id === c.id) x.category_id = null;
            });
            draw(r);
          } catch (x) {
            err(x);
          }
        });
        r.querySelector("[data-new]").onclick = async () => {
          const used = new Set(cats.map((c) => c.color));
          const color = PRESETS.find((c) => !used.has(c)) || PRESETS[cats.length % PRESETS.length];
          try {
            cats.push(
              await api.saveCategory({ id: crypto.randomUUID(), name: "Нова категорія", color, sort: cats.length + 1 }),
            );
            draw(r);
            const inp = rows.querySelector(".cat-edit:last-child .field");
            inp?.focus();
            inp?.select();
          } catch (x) {
            err(x);
          }
        };
      },
      () => {
        renderGrid();
        renderPanel();
      },
    );
  }

  root.addEventListener("keydown", (e) => {
    if (
      root.classList.contains("sheet-open") ||
      e.target.matches("input,textarea,select") ||
      !view.querySelector("[data-grid]")
    )
      return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) {
      e.preventDefault();
      selectDay(D.add(A.sel, step));
    }
  });

  (async () => {
    try {
      if (api.signedIn) await enter();
      else showLogin();
    } catch (x) {
      showLogin(x.message);
    }
  })();
}
