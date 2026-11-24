// Доступ до бази графіка проповідей (Supabase) через REST, без додаткових пакетів.
// Публічний ключ (publishable/anon) не секретний: читати графік може будь-хто,
// а змінювати — лише користувачі з таблиці grafik_admins (правила RLS у базі).

const URL = import.meta.env.PUBLIC_SUPABASE_URL || 'https://odrivmkesxuhixdsbnme.supabase.co'
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_R2GNpGDKP6jfLjlzrH1oIg_o1Dr-KUp'
const SESSION_KEY = 'grafik-session'

const store = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    } catch {
      return null
    }
  },
  set(v) {
    try {
      if (v) localStorage.setItem(SESSION_KEY, JSON.stringify(v))
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      /* без сховища вхід живе до перезавантаження */
    }
  },
}
let session = store.get()

function saveSession(data) {
  session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    email: data.user?.email || session?.email || '',
  }
  store.set(session)
}

async function authFetch(path, body) {
  const r = await fetch(`${URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error_description || data.msg || data.message || 'Помилка входу')
  return data
}

async function token() {
  if (!session) return null
  if (session.expires_at - 60 < Date.now() / 1000) {
    try {
      saveSession(await authFetch('token?grant_type=refresh_token', { refresh_token: session.refresh_token }))
    } catch {
      signOutLocal()
      return null
    }
  }
  return session.access_token
}

function signOutLocal() {
  session = null
  store.set(null)
}

async function rest(path, { method = 'GET', body, prefer, auth = false } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' }
  const t = auth ? await token() : null
  if (auth && !t) throw new Error('Потрібно увійти знову')
  if (t) headers.Authorization = `Bearer ${t}`
  if (prefer) headers.Prefer = prefer
  const r = await fetch(`${URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error(e.message || `Помилка ${r.status}`)
  }
  return r.status === 204 ? null : r.json().catch(() => null)
}

export const api = {
  async loadAll() {
    const [preachers, settings, months] = await Promise.all([
      rest('grafik_preachers?select=id,name,active,sort&order=sort.asc,name.asc'),
      rest('grafik_settings?select=note,weekly&id=eq.1'),
      rest('grafik_months?select=key,services,a'),
    ])
    return {
      preachers: preachers || [],
      settings: (settings && settings[0]) || null,
      months: Object.fromEntries((months || []).map((m) => [m.key, { services: m.services || [], a: m.a || {} }])),
    }
  },

  get email() {
    return session?.email || ''
  },
  get signedIn() {
    return !!session
  },
  async signIn(email, password) {
    saveSession(await authFetch('token?grant_type=password', { email, password }))
  },
  async signOut() {
    const t = session?.access_token
    signOutLocal()
    if (t) {
      fetch(`${URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${t}` } }).catch(
        () => {},
      )
    }
  },
  async isAdmin() {
    if (!session) return false
    try {
      const rows = await rest('grafik_admins?select=user_id', { auth: true })
      return !!(rows && rows.length)
    } catch {
      return false
    }
  },

  saveMonth(key, body) {
    return rest('grafik_months?on_conflict=key', {
      method: 'POST',
      auth: true,
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: { key, services: body.services, a: body.a, updated_at: new Date().toISOString() },
    })
  },
  savePreachers(list) {
    return rest('grafik_preachers?on_conflict=id', {
      method: 'POST',
      auth: true,
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: list.map((p, i) => ({ id: p.id, name: p.name, active: p.active !== false, sort: i + 1 })),
    })
  },
  deletePreacher(id) {
    return rest(`grafik_preachers?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', auth: true })
  },
  saveSettings(st) {
    return rest('grafik_settings?on_conflict=id', {
      method: 'POST',
      auth: true,
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: { id: 1, note: st.note, weekly: st.weekly },
    })
  },
}
