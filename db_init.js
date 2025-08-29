// db_init.js — bootstrap tolérant (ne plante pas si certaines méthodes manquent)
(async () => {
  try {
    if (!window.Data) {
      console.warn("[db_init] window.Data manquant");
      return;
    }

    if (typeof Data.init === "function") {
      await Data.init();
    }

    if (typeof Data.refresh === "function") {
      await Data.refresh();
    }

    if (typeof Data.onRealtime === "function") {
      Data.onRealtime(async () => {
        if (typeof Data.refresh === "function") {
          await Data.refresh();
        }
      });
    } else {
      console.info("[db_init] onRealtime non disponible — ignoré");
    }
  } catch (e) {
    console.warn("[db_init] bootstrap failed:", e);
  }
})();
