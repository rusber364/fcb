// Доступ до бази календаря подій (Supabase) через REST, без SDK — як grafikApi.mjs.
// Читати події може будь-хто; змінювати — лише користувачі з таблиці cal_admins (RLS).
// Сесія спільна з адмінкою графіка (той самий ключ у localStorage), тож адмін входить один раз.

const URL = import.meta.env.PUBLIC_SUPABASE_URL || "https://odrivmkesxuhixdsbnme.supabase.co";
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_R2GNpGDKP6jfLjlzrH1oIg_o1Dr-KUp";
const SESSION_KEY = "grafik-session";

const EVENT_FIELDS =
  "id,title,description,location,date,end_date,all_day,start_time,end_time,category_id,color,tint_day,repeat,repeat_until,exdates";

const store = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  },
  set(v) {
    try {
      if (v) localStorage.setItem(SESSION_KEY, JSON.stringify(v));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* без сховища вхід живе до перезавантаження */
    }
  },
};
let session = store.get();

function saveSession(data) {
  session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    email: data.user?.email || session?.email || "",
  };
  store.set(session);
}

async function authFetch(path, body) {
  const r = await fetch(`${URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error_description || data.msg || data.message || "Помилка входу");
  return data;
}

async function token() {
  session = store.get() || session;
  if (!session) return null;
  if (session.expires_at - 60 < Date.now() / 1000) {
    try {
      saveSession(await authFetch("token?grant_type=refresh_token", { refresh_token: session.refresh_token }));
    } catch {
      signOutLocal();
      return null;
    }
  }
  return session.access_token;
}

function signOutLocal() {
  session = null;
  store.set(null);
}

async function rest(path, { method = "GET", body, prefer, auth = false } = {}) {
  const headers = { apikey: KEY, "Content-Type": "application/json" };
  const t = auth ? await token() : null;
  if (auth && !t) throw new Error("Потрібно увійти знову");
  if (t) headers.Authorization = `Bearer ${t}`;
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.message || `Помилка ${r.status}`);
  }
  return r.status === 204 ? null : r.json().catch(() => null);
}

/** Час із бази "18:30:00" → "18:30". */
const hm = (t) => (t ? String(t).slice(0, 5) : null);
function normEvent(e) {
  return { ...e, start_time: hm(e.start_time), end_time: hm(e.end_time), exdates: e.exdates || [] };
}

export const calendarApi = {
  async loadAll() {
    const [categories, events] = await Promise.all([
      rest("cal_categories?select=id,name,color,sort&order=sort.asc,name.asc"),
      rest(`cal_events?select=${EVENT_FIELDS}&order=date.asc`),
    ]);
    return { categories: categories || [], events: (events || []).map(normEvent) };
  },

  get email() {
    return session?.email || "";
  },
  get signedIn() {
    return !!session;
  },
  async signIn(email, password) {
    saveSession(await authFetch("token?grant_type=password", { email, password }));
  },
  async signOut() {
    const t = session?.access_token;
    signOutLocal();
    if (t) {
      fetch(`${URL}/auth/v1/logout`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${t}` } }).catch(
        () => {},
      );
    }
  },
  async isAdmin() {
    if (!session) return false;
    try {
      const rows = await rest("cal_admins?select=user_id", { auth: true });
      return !!(rows && rows.length);
    } catch {
      return false;
    }
  },

  async saveEvent(ev) {
    const body = {};
    for (const f of EVENT_FIELDS.split(",")) if (ev[f] !== undefined) body[f] = ev[f];
    const rows = await rest(`cal_events?on_conflict=id&select=${EVENT_FIELDS}`, {
      method: "POST",
      auth: true,
      prefer: "resolution=merge-duplicates,return=representation",
      body,
    });
    return normEvent(rows[0]);
  },
  deleteEvent(id) {
    return rest(`cal_events?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", auth: true });
  },
  async saveCategory(cat) {
    const rows = await rest("cal_categories?on_conflict=id&select=id,name,color,sort", {
      method: "POST",
      auth: true,
      prefer: "resolution=merge-duplicates,return=representation",
      body: { id: cat.id, name: cat.name, color: cat.color, sort: cat.sort || 0 },
    });
    return rows[0];
  },
  deleteCategory(id) {
    return rest(`cal_categories?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", auth: true });
  },
};
