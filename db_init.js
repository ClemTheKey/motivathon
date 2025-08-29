// db_init.js — bootstrap 100% tolérant
(async () => {
  try {
    if (!window.Data) {
      console.info("[db_init] Data non présent (ok).");
      return;
    }

    if (typeof Data.init === "function") {
      await Data.init();
    }

    if (typeof Data.refresh === "function") {
      await Data.refresh();
    }

    if (typeof Data.onRealtime === "function") {
      // On s'abonne seulement si la méthode existe
      Data.onRealtime(async () => {
        if (typeof Data.refresh === "function") {
          await Data.refresh();
        }
      });
    } else {
      console.info("[db_init] onRealtime absent (normal si local).");
    }
  } catch (e) {
    console.warn("[db_init] bootstrap failed:", e);
  }
})();
