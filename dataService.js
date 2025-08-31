/* dataService.js — Supabase + fallback localStorage (Motivathon)
 * API (présente dans tous les cas) :
 *   Data.init()        // async
 *   Data.listTasks()   // sync (cache)
 *   Data.listHistory() // sync (cache)
 *   Data.saveTasks(list) / Data.saveHistory(list) // sync (cache+LS)
 *   Data.setTaskDone(id, done) // async DB (fallback local)
 *   Data.upsertTask(task)      // async DB (fallback local)
 *   Data.refresh()     // async: DB→cache+LS puis re-render si possible
 *   Data.onRealtime(cb)// écoute DB (si Supabase dispo), sinon no-op
 *   Data.getUser()     // async
 *   Data.signInWithEmail(email), Data.signOut()
 */
(function(global){
  const LS = {
    tasksKey: "motivathon_tasks",
    historyKey: "motivathon_history",
    get(k, def="[]"){ try{ return JSON.parse(localStorage.getItem(k)||def);}catch{ return JSON.parse(def);} },
    set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
  };

  const state = {
    cacheTasks: LS.get(LS.tasksKey),
    cacheHistory: LS.get(LS.historyKey),
    sb: null,
    channel: null
  };

  function renderIfAvailable(){
    if (global.Motivathon && typeof global.Motivathon.renderTasks === "function") {
      try { global.Motivathon.tasks = state.cacheTasks.slice(); } catch {}
      try { global.Motivathon.renderTasks(); } catch(e){ console.warn("[Data] renderTasks error:", e); }
    }
  }

  async function _getUser(){ if(!state.sb) return null; const { data:{ user } } = await state.sb.auth.getUser(); return user||null; }

async function migrateLocalToDb(u) {
  if (!state.sb || !u) return false;

  const local = Array.isArray(state.cacheTasks) ? state.cacheTasks : [];
  if (!local.length) return false;

  // Map ancienId -> nouveauUUID (pour ids non UUID)
  const idMap = {};

  const rows = local.map(t => {
    let id = t.id;
    if (!isUuid(id)) {
      id = newUuid();
      idMap[t.id] = id; // mémorise la correspondance
    }
    return sanitizeTaskForDb({ ...t, id }, u.id);
  });

  // Upsert sans retour de représentation pour éviter ?columns=...
  const { error } = await state.sb.from("tasks").upsert(rows, { returning: "minimal" });
  if (error) {
    console.warn("[Data] migrateLocalToDb failed:", error);
    return false;
  }

  // Si on a changé des ids, aligne le cache local et persiste
  if (Object.keys(idMap).length) {
    state.cacheTasks = state.cacheTasks.map(t => idMap[t.id] ? { ...t, id: idMap[t.id] } : t);
    LS.set(LS.tasksKey, state.cacheTasks);
  }

  return true;
}



// Conserver UNIQUEMENT les colonnes de la table "tasks"
function sanitizeTaskForDb(t, user_id) {
  return {
    id: t.id,
    title: t.title ?? "",
    category: t.category ?? null,
    period: t.period ?? null,
    xp: typeof t.xp === "number" ? t.xp : 0,
    done: !!t.done,
    user_id,
    // laisser PG gérer created_at/updated_at si triggers, sinon:
    // created_at: t.created_at ?? new Date().toISOString(),
    // updated_at: new Date().toISOString(),
  };
}

 function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}
function newUuid() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  // fallback UUID v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
 
  const Data = {
  async init(){
  // Empêche les doubles inits
  if (state.initialized) return;
  state.initialized = true;

  const env = global.__ENV__ || {};
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = env;

  // Si pas de config, on reste en local
  if (!global.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.info("[Data] Supabase pas configuré → local only");
    return;
  }

  // Réutilise un client global s’il existe déjà
  if (global.__SB_CLIENT) {
    state.sb = global.__SB_CLIENT;
    return;
  }

  // IMPORTANT : storageKey unique à ton app/domaine (évite les collisions)
  state.sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "sb-motivathon-auth" // ← clé dédiée (change-la si tu as d’autres apps sur le même domaine)
    }
  });

  // Expose le singleton pour les autres modules éventuels
  global.__SB_CLIENT = state.sb;
},


    // sync (cache)
    listTasks(){ return state.cacheTasks; },
    listHistory(){ return state.cacheHistory; },

    saveTasks(list){ state.cacheTasks = Array.isArray(list)? list.slice():[]; LS.set(LS.tasksKey, state.cacheTasks); },
    saveHistory(list){ state.cacheHistory = Array.isArray(list)? list.slice():[]; LS.set(LS.historyKey, state.cacheHistory); },

    setTaskDone(id, done){
      const i = state.cacheTasks.findIndex(t => t && t.id === id);
      if (i >= 0){ state.cacheTasks[i].done = !!done; LS.set(LS.tasksKey, state.cacheTasks); }
      (async () => {
        const u = await _getUser(); if (!u || !state.sb) return;
        try {
          await state.sb.from("tasks").update({ done: !!done, updated_at: new Date().toISOString() })
            .eq("id", id).eq("user_id", u.id);
        } catch(e){ console.warn("[Data] setTaskDone DB fail (fallback local)", e); }
      })();
    },

