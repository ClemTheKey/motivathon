/* dataService.js — Online only (Supabase requis) */
(function (global) {
  const state = { sb: null, channel: null, tasks: [] };

  function assertClient() {
    if (!state.sb) throw new Error("Supabase non initialisé");
  }

  function isUuid(v) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
  }
  function newUuid() {
    if (global.crypto?.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function sanitizeTask(t, user_id) {
    return {
      id: t.id,
      title: t.title ?? "",
      category: t.category ?? null,
      period: t.period ?? null,
      xp: typeof t.xp === "number" ? t.xp : 0,
      done: !!t.done,
      user_id
    };
  }

  async function _getUser() {
    assertClient();
    const { data: { user }, error } = await state.sb.auth.getUser();
    if (error) throw error;
    return user || null;
  }

  const Data = {
    async init() {
      const env = global.__ENV__ || {};
      const { SUPABASE_URL, SUPABASE_ANON_KEY } = env;
      if (!global.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error("Config Supabase manquante");
      }
      if (state.sb) return;

      state.sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "sb-motivathon-auth"
        }
      });
    },

    // Auth
    async getUser() { return await _getUser(); },
    async signInWithEmail(email, redirectTo) {
      assertClient();
      const fallback = location.origin + location.pathname; // renvoie sur l’index courant
      const { error } = await state.sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo || fallback, shouldCreateUser: true }
      });
      return { error };
    },
    async verifyEmailOtp(email, token) {
      assertClient();
      const { error, data } = await state.sb.auth.verifyOtp({ email, token, type: "email" });
      return { error, data };
    },
    async signOut() { assertClient(); await state.sb.auth.signOut(); },

    // Lecture DB -> mémoire
    async refresh() {
      const u = await _getUser();
      if (!u) { state.tasks = []; return state.tasks; }
      const { data, error } = await state.sb
        .from("tasks")
        .select("*")
        .eq("user_id", u.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      state.tasks = Array.isArray(data) ? data : [];
      // Si ton UI a une fonction renderTasks, déclenche-la :
      if (global.Motivathon?.renderTasks) {
        try { global.Motivathon.tasks = state.tasks.slice(); } catch {}
        try { global.Motivathon.renderTasks(); } catch {}
      }
      return state.tasks;
    },

    // Liste en mémoire
    listTasks() { return state.tasks; },
    listHistory() { return []; }, // ajoute une table history plus tard si besoin

    // Écriture : DB d’abord, puis refresh
    async upsertTask(task) {
      const u = await _getUser();
      if (!u) throw new Error("Non connecté");
      const id = task.id && isUuid(task.id) ? task.id : newUuid();
      const payload = sanitizeTask({ ...task, id }, u.id);
      const { error } = await state.sb.from("tasks").upsert(payload, { returning: "minimal" });
      if (error) throw error;
      return await Data.refresh();
    },

    setTaskDone(id, done) {
      (async () => {
        const u = await _getUser(); if (!u) throw new Error("Non connecté");
        const { error } = await state.sb
          .from("tasks")
          .update({ done: !!done, updated_at: new Date().toISOString() })
          .eq("id", id).eq("user_id", u.id);
        if (error) { console.warn("[Data] setTaskDone fail", error); return; }
        await Data.refresh();
      })();
    },

    // Realtime (optionnel)
    onRealtime(cb) {
      if (!state.sb) return () => {};
      try { if (state.channel) state.sb.removeChannel(state.channel); } catch {}
      state.channel = state.sb.channel("tasks-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, async () => {
          await Data.refresh();
          if (typeof cb === "function") try { cb(); } catch {}
        })
        .subscribe();
      return () => { try { state.sb.removeChannel(state.channel); } catch {} };
    }
  };

  global.Data = Data;
})(window);
