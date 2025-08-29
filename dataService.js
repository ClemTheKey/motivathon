/* dataService.js — Supabase + fallback localStorage (Motivathon)
 * Expose a mostly-sync API using an internal cache, so existing app.js keeps working.
 * - Data.init(): async (sets up Supabase client if env vars are present)
 * - Data.listTasks(): sync (returns cached list)
 * - Data.saveTasks(list): sync (updates cache + localStorage; DB updated via upsert when possible)
 * - Data.refresh(): async (fetches from DB, updates cache + localStorage, triggers optional render)
 * - Data.upsertTask(t), Data.setTaskDone(id,done): async (update DB; fallback to localStorage if no auth/DB)
 * - Data.onRealtime(cb): calls cb() on DB changes; we also auto-refresh + re-render
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
      // Ensure Motivathon uses the latest cache
      try { global.Motivathon.tasks = state.cacheTasks.slice(); } catch(e){}
      try { global.Motivathon.renderTasks(); } catch(e){ console.warn("[Data] renderTasks error:", e); }
    }
  }

  async function getUser(){ if(!state.sb) return null; const { data:{ user } } = await state.sb.auth.getUser(); return user||null; }

  const Data = {
    // ----- lifecycle -----
    async init(){
      const env = global.__ENV__ || {};
      const { SUPABASE_URL, SUPABASE_ANON_KEY } = env;
      if (!global.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.info("[Data] Supabase not configured → localStorage only");
        return;
      }
      state.sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth:{ persistSession:true, autoRefreshToken:true } });
    },
    // Returns cached arrays synchronously
    listTasks(){ return state.cacheTasks; },
    listHistory(){ return state.cacheHistory; },
    saveTasks(list){
      state.cacheTasks = Array.isArray(list) ? list.slice() : [];
      LS.set(LS.tasksKey, state.cacheTasks);
    },
    saveHistory(list){
      state.cacheHistory = Array.isArray(list) ? list.slice() : [];
      LS.set(LS.historyKey, state.cacheHistory);
    },
    setTaskDone(id, done){
      const i = state.cacheTasks.findIndex(t => t && t.id === id);
      if (i >= 0){ state.cacheTasks[i].done = !!done; LS.set(LS.tasksKey, state.cacheTasks); }
      // Fire-and-forget to DB if possible
      (async () => {
        const u = await getUser(); if (!u || !state.sb) return;
        try {
          await state.sb.from("tasks")
            .update({ done: !!done, updated_at: new Date().toISOString() })
            .eq("id", id).eq("user_id", u.id);
        } catch(e){ console.warn("[Data] setTaskDone DB fallback to local:", e); }
      })();
    },
    async upsertTask(task){
      // Update cache immediately for good UX
      if (!task.id) task.id = (global.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now()+"-"+Math.random());
      const idx = state.cacheTasks.findIndex(t => t && t.id === task.id);
      if (idx >= 0) state.cacheTasks[idx] = { ...state.cacheTasks[idx], ...task };
      else state.cacheTasks.push(task);
      LS.set(LS.tasksKey, state.cacheTasks);

      // Try DB
      const u = await getUser(); if (!u || !state.sb) return task;
      const payload = { ...task, user_id: u.id };
      if (!payload.id) delete payload.id;
      const { data, error } = await state.sb.from("tasks").upsert(payload).select().maybeSingle();
      if (error) { console.warn("[Data] upsertTask DB failed → kept local", error); return task; }
      // Merge returned row (ensures timestamps, etc.)
      const saved = data || task;
      const i2 = state.cacheTasks.findIndex(t => t && t.id === saved.id);
      if (i2 >= 0) state.cacheTasks[i2] = { ...state.cacheTasks[i2], ...saved };
      else state.cacheTasks.push(saved);
      LS.set(LS.tasksKey, state.cacheTasks);
      return saved;
    },
    async refresh(){
      const u = await getUser(); if (!u || !state.sb) {
        // keep local cache
        renderIfAvailable();
        return state.cacheTasks;
      }
      try {
        const { data, error } = await state.sb.from("tasks").select("*").order("created_at",{ascending:true});
        if (error) throw error;
        state.cacheTasks = Array.isArray(data) ? data : [];
        LS.set(LS.tasksKey, state.cacheTasks);
        renderIfAvailable();
        return state.cacheTasks;
      } catch(e){
        console.warn("[Data] refresh DB failed → using local cache", e);
        renderIfAvailable();
        return state.cacheTasks;
      }
    },
    onRealtime(cb){
      if (!state.sb) return () => {};
      // Unsubscribe previous channel if any
      try { if (state.channel) state.sb.removeChannel(state.channel); } catch(e){}
      state.channel = state.sb.channel("tasks-realtime")
        .on("postgres_changes", { event:"*", schema:"public", table:"tasks" }, async () => {
          await Data.refresh();
          if (typeof cb === "function") try { cb(); } catch(e){}
        })
        .subscribe();
      return () => { try { state.sb.removeChannel(state.channel); } catch(e){} };
    },
    // ----- Auth helpers -----
    async signInWithEmail(email){
      if (!state.sb) return { error: "Supabase not configured" };
      const { error } = await state.sb.auth.signInWithOtp({ email });
      return { error };
    },
    async getUser(){ return await getUser(); },
    async signOut(){
      if (!state.sb) return;
      await state.sb.auth.signOut();
    }
  };

  global.Data = Data;
})(window);
