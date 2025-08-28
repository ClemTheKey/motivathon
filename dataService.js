// dataService.js — Pont unique entre l’app et la donnée (localStorage <-> Supabase)
export const Data = (function () {
  // Basculer ici: "local" pour revenir 100% localStorage, "supabase" pour synchro cloud
  const MODE = "local"; // change en "supabase" quand Supabase sera prêt

  // === Interface commune utilisée par l'app ===
  async function init() { return MODE === "supabase" ? initSB() : null; }
  async function listTasks() { return MODE === "supabase" ? sbListTasks() : lsListTasks(); }
  async function upsertTask(t) { return MODE === "supabase" ? sbUpsertTask(t) : lsUpsertTask(t); }
  async function setDone(id, done) { return MODE === "supabase" ? sbSetDone(id, done) : lsSetDone(id, done); }
  function onRealtime(cb) { return MODE === "supabase" ? sbSubscribe(cb) : () => {}; }

  // === Implémentation LocalStorage (ton mode actuel) ===
  const LS_KEYS = { tasks: "motivathon_tasks" }; // ajuste si tu as d’autres clés
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS_KEYS.tasks) || "[]"); } catch { return []; } };
  const lsSet = (list) => localStorage.setItem(LS_KEYS.tasks, JSON.stringify(list));

  async function lsListTasks() { return lsGet(); }
  async function lsUpsertTask(t) {
    const list = lsGet();
    if (!t.id) t.id = crypto.randomUUID();
    const i = list.findIndex(x => x.id === t.id);
    if (i >= 0) list[i] = { ...list[i], ...t }; else list.push(t);
    lsSet(list);
    return t;
  }
  async function lsSetDone(id, done) {
    const list = lsGet();
    const i = list.findIndex(x => x.id === id);
    if (i >= 0) { list[i].done = !!done; lsSet(list); }
  }

  // === Implémentation Supabase (activée quand MODE="supabase") ===
  let sb = null;

  async function initSB() {
    const env = window.__ENV__ || {};
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = env;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase) {
      console.warn("[Data] Supabase non configuré, fallback local.");
      return null;
    }
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    return null;
  }

  async function sbUser() {
    const { data: { user } } = await sb.auth.getUser();
    return user || null;
  }

  async function sbListTasks() {
    const user = await sbUser(); if (!user) return lsListTasks(); // fallback
    const { data, error } = await sb.from("tasks").select("*").order("created_at", { ascending: true });
    if (error) { console.error(error); return lsListTasks(); }
    return data;
  }

  async function sbUpsertTask(t) {
    const user = await sbUser(); if (!user) return lsUpsertTask(t);
    const payload = { ...t, user_id: user.id };
    if (!payload.id) delete payload.id; // laisser Postgres générer
    const { data, error } = await sb.from("tasks").upsert(payload).select().single();
    if (error) { console.error(error); return lsUpsertTask(t); }
    return data;
  }

  async function sbSetDone(id, done) {
    const user = await sbUser(); if (!user) return lsSetDone(id, done);
    await sb.from("tasks").update({ done, updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", user.id);
  }

  function sbSubscribe(cb) {
    // écoute toutes les mutations sur tasks
    return sb.channel("tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => cb && cb())
      .subscribe();
  }

  return { init, listTasks, upsertTask, setDone, onRealtime };
})();
