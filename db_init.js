/* db_init.js — optional bootstrap for Motivathon + Supabase
 * Include this after dataService.js and before/after app.js as you prefer.
 * It initializes Data, refreshes from DB (if configured), and re-renders Motivathon.
 */
(async function(){
  try {
    if (!window.Data) return;
    await window.Data.init();
    await window.Data.refresh();
    window.Data.onRealtime(() => {
      // already re-renders in refresh()
    });
  } catch(e){
    console.warn("[db_init] bootstrap failed:", e);
  }
})();
