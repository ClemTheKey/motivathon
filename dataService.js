/* dataService.js — DB-ready data layer for Motivathon
 * Default: localStorage (sync) to avoid breaking current app.js.
 * Later: switch to Supabase by turning on the async impl (instructions inside).
 */
(function(global){
  const LS_KEYS = { tasks: "motivathon_tasks", history: "motivathon_history" };

  function safeParse(s, def) {
    try { return JSON.parse(s ?? def); } catch(e){ return JSON.parse(def); }
  }
  function getLS(key, def="[]"){ return safeParse(localStorage.getItem(key), def); }
  function setLS(key, val){ try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){} }

  // ---- SYNC API (compatible with existing app.js) ----
  const Data = {
    // Init is a no-op in local mode
    init: function(){ /* no-op for local */ },

    // Returns arrays synchronously (important for current app.js design)
    listTasks: function(){ return getLS(LS_KEYS.tasks); },
    listHistory: function(){ return getLS(LS_KEYS.history); },

    saveTasks: function(list){ setLS(LS_KEYS.tasks, list); },
    saveHistory: function(list){ setLS(LS_KEYS.history, list); },

    setTaskDone: function(id, done){
      const list = getLS(LS_KEYS.tasks);
      const i = list.findIndex(t => t && t.id === id);
      if (i >= 0){ list[i].done = !!done; setLS(LS_KEYS.tasks, list); }
    },

    // Placeholder: realtime callback (no-op in local mode)
    onRealtime: function(/*cb*/){ /* no-op */ }
  };

  // Expose
  global.Data = Data;

  /* -----------------------------------------
   * To enable Supabase later (async flows):
   * - Convert callers in app.js to await Data.listTasks(), Data.upsertTask(), Data.setDone()
   * - Replace local methods with async versions using Supabase client
   * - Keep localStorage as fallback if user not logged in
   * ----------------------------------------- */
})(window);
