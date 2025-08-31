// auth_gate.js — Affiche un "gate" tant qu'on n'est pas connecté
(function () {
  const $ = (id) => document.getElementById(id);
  const gate = $("gate"), emailEl = $("authEmail"), codeEl = $("authCode");
  const sendBtn = $("authSend"), verifyBtn = $("authVerify"), msg = $("authMsg");

  async function showGateIfNeeded() {
    try {
      await Data.init();
      const u = await Data.getUser();
      if (u) {
        gate.style.display = "none";
        await Data.refresh();
      } else {
        gate.style.display = "flex";
      }
    } catch (e) {
      console.warn("[gate] error:", e);
      gate.style.display = "flex";
    }
  }

  sendBtn?.addEventListener("click", async () => {
    const email = (emailEl.value || "").trim();
    if (!email) { msg.textContent = "Entre un e-mail."; return; }
    msg.textContent = "Envoi en cours…";
    const { error } = await Data.signInWithEmail(email, location.origin + location.pathname);
    msg.textContent = error ? "Erreur: " + error.message : "Lien/code envoyé. Consulte ta boîte mail.";
  });

  verifyBtn?.addEventListener("click", async () => {
    const email = (emailEl.value || "").trim();
    const token = (codeEl.value || "").trim();
    if (!email || !token) { msg.textContent = "Entre l’e-mail ET le code."; return; }
    msg.textContent = "Vérification…";
    const { error } = await Data.verifyEmailOtp(email, token);
    if (error) { msg.textContent = "Erreur: " + error.message; return; }
    msg.textContent = "Connecté ✔︎";
    await Data.refresh();
    gate.style.display = "none";
  });

  // Magic link: laisser Supabase traiter le hash avant de le nettoyer
  (async function handleMagic() {
    if (!location.hash) return;
    const hasToken = /access_token=|refresh_token=|type=recovery/.test(location.hash);
    if (!hasToken) return;
    try {
      await Data.init();
      await new Promise(r => setTimeout(r, 0));
      const u = await Data.getUser();
      if (u) {
        await Data.refresh();
        history.replaceState({}, document.title, location.pathname + location.search);
      }
    } catch (e) {
      console.warn("[gate] magic:", e);
    }
  })();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showGateIfNeeded, { once: true });
  } else {
    showGateIfNeeded();
  }
})();
