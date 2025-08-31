// db_init.js — Online-only bootstrap
(async () => {
  try {
    await Data.init();
    const user = await Data.getUser();
    if (user) {
      await Data.refresh();
      // (optionnel) Data.onRealtime(() => {});
    }
  } catch (e) {
    console.warn("[db_init] bootstrap:", e);
  }
})();
