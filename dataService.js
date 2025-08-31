/* dataService.js — ONLINE ONLY (Supabase requis) */
(function (global) {
  var state = { sb: null, channel: null, tasks: [] };

  /* ========= Helpers ========= */
  function isUuid(v) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
  }
  function newUuid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  function sanitizeTask(t, user_id) {
    return {
      id: t.id,
      title: t.title != null ? t.title : "",
      category: t.category != null ? t.category : null,
      period: t.period != null ? t.period : null,
      xp: typeof t.xp === "number" ? t.xp : 0,
      done: !!t.done,
      user_id: user_id
    };
  }
  async function _getUserSafe() {
    if (!state.sb) return null;
    var res = await state.sb.auth.getSession();
    var sErr = res.error;
    var session = res.data && res.data.session;
    if (sErr) {
      var msg = String(sErr.message || "").toLowerCase();
      if (msg.indexOf("auth session missing") >= 0) return null;
      console.warn("[auth] getSession error:", sErr);
      return null;
    }
    if (!session) return null;
    return session.user || null;
  }

  /* ========= API ========= */
  var Data = {
    async init() {
      var env = global.__ENV__ || {};
      var SUPABASE_URL = env.SUPABASE_URL;
      var SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
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

    /* ----- Auth ----- */
    async getUser() {
      try { return await _getUserSafe(); }
      catch (e) { console.warn("[auth] getUser error:", e); return null; }
    },
    async signInWithEmail(email, redirectTo) {
      if (!state.sb) throw new Error("Supabase non initialisé");
      var fallback = location.origin + location.pathname; // renvoie sur l'index courant
      var resp = await state.sb.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: redirectTo || fallback, shouldCreateUser: true }
      });
      return { error: resp.error || null };
    },
    async verifyEmailOtp(email, token) {
      if (!state.sb) throw new Error("Supabase non initialisé");
      var resp = await state.sb.auth.verifyOtp({ email: email, token: token, type: "email" });
      return { error: resp.error || null, data: resp.data || null };
    },
    async signOut() {
      if (!state.sb) return;
      await state.sb.auth.signOut();
      state.tasks = [];
    },

    /* ----- Lecture DB -> mémoire ----- */
    async refresh() {
      var u = await _getUserSafe();
      if (!u || !state.sb) {
        state.tasks = [];
        if (global.Motivathon && typeof global.Motivathon.renderTasks === "function") {
          try { global.Motivathon.tasks = state.tasks.slice(); } catch (e) {}
          try { global.Motivathon.renderTasks(); } catch (e2) {}
        }
        return state.tasks;
      }
      var q = await state.sb
        .from("tasks")
        .select("*")
        .eq("user_id", u.id)
        .order("created_at", { ascending: true });
      if (q.error) throw q.error;
      state.tasks = Array.isArray(q.data) ? q.data : [];
      if (global.Motivathon && typeof global.Motivathon.renderTasks === "function") {
        try { global.Motivathon.tasks = state.tasks.slice(); } catch (e3) {}
        try { global.Motivathon.renderTasks(); } catch (e4) {}
      }
      return state.tasks;
    },

    /* ----- Accès mémoire ----- */
    listTasks() { return state.tasks; },
    listHistory() { return []; },

    /* ----- Écritures (DB d'abord, puis refresh) ----- */
    async upsertTask(task) {
      var u = await _getUserSafe();
      if (!u) throw new Error("Non connecté");
      var id = task.id && isUuid(task.id) ? task.id : newUuid();
      var payload = sanitizeTask(Object.assign({}, task, { id: id }), u.id);
      var r = await state.sb.from("tasks").upsert(payload, { returning: "minimal" });
      if (r.error) throw r.error;
      return await Data.refresh();
    },

    setTaskDone(id, done) {
      (async function () {
        var u = await _getUserSafe(); if (!u) return;
        var r = await state.sb
          .from("tasks")
          .update({ done: !!done, updated_at: new Date().toISOString() })
          .eq("id", id).eq("user_id", u.id);
        if (r.error) { console.warn("[Data] setTaskDone fail", r.error); return; }
        await Data.refresh();
      })();
    },

    /* ----- Realtime (optionnel) ----- */
    onRealtime(cb) {
      if (!state.sb) return function () {};
      try { if (state.channel) state.sb.removeChannel(state.channel); } catch (e) {}
      state.channel = state.sb.channel("tasks-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, async function () {
          await Data.refresh();
          if (typeof cb === "function") { try { cb(); } catch (e2) {} }
        })
        .subscribe();
      return function () { try { state.sb.removeChannel(state.channel); } catch (e3) {} };
    }
  };

  global.Data = Data;
})(window);
