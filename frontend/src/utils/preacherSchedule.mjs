import { api } from './grafikApi.mjs'

// Графік проповідей (/grafik) і його адмінка (/grafik/admin).
// Дані в Supabase: проповідники, налаштування (примітка + тижневий шаблон)
// і місяці. Місяць = { services: [{id, day, time, kind, label?, bb?}], a: {serviceId: {preacherId: номер}} }.
// Якщо місяць ще не збережено, служіння беруться з тижневого шаблону.

const MN = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень']
const MG = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня']
const MS = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру']
const DS = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const DF = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота']
const DEF = {
  note: 'Перша проповідь 10–15 хв. максимум. Заклик помолитися у групах.',
  weekly: [
    { dow: 3, time: '10:00', kind: 'preach' },
    { dow: 6, time: '17:00', kind: 'study' },
    { dow: 0, time: '11:00', kind: 'preach' },
  ],
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const clone = (o) => JSON.parse(JSON.stringify(o))
const ls = {
  get(k) {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* немає сховища — не страшно */
    }
  },
}
const SUN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
const MOON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></svg>'

export function initPreacherSchedule(root) {
  const ADMIN_PAGE = root.dataset.admin === 'true'
  const $ = (sel) => root.querySelector(sel)
  const out = $('#pg-out')
  const tip = $('#pg-tip')
  const pop = $('#pg-pop')
  const toastEl = $('#pg-toast')
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const S = {
    preachers: [],
    settings: null,
    months: {},
    y: now.getFullYear(),
    m: now.getMonth(),
    view: ADMIN_PAGE ? 'admin' : ls.get('pg-view') || (innerWidth < 700 ? 'dates' : 'table'),
    hl: '',
    open: '',
    loaded: false,
    err: '',
    admin: false,
    authChecked: !ADMIN_PAGE,
  }

  const K = (y = S.y, m = S.m) => `${y}-${String(m + 1).padStart(2, '0')}`
  const set = () => S.settings || DEF
  const pname = (id) => (S.preachers.find((p) => p.id === id) || {}).name || '(видалений)'
  const dim = (y, m) => new Date(y, m + 1, 0).getDate()
  const sortS = (a) => a.sort((x, y) => x.day - y.day || x.time.localeCompare(y.time))
  const sdate = (s) => new Date(S.y, S.m, s.day)
  const isBB = (s) => (s.bb != null ? !!s.bb : s.kind !== 'study' && s.day <= 7 && sdate(s).getDay() === 0)
  function gen(y, m) {
    const r = []
    for (let d = 1; d <= dim(y, m); d++) {
      const w = new Date(y, m, d).getDay()
      for (const t of set().weekly) {
        if (+t.dow === w) r.push({ id: `${d}-${t.time.replace(':', '')}`, day: d, time: t.time, kind: t.kind })
      }
    }
    return sortS(r)
  }
  function MD(y = S.y, m = S.m) {
    const d = S.months[K(y, m)]
    if (d) return { services: sortS(clone(d.services || [])), a: clone(d.a || {}), saved: true }
    return { services: gen(y, m), a: {}, saved: false }
  }
  function nextSvc(sv) {
    const t = Date.now() - 3 * 36e5
    let best = null
    for (const s of sv) {
      const [h, mi] = s.time.split(':')
      const d = new Date(S.y, S.m, s.day, +h, +mi).getTime()
      if (d >= t && (!best || d < best.d)) best = { d, s }
    }
    return best && best.s.id
  }
  function toast(t) {
    toastEl.textContent = t
    toastEl.classList.add('on')
    clearTimeout(toast.t)
    toast.t = setTimeout(() => toastEl.classList.remove('on'), 3500)
  }
  const queues = {}
  function q(k, fn) {
    queues[k] = (queues[k] || Promise.resolve())
      .then(fn)
      .catch((e) => toast(`Не вдалося зберегти: ${e.message}`))
    return queues[k]
  }

  /* ---------- шапка ---------- */
  function head() {
    $('#pg-title').textContent = `${MN[S.m]} ${S.y}`
    const ys = new Set([now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, S.y])
    Object.keys(S.months).forEach((k) => ys.add(+k.slice(0, 4)))
    $('#pg-year').innerHTML = [...ys]
      .sort()
      .map((y) => `<option ${y === S.y ? 'selected' : ''}>${y}</option>`)
      .join('')
    $('#pg-month').innerHTML = MN.map((n, i) => `<option value="${i}" ${i === S.m ? 'selected' : ''}>${n}</option>`).join('')
    root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === S.view)))
    const ps = [...S.preachers].sort((a, b) => a.name.localeCompare(b.name, 'uk'))
    const hl = $('#pg-hl')
    if (hl) {
      hl.innerHTML =
        '<option value="">— нікого —</option>' +
        ps.map((p) => `<option value="${esc(p.id)}" ${p.id === S.hl ? 'selected' : ''}>${esc(p.name)}</option>`).join('')
    }
    $('#pg-note').innerHTML = set().note ? `<b>Примітка:</b> ${esc(set().note)}` : ''
  }

  /* ---------- таблиця ---------- */
  function rowsFor(md) {
    const used = new Set()
    Object.values(md.a).forEach((o) => Object.keys(o).forEach((p) => used.add(p)))
    return S.preachers.filter((p) => p.active !== false || used.has(p.id))
  }
  function gridHTML(md, edit) {
    const sv = md.services
    const rows = rowsFor(md)
    const nx = nextSvc(sv)
    if (!rows.length) return `<div class="pg-msg">Ще немає жодного проповідника.${edit ? ' Додайте їх нижче.' : ''}</div>`
    let h = `<div class="pg-wrap"><table class="pg-grid${edit ? ' pg-edit' : ''}${S.hl && !edit ? ' pg-dim' : ''}"><thead><tr><th class="pg-nm">Проповідник</th>`
    sv.forEach((s, i) => {
      const w = sdate(s).getDay()
      const cls = [w === 0 && 'sun', s.kind === 'study' && 'st', isBB(s) && 'bb', s.id === nx && 'next'].filter(Boolean).join(' ')
      h += `<th data-c="${i}" class="${cls}"><b>${s.day}</b><span>${DS[w]}</span><small>${esc(s.time)}</small></th>`
    })
    h += '</tr></thead><tbody>'
    const dup = {}
    sv.forEach((s) => {
      const c = {}
      Object.entries(md.a[s.id] || {}).forEach(([p, n]) => (c[n] = c[n] || []).push(p))
      Object.values(c).forEach((l) => {
        if (l.length > 1) l.forEach((p) => (dup[`${s.id}|${p}`] = 1))
      })
    })
    rows.forEach((p, r) => {
      h += `<tr data-r="${r}"${p.id === S.hl ? ' class="me"' : ''}><td class="pg-nm"><small>${r + 1}</small>${esc(p.name)}</td>`
      sv.forEach((s, i) => {
        if (s.kind === 'study') {
          if (r === 0) h += `<td class="study" rowspan="${rows.length}" data-c="${i}"><span>${esc(s.label || 'Розбір Слова')}</span></td>`
          return
        }
        const n = (md.a[s.id] || {})[p.id]
        const cls = [isBB(s) && 'bb', dup[`${s.id}|${p.id}`] && 'dup'].filter(Boolean).join(' ')
        h += `<td data-c="${i}" data-p="${esc(p.id)}" data-s="${esc(s.id)}"${cls ? ` class="${cls}"` : ''}>${n ? `<i class="pg-n pg-n${n}">${n}</i>` : ''}</td>`
      })
      h += '</tr>'
    })
    return h + '</tbody></table></div>'
  }
  const legend = () =>
    `<div class="pg-legend"><span><i class="pg-n pg-n1">1</i>перша проповідь</span><span><i class="pg-n pg-n2">2</i>друга проповідь</span><span><i class="pg-n pg-n3">3</i>третя</span><span><i class="pg-n pg-n4">4</i>четверта</span><span><i class="pg-sw bb"></i>Хліболамання — перша неділя місяця</span><span><i class="pg-sw st"></i>Субота — Розбір Слова</span><span class="pg-red">Неділі — червоним</span></div>`
  const notYet = (md) =>
    !md.saved || !Object.keys(md.a).length ? `<div class="pg-msg">На ${MG[S.m]} графік ще не складено.</div>` : ''

  /* ---------- вигляди ---------- */
  function vTable() {
    const md = MD()
    return notYet(md) + gridHTML(md, false) + legend()
  }
  function vDates() {
    const md = MD()
    const nx = nextSvc(md.services)
    if (!md.services.length) return '<div class="pg-msg">Цього місяця служінь не заплановано.</div>'
    return (
      notYet(md) +
      '<div class="pg-days">' +
      md.services
        .map((s) => {
          const w = sdate(s).getDay()
          const bb = isBB(s)
          const lst = Object.entries(md.a[s.id] || {})
            .map(([p, n]) => ({ p, n }))
            .sort((a, b) => a.n - b.n)
          const mine = lst.some((x) => x.p === S.hl)
          const cls = [w === 0 && 'sun', s.kind === 'study' && 'st', bb && 'bb', s.id === nx && 'next', mine && 'mine']
            .filter(Boolean)
            .join(' ')
          const body =
            s.kind === 'study'
              ? `<div class="pg-st">${esc(s.label || 'Розбір Слова')}</div>`
              : (s.label ? `<div class="pg-st">${esc(s.label)}</div>` : '') +
                (lst.length
                  ? `<ol>${lst.map((x) => `<li${x.p === S.hl ? ' class="me"' : ''}><i class="pg-n pg-n${x.n}">${x.n}</i>${esc(pname(x.p))}</li>`).join('')}</ol>`
                  : '<div class="pg-em">Ще не призначено</div>')
          return `<article class="pg-svc ${cls}"><div class="pg-dd"><b>${s.day}</b><span>${DS[w]}</span></div><div>
            <div class="pg-meta">${DF[w]} · ${esc(s.time)}${bb ? ' <em class="bbt">Хліболамання</em>' : ''}${s.id === nx ? ' <em class="nx">Найближче</em>' : ''}</div>${body}</div></article>`
        })
        .join('') +
      '</div>'
    )
  }
  function yearStats(y) {
    const st = {}
    for (let m = 0; m < 12; m++) {
      const d = S.months[K(y, m)]
      if (!d) continue
      const sm = {}
      ;(d.services || []).forEach((s) => (sm[s.id] = s))
      Object.entries(d.a || {}).forEach(([sid, o]) =>
        Object.entries(o).forEach(([p, n]) => {
          const s = sm[sid]
          if (!s) return
          const x = (st[p] ??= { c: Array(12).fill(0), l: [] })
          x.c[m]++
          x.l.push({ m, day: s.day, time: s.time, n })
        }),
      )
    }
    return st
  }
  function vPeople() {
    const st = yearStats(S.y)
    const ps = S.preachers.filter((p) => p.active !== false || st[p.id])
    const max = Math.max(1, ...Object.values(st).flatMap((x) => x.c))
    let h = `<div class="pg-msg">Скільки разів кожен проповідував у ${S.y} році. Натисніть на імʼя — побачите всі дати, на число — відкриється цей місяць.</div><div class="pg-wrap"><table class="pg-grid pg-ppl"><thead><tr><th class="pg-nm">Проповідник</th>${MS.map((n, i) => `<th class="${i === S.m ? 'cur' : ''}"><b class="pg-mn">${n}</b></th>`).join('')}<th>Σ</th></tr></thead><tbody>`
    ps.forEach((p, r) => {
      const x = st[p.id] || { c: Array(12).fill(0), l: [] }
      const t = x.c.reduce((a, b) => a + b, 0)
      h += `<tr data-r="${r}"${p.id === S.hl ? ' class="me"' : ''}><td class="pg-nm pg-open" data-open="${esc(p.id)}">${S.open === p.id ? '▾' : '▸'} ${esc(p.name)}</td>`
      h += x.c
        .map((c, m) =>
          c
            ? `<td class="pg-m" data-jm="${m}" data-jp="${esc(p.id)}">${c}<i style="width:${Math.round((c / max) * 28)}px"></i></td>`
            : '<td class="pg-z">·</td>',
        )
        .join('')
      h += `<td class="pg-tot">${t || ''}</td></tr>`
      if (S.open === p.id) {
        const items = x.l
          .sort((a, b) => a.m - b.m || a.day - b.day)
          .map((e) => `<span><i class="pg-n pg-n${e.n}">${e.n}</i>${e.day} ${MG[e.m]} · ${DS[new Date(S.y, e.m, e.day).getDay()]} ${esc(e.time)}</span>`)
          .join('')
        h += `<tr class="pg-det"><td colspan="14">${items ? `<div class="pg-lst">${items}</div>` : 'У цьому році проповідей ще немає.'}</td></tr>`
      }
    })
    return h + '</tbody></table></div>'
  }

  /* ---------- адмінка ---------- */
  function vLogin() {
    return `<form class="pg-login" id="pg-login"><h2>Вхід для адміністратора</h2>
      <label>Email<input class="pg-inp" type="email" id="pg-email" autocomplete="username" required></label>
      <label>Пароль<input class="pg-inp" type="password" id="pg-pass" autocomplete="current-password" required></label>
      <button class="pg-b pr" type="submit">Увійти</button><p class="pg-hint" id="pg-lerr"></p></form>`
  }
  function vAdmin() {
    if (!S.authChecked) return '<div class="pg-msg">Перевіряю вхід…</div>'
    if (!api.signedIn) return vLogin()
    if (!S.admin)
      return `<div class="pg-msg">Акаунт ${esc(api.email)} не має прав редагування графіка. <button class="pg-link" data-act="logout">Вийти</button></div>`
    const md = MD()
    const d = dim(S.y, S.m)
    let h = `<div class="pg-msg"><b>Редагування: ${MN[S.m].toLowerCase()} ${S.y}.</b> Натисніть клітинку, щоб призначити номер (1–4), або наведіть мишку і натисніть цифру, 0 — прибрати. Натисніть дату в шапці, щоб змінити час, тип служіння чи хліболамання. <span class="pg-who">${esc(api.email)} · <button class="pg-link" data-act="logout">Вийти</button></span></div>`
    h += gridHTML(md, true) + legend()
    h += `<div class="pg-panel"><h2>Служіння місяця</h2><div class="pg-row">
      <select class="pg-inp" id="pg-nd">${Array.from({ length: d }, (_, i) => `<option value="${i + 1}">${i + 1} ${MG[S.m]}, ${DS[new Date(S.y, S.m, i + 1).getDay()]}</option>`).join('')}</select>
      <input class="pg-inp" id="pg-nt" type="time" value="10:00">
      <select class="pg-inp" id="pg-nk"><option value="preach">Проповідь</option><option value="study">Розбір Слова</option></select>
      <button class="pg-b pr" data-act="addS">Додати дату</button></div>
      <div class="pg-row pg-mt"><button class="pg-b sm" data-act="tplS">Додати дати за тижневим шаблоном</button><button class="pg-b sm dg" data-ask="clearA">Очистити всі призначення</button><span id="pg-ask-clearA"></span></div>
      <p class="pg-hint">Шаблон: ${set().weekly.map((t) => `${DF[t.dow]} ${t.time}${t.kind === 'study' ? ' (розбір)' : ''}`).join(', ') || 'порожній'}.</p></div>`
    h += `<div class="pg-panel"><h2>Проповідники</h2><div class="pg-row"><input class="pg-inp pg-grow" id="pg-np" placeholder="Прізвище І.Б."><button class="pg-b pr" data-act="addP">Додати</button></div><div class="pg-plist">${S.preachers
      .map(
        (p, i) =>
          `<div class="pg-it${p.active === false ? ' off' : ''}"><span class="ix">${i + 1}</span><input type="text" data-ren="${esc(p.id)}" value="${esc(p.name)}" aria-label="Імʼя"><div class="act"><label><input type="checkbox" data-active="${esc(p.id)}" ${p.active !== false ? 'checked' : ''}>активний</label><button class="pg-b sm" data-up="${i}" aria-label="Вгору">↑</button><button class="pg-b sm" data-dn="${i}" aria-label="Вниз">↓</button><button class="pg-b sm dg" data-ask="del:${esc(p.id)}" aria-label="Видалити">✕</button></div><div id="pg-ask-del:${esc(p.id)}" class="pg-askrow"></div></div>`,
      )
      .join('')}</div><p class="pg-hint">Неактивні не показуються в нових місяцях, але залишаються в минулих графіках.</p></div>`
    h += `<div class="pg-panel"><h2>Налаштування</h2><label class="pg-hint" for="pg-snote">Примітка під заголовком</label><input class="pg-inp pg-full" id="pg-snote" value="${esc(set().note)}">
      <p class="pg-hint pg-mt">Тижневий шаблон служінь (для нових місяців)</p><div class="pg-plist">${weekly()
        .map(
          (t, i) =>
            `<div class="pg-row"><select class="pg-inp" data-wd="${i}">${[1, 2, 3, 4, 5, 6, 0].map((w) => `<option value="${w}" ${+t.dow === w ? 'selected' : ''}>${DF[w]}</option>`).join('')}</select><input class="pg-inp" type="time" data-wt="${i}" value="${esc(t.time)}"><select class="pg-inp" data-wk="${i}"><option value="preach" ${t.kind !== 'study' ? 'selected' : ''}>Проповідь</option><option value="study" ${t.kind === 'study' ? 'selected' : ''}>Розбір Слова</option></select><button class="pg-b sm dg" data-wx="${i}">✕</button></div>`,
        )
        .join('')}</div>
      <div class="pg-row pg-mt"><button class="pg-b sm" data-act="addW">+ день у шаблон</button><button class="pg-b pr" data-act="saveSet">Зберегти налаштування</button></div></div>`
    return h
  }

  let draftW = null
  function weekly() {
    draftW = draftW || clone(set().weekly)
    draftW.forEach((x, i) => {
      const d = out.querySelector(`[data-wd="${i}"]`)
      if (d) {
        x.dow = +d.value
        x.time = out.querySelector(`[data-wt="${i}"]`).value || x.time
        x.kind = out.querySelector(`[data-wk="${i}"]`).value
      }
    })
    return draftW
  }

  /* ---------- рендер ---------- */
  function render() {
    head()
    closePop()
    hideTip()
    if (S.err) {
      out.innerHTML = `<div class="pg-msg">${esc(S.err)}</div>`
      return
    }
    if (!S.loaded) {
      out.innerHTML = '<div class="pg-msg">Завантаження графіка…</div>'
      return
    }
    out.innerHTML = S.view === 'dates' ? vDates() : S.view === 'people' ? vPeople() : S.view === 'admin' ? vAdmin() : vTable()
  }

  /* ---------- підсвітка і підказка ---------- */
  const hs = document.createElement('style')
  document.head.appendChild(hs)
  let hover = null
  function hideTip() {
    tip.classList.remove('on')
    hs.textContent = ''
    hover = null
  }
  function showTip(el, html) {
    tip.innerHTML = html
    tip.classList.add('on')
    const r = el.getBoundingClientRect()
    const w = tip.offsetWidth
    const hh = tip.offsetHeight
    const x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8))
    let y = r.top - hh - 8
    if (y < 8) y = r.bottom + 8
    tip.style.left = `${x}px`
    tip.style.top = `${y}px`
  }
  function onOver(e) {
    const el = e.target.closest?.('.pg-grid:not(.pg-ppl) td[data-c], .pg-grid:not(.pg-ppl) th[data-c]')
    if (!el || !root.contains(el)) {
      if (hover) hideTip()
      return
    }
    if (el === hover) return
    hover = el
    const md = MD()
    const c = +el.dataset.c
    const s = md.services[c]
    if (!s) return
    const r = el.closest('tr')?.dataset.r
    hs.textContent =
      `#pg .pg-grid [data-c="${c}"]:not(.study){background:var(--pg-col)!important}` +
      (el.dataset.p && r != null
        ? `#pg .pg-grid tr[data-r="${r}"]>td:not(.study){background:var(--pg-col)!important}#pg .pg-grid tr[data-r="${r}"]>td[data-c="${c}"]{background:var(--pg-cross)!important}`
        : '')
    const w = sdate(s).getDay()
    const dl = `<span class="d">${DF[w]}, ${s.day} ${MG[S.m]} · ${esc(s.time)}</span>${isBB(s) ? '<span class="r">Хліболамання</span>' : ''}`
    if (el.dataset.p) {
      const n = (md.a[s.id] || {})[el.dataset.p]
      showTip(el, `${dl}<b>${esc(pname(el.dataset.p))}</b>${n ? `${n}-а проповідь` : 'не призначено'}`)
    } else if (s.kind === 'study') {
      showTip(el, `${dl}<b>${esc(s.label || 'Розбір Слова')}</b>`)
    } else {
      const l = Object.entries(md.a[s.id] || {}).sort((a, b) => a[1] - b[1])
      showTip(
        el,
        dl +
          (s.label ? `<b>${esc(s.label)}</b>` : '') +
          (l.length ? `<ol>${l.map(([p, n]) => `<li value="${n}">${esc(pname(p))}</li>`).join('')}</ol>` : '<span>Ще не призначено</span>'),
      )
    }
  }
  root.addEventListener('mouseover', onOver)
  out.addEventListener('mouseleave', hideTip)
  addEventListener('scroll', hideTip, { passive: true, capture: true })

  /* ---------- попапи адмінки ---------- */
  function closePop() {
    pop.classList.remove('on')
  }
  function openPop(el, html) {
    pop.innerHTML = html
    pop.classList.add('on')
    const r = el.getBoundingClientRect()
    const w = pop.offsetWidth
    const h = pop.offsetHeight
    const x = Math.max(12, Math.min(r.left, innerWidth - w - 12))
    let y = r.bottom + 6
    if (y + h > innerHeight - 12) y = Math.max(12, r.top - h - 6)
    pop.style.left = `${x}px`
    pop.style.top = `${y}px`
    hideTip()
  }
  function saveMonth(fn) {
    const k = K()
    const md = MD()
    fn(md)
    for (const sid of Object.keys(md.a)) {
      if (!Object.keys(md.a[sid]).length || !md.services.some((s) => s.id === sid)) delete md.a[sid]
    }
    const body = { services: sortS(md.services), a: md.a }
    S.months = { ...S.months, [k]: body }
    render()
    return q(`m${k}`, () => api.saveMonth(k, body))
  }
  function setCell(sid, pid, n) {
    saveMonth((md) => {
      const o = (md.a[sid] = md.a[sid] || {})
      if (n) o[pid] = n
      else delete o[pid]
    })
  }
  function cellPop(td) {
    const md = MD()
    const sid = td.dataset.s
    const pid = td.dataset.p
    const s = md.services.find((x) => x.id === sid)
    const cur = (md.a[sid] || {})[pid] || 0
    const others = Object.entries(md.a[sid] || {})
      .filter(([p]) => p !== pid)
      .sort((a, b) => a[1] - b[1])
    openPop(
      td,
      `<h3>${esc(pname(pid))}</h3><div class="s">${DF[sdate(s).getDay()]}, ${s.day} ${MG[S.m]} · ${esc(s.time)}${others.length ? `<br>Вже: ${others.map(([p, n]) => `${n} — ${esc(pname(p))}`).join(', ')}` : ''}</div>
      <div class="nums">${[1, 2, 3, 4].map((n) => `<button data-setn="${n}" class="${cur === n ? 'on' : ''}">${n}</button>`).join('')}<button data-setn="0" title="Прибрати">✕</button></div>`,
    )
    pop.dataset.sid = sid
    pop.dataset.pid = pid
  }
  function svcPop(th) {
    const md = MD()
    const s = md.services[+th.dataset.c]
    openPop(
      th,
      `<h3>${s.day} ${MG[S.m]}, ${DF[sdate(s).getDay()]}</h3><div class="s">Налаштування служіння</div><div class="f">
      <label>День<select class="pg-inp" id="pg-pd">${Array.from({ length: dim(S.y, S.m) }, (_, i) => `<option ${i + 1 === s.day ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
      <label>Час<input class="pg-inp" type="time" id="pg-pt" value="${esc(s.time)}"></label>
      <label>Тип<select class="pg-inp" id="pg-pk"><option value="preach">Проповідь</option><option value="study" ${s.kind === 'study' ? 'selected' : ''}>Розбір Слова</option></select></label>
      <label>Підпис (необовʼязково)<input class="pg-inp" id="pg-pl" value="${esc(s.label || '')}" placeholder="напр. Свято жнив"></label>
      <label>Хліболамання<select class="pg-inp" id="pg-pb"><option value="auto" ${s.bb == null ? 'selected' : ''}>Авто (перша неділя) — ${isBB({ ...s, bb: null }) ? 'так' : 'ні'}</option><option value="1" ${s.bb === true ? 'selected' : ''}>Так</option><option value="0" ${s.bb === false ? 'selected' : ''}>Ні</option></select></label>
      <div class="pg-row"><button class="pg-b pr" data-svsave="${esc(s.id)}">Зберегти</button><button class="pg-b dg" data-svdel="${esc(s.id)}">Видалити дату</button></div></div>`,
    )
  }
  function savePreachers(list) {
    S.preachers = list
    render()
    return q('p', () => api.savePreachers(list))
  }

  /* ---------- події ---------- */
  root.addEventListener('submit', async (e) => {
    if (e.target.id !== 'pg-login') return
    e.preventDefault()
    const err = $('#pg-lerr')
    err.textContent = 'Вхід…'
    try {
      await api.signIn($('#pg-email').value.trim(), $('#pg-pass').value)
      S.admin = await api.isAdmin()
      render()
    } catch (x) {
      err.textContent = /invalid/i.test(x.message) ? 'Невірний email або пароль.' : x.message
    }
  })
  root.addEventListener('click', (e) => {
    const t = e.target
    if (!t.closest('#pg-pop') && !t.closest('.pg-edit td[data-p]') && !t.closest('.pg-edit th[data-c]')) closePop()
    const b = t.closest('button, td, th')
    if (!b || !root.contains(b)) return
    const ds = b.dataset
    if (ds.nav) {
      S.m += +ds.nav
      if (S.m > 11) {
        S.m = 0
        S.y++
      } else if (S.m < 0) {
        S.m = 11
        S.y--
      }
      render()
    } else if (ds.view) {
      S.view = ds.view
      ls.set('pg-view', S.view)
      render()
    } else if (ds.open != null) {
      S.open = S.open === ds.open ? '' : ds.open
      render()
    } else if (ds.jm != null) {
      S.m = +ds.jm
      S.hl = ds.jp
      S.view = 'table'
      render()
    } else if (b.closest('.pg-edit') && ds.p) {
      cellPop(b)
    } else if (b.closest('.pg-edit') && b.tagName === 'TH' && ds.c != null) {
      svcPop(b)
    } else if (!b.closest('.pg-edit') && b.matches('.pg-grid td[data-c], .pg-grid th[data-c]') && matchMedia('(hover: none)').matches) {
      hover = null
      onOver({ target: b })
    } else if (ds.setn != null) {
      setCell(pop.dataset.sid, pop.dataset.pid, +ds.setn)
    } else if (ds.svsave) {
      const id = ds.svsave
      const day = +$('#pg-pd').value
      const time = $('#pg-pt').value || '10:00'
      const kind = $('#pg-pk').value
      const label = $('#pg-pl').value.trim()
      const pb = $('#pg-pb').value
      saveMonth((md) => {
        const s = md.services.find((x) => x.id === id)
        const nid = `${day}-${time.replace(':', '')}`
        if (nid !== id && md.services.some((x) => x.id === nid)) {
          toast('Таке служіння вже є')
          return
        }
        Object.assign(s, { id: nid, day, time, kind, label, bb: pb === 'auto' ? null : pb === '1' })
        if (!s.label) delete s.label
        if (s.bb == null) delete s.bb
        if (nid !== id && md.a[id]) {
          md.a[nid] = md.a[id]
          delete md.a[id]
        }
      })
    } else if (ds.svdel) {
      const id = ds.svdel
      saveMonth((md) => {
        md.services = md.services.filter((x) => x.id !== id)
        delete md.a[id]
      })
    } else if (ds.act === 'addS') {
      const day = +$('#pg-nd').value
      const time = $('#pg-nt').value || '10:00'
      const kind = $('#pg-nk').value
      const id = `${day}-${time.replace(':', '')}`
      saveMonth((md) => {
        if (md.services.some((x) => x.id === id)) {
          toast('Така дата вже є')
          return
        }
        md.services.push({ id, day, time, kind })
      })
    } else if (ds.act === 'tplS') {
      saveMonth((md) => {
        for (const s of gen(S.y, S.m)) if (!md.services.some((x) => x.id === s.id)) md.services.push(s)
      })
    } else if (ds.ask) {
      const box = root.querySelector(`[id="pg-ask-${CSS.escape(ds.ask)}"]`)
      if (box)
        box.innerHTML = `<span class="pg-row pg-confirm"><span>Точно?</span><button class="pg-b sm dg" data-yes="${esc(ds.ask)}">Так</button><button class="pg-b sm" data-no="1">Ні</button></span>`
    } else if (ds.no) {
      b.closest('.pg-confirm').remove()
    } else if (ds.yes) {
      const a = ds.yes
      if (a === 'clearA') saveMonth((md) => (md.a = {}))
      else if (a.startsWith('del:')) {
        const id = a.slice(4)
        S.preachers = S.preachers.filter((p) => p.id !== id)
        render()
        q('p', () => api.deletePreacher(id))
      }
    } else if (ds.act === 'addP') {
      const v = $('#pg-np').value.trim()
      if (!v) return
      const id = `p${Date.now().toString(36)}`
      savePreachers([...clone(S.preachers), { id, name: v, active: true }])
    } else if (ds.up != null || ds.dn != null) {
      const i = +(ds.up ?? ds.dn)
      const j = ds.up != null ? i - 1 : i + 1
      const l = clone(S.preachers)
      if (j < 0 || j >= l.length) return
      ;[l[i], l[j]] = [l[j], l[i]]
      savePreachers(l)
    } else if (ds.act === 'addW') {
      weekly().push({ dow: 0, time: '18:00', kind: 'preach' })
      S.settings = { ...set(), note: $('#pg-snote').value, weekly: clone(draftW) }
      render()
    } else if (ds.wx != null) {
      weekly().splice(+ds.wx, 1)
      S.settings = { ...set(), note: $('#pg-snote').value, weekly: clone(draftW) }
      render()
    } else if (ds.act === 'saveSet') {
      const st = { note: $('#pg-snote').value.trim(), weekly: clone(weekly()) }
      S.settings = st
      draftW = null
      render()
      q('s', () => api.saveSettings(st)).then(() => toast('Збережено'))
    } else if (ds.act === 'logout') {
      api.signOut()
      S.admin = false
      render()
    }
  })
  root.addEventListener('change', (e) => {
    const t = e.target
    if (t.id === 'pg-year') {
      S.y = +t.value
      render()
    } else if (t.id === 'pg-month') {
      S.m = +t.value
      render()
    } else if (t.id === 'pg-hl') {
      S.hl = t.value
      render()
    } else if (t.dataset.ren) {
      const v = t.value.trim()
      if (v) savePreachers(clone(S.preachers).map((p) => (p.id === t.dataset.ren ? { ...p, name: v } : p)))
    } else if (t.dataset.active) {
      savePreachers(clone(S.preachers).map((p) => (p.id === t.dataset.active ? { ...p, active: t.checked } : p)))
    }
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePop()
      hideTip()
    }
    if (S.view === 'admin' && S.admin && hover?.dataset.p && /^[0-4]$/.test(e.key) && !e.target.closest('input, select')) {
      setCell(hover.dataset.s, hover.dataset.p, +e.key)
    }
    if (e.target.id === 'pg-np' && e.key === 'Enter') root.querySelector('[data-act="addP"]')?.click()
  })

  /* ---------- тема ---------- */
  const themeBtn = $('#pg-theme')
  function applyTheme(mode) {
    root.dataset.mode = mode
    themeBtn.innerHTML = mode === 'dark' ? SUN : MOON
    themeBtn.title = mode === 'dark' ? 'Світла тема' : 'Темна тема'
  }
  applyTheme(ls.get('pg-mode') === 'dark' ? 'dark' : 'light')
  themeBtn.addEventListener('click', () => {
    const m = root.dataset.mode === 'dark' ? 'light' : 'dark'
    ls.set('pg-mode', m)
    applyTheme(m)
  })

  /* ---------- старт ---------- */
  render()
  ;(async () => {
    try {
      const d = await api.loadAll()
      S.preachers = d.preachers
      S.settings = d.settings
      S.months = d.months
      S.loaded = true
    } catch {
      S.err = 'Не вдалося завантажити графік. Оновіть сторінку трохи пізніше.'
    }
    if (ADMIN_PAGE) {
      S.admin = await api.isAdmin()
      S.authChecked = true
    }
    render()
  })()
}
