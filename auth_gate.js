// auth_gate.js — Auth obligatoire (mail link + OTP), robuste iOS/Safari
(function () {
  const RETRY_MS = 150;
  const RETRY_WINDOW = 4000; // réessaie jusqu'à 4s
  const until = Date.now() + RETRY_WINDOW;

  const $ = (id) => document.getElementById(id);

  // URLs de redirection autorisées (doivent exister aussi dans Supabase → Auth → URL Configuration)
  const ALLOWED_REDIRECTS = [
    "https://clemthekey.github.io/motivathon/index.html",
    "https://clemthekey.github.io/motivathon/"
  ];

  function pickRedirect() {
    // On privilégie l'index.html (plus sûr sur GitHub Pages de projet)
    return ALLOWED_REDIRECTS[0];
  }

  async function ensureDataReady() {
    if (!window.Data) {
      if (Date.now() < until) return new Promise(r => setTimeout(() => r(ensureDataReady()), RETRY_MS));
      throw new Error("Data non chargé (vérifie l'ordre des scripts)");
    }
    try { await Data.init?.(); } catch (e) { /* ignore */ }
  }

  async function getUserSafe() {
    try { return await Data.getUser?.(); } catch { return null; }
  }

  async function showGateBasedOnSession(gate, msg) {
    try {
      await ensureDataReady();
      const u = await getUserSafe();
      if (u) {
        gate.style.display = "none";
        await Data.refresh?.();
      } else {
        gate.style.display = "flex";
        if (msg) { msg.textContent = ""; msg.style.color = "#555"; }
      }
    } catch (e) {
      console.warn("[gate] init/session:", e);
      gate.style.display = "flex";
      if (msg) { msg.textContent = "Erreur d'initialisation de l'auth."; msg.style.color = "#c00"; }
    }
  }

  function attachHandlers() {
    const gate    = $("gate");
    const emailEl = $("authEmail");
    const codeEl  = $("authCode");
    const sendBtn = $("authSend");
    const verifyBtn = $("authVerify");
    const msg     = $("authMsg");

    if (!gate || !emailEl || !sendBtn || !msg || !window.Data) {
      if (Date.now() < until) return void setTimeout(attachHandlers, RETRY_MS);
      console.warn("[gate] éléments manquants ou Data indisponible:", {
        gate: !!gate, emailEl: !!emailEl, sendBtn: !!sendBtn, msg: !!msg, Data: !!window.Data
      });
      return;
    }

    // 1) Afficher/masquer le gate selon session
    showGateBasedOnSession(gate, msg);

    // 2) Envoi lien/code
    sendBtn.addEventListener("click", async () => {
      const email = (emailEl.value || "").trim();

      msg.textContent = "";
      msg.style.color = "#555";

      if (!email) {
        msg.textContent = "Entre un e-mail.";
        msg.style.color = "#c00";
        return;
      }

      sendBtn.disabled = true;
      sendBtn.textContent = "Envoi…";
      sendBtn.style.opacity = "0.7";

      try {
        await ensureDataReady();

        // On passe emailRedirectTo uniquement si whitelistée
        const redirect = pickRedirect();
        const target = ALLOWED_REDIRECTS.includes(redirect) ? redirect : undefined;

        const { error } = await Data.signInWithEmail?.(email, target);
        console.log("[auth] otp:", error ? { status: error.status, message: error.message } : "OK");

        if (error) {
          msg.textContent = "Erreur: " + (error.message || String(error));
          msg.style.color = "#c00";
        } else {
          msg.textContent = "Lien/code envoyé. Vérifie ta boîte mail.";
          msg.style.color = "#0a0";
        }
      } catch (e) {
        console.warn("[auth] send error:", e);
        msg.textContent = "Erreur: " + (e.message || String(e));
        msg.style.color = "#c00";
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = "Envoyer le lien";
        sendBtn.style.opacity = "1";
      }
    });

    // 3) Vérification OTP (code 6 chiffres)
    verifyBtn?.addEventListener("click", async () => {
      const email = (emailEl.value || "").trim();
      const token = (codeEl?.value || "").trim();

      if (!email || !token) {
        msg.textContent = "Entre l’e-mail ET le code.";
        msg.style.color = "#c00";
        return;
      }

      msg.textContent = "Vérification…";
      msg.style.color = "#555";

      try {
        await ensureDataReady();
        const { error } = await Data.verifyEmailOtp?.(email, token);

        if (error) {
          msg.textContent = "Erreur: " + (error.message || String(error));
          msg.style.color = "#c00";
          return;
        }

        msg.textContent = "Connecté ✔︎";
        msg.style.color = "#0a0";

        await Data.refresh?.();
        gate.style.display = "none";

        // Nettoie l'URL si un hash traînait
        try { history.replaceState({}, document.title, location.pathname + location.search); } catch {}
      } catch (e) {
        console.warn("[auth] verify error:", e);
        msg.textContent = "Erreur: " + (e.message || String(e));
        msg.style.color = "#c00";
      }
    });

    // Enter déclenche la vérification OTP si focus dans #authCode
    codeEl?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        verifyBtn?.click();
      }
    });

    // 4) Magic link (hash #access_token) — laisser le SDK l'ingérer avant nettoyage
    (async function handleMagicLink() {
      if (!location.hash) return;
      const hasToken = /access_token=|refresh_token=|type=recovery/.test(location.hash);
      if (!hasToken) return;

      try {
        await ensureDataReady();
        // Micro-pause pour laisser supabase-js persister la session
        await new Promise(r => setTimeout(r, 0));
        const u = await getUserSafe();

        if (u) {
          await Data.refresh?.();
          gate.style.display = "none";
          // Nettoie l’URL une fois la session confirmée
          try { history.replaceState({}, document.title, location.pathname + location.search); } catch {}
        } else {
          console.warn("[gate] Pas d'utilisateur après magic link — hash conservé");
        }
      } catch (e) {
        console.warn("[gate] magic link error:", e);
      }
    })();

    // 5) Expose quelques helpers pour debug
    window.AuthUI = {
      async status() {
        try { await ensureDataReady(); return await getUserSafe(); }
        catch (e) { return { error: String(e) }; }
      },
      open()  { gate && (gate.style.display = "flex"); },
      close() { gate && (gate.style.display = "none"); }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachHandlers, { once: true });
  } else {
    attachHandlers();
  }
})();
