/* dataService.js — Online only (Supabase required) */
(function (global) {
  const state = { sb: null, channel: null, tasks: [] };

  function assertClient() {
    if (!state.sb) throw new Error("Supabase non initialisé");
  }

  async function _getUser() {
    assertClient();
    const { data: { user }, error } = await state.sb.auth.getUser();
    if (error) throw error;
    return user || null;
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

  function isUuid(v) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
  }
  function newUuid() {
    if (global.crypto?.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = (Math.random()*16)|0, v = c === "x" ? r : (r&0x3)|0x8; return v.toString(16);
    });
  }

  const Data = {
    // Crée un client unique + parse les magic links
    async init() {
      const env = global.__ENV__ || {};
      if (!global.supabase || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
        throw new Error("Config Supabase manquante");
      }
      if (state.sb) return;

      state.sb = global.supabase.createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "sb-motivathon-auth"
        }
      });
    },

    async getUser() { return await _getUser(); },

    // Lecture DB -> mémoire (aucun localStorage)
    async refresh() {
      const u = await _getUser();
      if (!u) { state.tasks = []; return state.tasks; }
      const { data, error } = await state.sb
        .from("tasks").select("*")
        .eq("user_id", u.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      state.tasks = Array.isArray(data) ? data : [];
      return state.tasks;
    },

    // Liste (depuis mémoire)
    listTasks() { return state.tasks; },
    listHistory() { return []; },          // (si tu as une table history, on l’ajoutera)

    // Écriture: DB d'abord, puis refresh
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
        const { error } = await state.sb.from("tasks")
          .update({ done: !!done, updated_at: new Date().toISOString() })
          .eq("id", id).eq("user_id", u.id);
        if (error) { console.warn("[Data] setTaskDone fail", error); return; }
        await Data.refresh();
      })();
    },

    // Realtime (optionnel, on le laisse prêt)
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
    },

    // Auth
    async signInWithEmail(email, redirectTo) {
      assertClient();
      const fallback = location.origin + location.pathname; // renvoie sur l’index actuel
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
    async signOut() { assertClient(); await state.sb.auth.signOut(); }
  };

  global.Data = Data;
})(window);