async upsertTask(task) {
  // Toujours forcer un UUID
  if (!task.id || !isUuid(task.id)) task.id = newUuid();

  // Maj cache local immédiate
  const idx = state.cacheTasks.findIndex(t => t && t.id === task.id);
  if (idx >= 0) {
    state.cacheTasks[idx] = { ...state.cacheTasks[idx], ...task };
  } else {
    state.cacheTasks.push(task);
  }
  LS.set(LS.tasksKey, state.cacheTasks);

  // Si pas connecté → reste local
  const u = await _getUser();
  if (!u || !state.sb) return task;

  // On envoie uniquement les colonnes valides (grâce au sanitizer)
  const payload = sanitizeTaskForDb(task, u.id);

  // Upsert côté DB (on ne demande pas de retour pour éviter ?columns=…)
  const { error } = await state.sb.from("tasks").upsert(payload, { returning: "minimal" });
  if (error) {
    console.warn("[Data] upsertTask DB failed → keep local", error);
    return task;
  }

  return task;
},


async refresh({ migrate = true } = {}) {
  const u = await _getUser();
  if (!u || !state.sb) { renderIfAvailable(); return state.cacheTasks; }

  try {
    const { data, error } = await state.sb
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;

    // DB vide ?
    const dbEmpty = !Array.isArray(data) || data.length === 0;

    if (dbEmpty) {
      if (migrate && state.cacheTasks.length > 0) {
        // 1er passage connecté : migrer local -> DB
        const ok = await migrateLocalToDb(u);
        if (ok) {
          const { data: data2, error: e2 } = await state.sb
            .from("tasks")
            .select("*")
            .order("created_at", { ascending: true });
          if (!e2 && Array.isArray(data2)) {
            state.cacheTasks = data2;
            LS.set(LS.tasksKey, state.cacheTasks);
            renderIfAvailable();
            return state.cacheTasks;
          }
        }
      }
      // Important : ne JAMAIS écraser le local avec []
      renderIfAvailable();
      return state.cacheTasks;
    }

    // Cas normal : on a des données DB -> on aligne le cache/local
    state.cacheTasks = data;
    LS.set(LS.tasksKey, state.cacheTasks);
    renderIfAvailable();
    return state.cacheTasks;
  } catch (e) {
    console.warn("[Data] refresh failed → keep local", e);
    renderIfAvailable();
    return state.cacheTasks;
  }
},


    onRealtime(cb){
      if (!state.sb) return () => {}; // no-op en local
      try { if (state.channel) state.sb.removeChannel(state.channel); } catch {}
      state.channel = state.sb.channel("tasks-realtime")
        .on("postgres_changes", { event:"*", schema:"public", table:"tasks" }, async () => {
          await Data.refresh();
          if (typeof cb === "function") try { cb(); } catch {}
        })
        .subscribe();
      return () => { try { state.sb.removeChannel(state.channel); } catch {} };
    },

    // Auth helpers
    async getUser(){ return await _getUser(); },
    // Remplace Data.signInWithEmail par ceci
async signInWithEmail(email, redirectTo){
  if (!state.sb) return { error: "Supabase not configured" };
  // Par défaut, on force la page index de ton projet Pages
  const fallback = "https://clemthekey.github.io/motivathon/index.html";
  const target = redirectTo || fallback;
  const { error } = await state.sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: target } // <= v2 de supabase-js
  });
  return { error };
},

    async signOut(){ if (!state.sb) return; await state.sb.auth.signOut(); }
  };

  global.Data = Data;
})(window);
