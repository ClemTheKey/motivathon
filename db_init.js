// db_init.js — bootstrap safe
(async () => {
  try {
    if (!window.Data) return;

    await Data.init?.();

    const user = await Data.getUser?.();
    if (user) {
      // On autorise la migration local → DB au premier refresh
      await Data.refresh?.({ migrate: true });
    } else {
      // Non connecté : on n'appelle pas refresh, on laisse le local tel quel
      // et l'app continue à fonctionner hors-ligne.
    }

    // Realtime si dispo
    if (typeof Data.onRealtime === "function") {
      Data.onRealtime(async () => { await Data.refresh?.({ migrate: false }); });
    }
  } catch (e) {
    console.warn("[db_init] bootstrap failed:", e);
  }
})();
