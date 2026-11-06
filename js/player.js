(() => {
  const NAME_KEY = "sdz3_player_name";
  const ID_KEY = "sdz3_player_key";
  const config = window.SDZ_CONFIG || {};
  const url = (config.supabaseUrl || "").trim().replace(/\/$/, "");
  const key = (config.supabaseAnonKey || "").trim();

  let pendingResolve = null;

  function uid() {
    try {
      if (crypto.randomUUID) return crypto.randomUUID();
    } catch (_) {
      /* ignore */
    }
    return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function storageGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (_) {
      return null;
    }
  }

  function storageSet(k, v) {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch (_) {
      return false;
    }
  }

  function getKey() {
    let id = storageGet(ID_KEY);
    if (!id) {
      id = uid();
      storageSet(ID_KEY, id);
    }
    return id;
  }

  function getName() {
    return (storageGet(NAME_KEY) || "").trim();
  }

  function setName(name) {
    const clean = String(name || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 24);
    if (clean.length < 2) return false;
    if (!storageSet(NAME_KEY, clean)) return false;
    window.dispatchEvent(new CustomEvent("sdz-name-updated", { detail: { name: clean } }));
    return true;
  }

  function headers() {
    return {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
  }

  async function submitScore(game, score) {
    const name = getName();
    if (!name || !url || !key) return null;
    try {
      const res = await fetch(`${url}/rest/v1/rpc/upsert_leaderboard_score`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          p_player_key: getKey(),
          p_player_name: name,
          p_game: game,
          p_score: Math.round(Number(score) || 0),
        }),
      });
      if (!res.ok) throw new Error(`score ${res.status}`);
      const data = await res.json();
      window.dispatchEvent(new CustomEvent("sdz-score-updated"));
      return data;
    } catch (err) {
      console.warn("SDZ ranking:", err);
      return null;
    }
  }

  async function fetchLeaderboard() {
    if (!url || !key) return [];
    try {
      const res = await fetch(
        `${url}/rest/v1/leaderboard?select=player_name,quiz_best,trail_best,pack_best,updated_at&order=updated_at.desc&limit=100`,
        { headers: headers() }
      );
      if (!res.ok) throw new Error(`lb ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn("SDZ ranking fetch:", err);
      return [];
    }
  }

  function ensureModal() {
    let modal = document.getElementById("name-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "name-modal";
    modal.className = "name-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="name-modal-card" role="dialog" aria-modal="true" aria-labelledby="name-modal-title">
        <p class="eyebrow">Antes de começar</p>
        <h3 id="name-modal-title">Qual é o seu nome?</h3>
        <p class="name-modal-lede">Esse nome aparece no ranking online do Níver SZ.</p>
        <form id="name-form" action="#">
          <label class="name-label" for="name-input">Seu nome</label>
          <input id="name-input" name="player_name" type="text" maxlength="24" minlength="2"
            autocomplete="name" inputmode="text" enterkeyhint="done"
            placeholder="Ex.: Gabi" required />
          <p id="name-error" class="name-error" hidden>Digite pelo menos 2 letras.</p>
          <button type="submit" id="name-submit" class="btn btn-primary">Salvar e continuar</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    wireModal(modal);
    return modal;
  }

  function showError(show) {
    const err = document.getElementById("name-error");
    if (err) err.hidden = !show;
  }

  function closeModal(modal, name) {
    modal.hidden = true;
    modal.classList.remove("is-open");
    document.body.classList.remove("name-modal-open");
    showError(false);
    const resolve = pendingResolve;
    pendingResolve = null;
    if (resolve) resolve(name);
  }

  function trySaveFromInput(input) {
    const ok = setName(input && input.value);
    if (!ok) {
      showError(true);
      if (input) input.focus();
      return null;
    }
    showError(false);
    return getName();
  }

  function wireModal(modal) {
    if (modal.dataset.wired === "1") return;
    modal.dataset.wired = "1";
    const form = modal.querySelector("#name-form");
    const input = modal.querySelector("#name-input");
    const btn = modal.querySelector("#name-submit");

    // Garante que o campo aceita toque/teclado no mobile.
    if (input) {
      input.removeAttribute("readonly");
      input.removeAttribute("disabled");
      input.setAttribute("autocomplete", "name");
      input.addEventListener("touchstart", (e) => {
        e.stopPropagation();
        input.focus();
      }, { passive: true });
      input.addEventListener("click", (e) => {
        e.stopPropagation();
        input.focus();
      });
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const name = trySaveFromInput(input);
      if (!name) return;
      closeModal(modal, name);
    });

    if (btn) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const name = trySaveFromInput(input);
        if (!name) return;
        closeModal(modal, name);
      });
    }

    // Não fecha ao tocar no fundo — evita perder o foco no teclado mobile.
    modal.addEventListener("click", (e) => {
      if (e.target === modal) e.stopPropagation();
    });
  }

  function askName(opts = {}) {
    const force = Boolean(opts.force);
    return new Promise((resolve) => {
      const existing = getName();
      if (existing && !force) {
        resolve(existing);
        return;
      }
      const modal = ensureModal();
      const input = modal.querySelector("#name-input");
      pendingResolve = resolve;
      if (input) {
        input.value = existing || "";
        input.removeAttribute("readonly");
        input.removeAttribute("disabled");
      }
      showError(false);
      modal.hidden = false;
      modal.classList.add("is-open");
      document.body.classList.add("name-modal-open");
      // Só foca; NÃO usa select() — no iOS isso trava o teclado.
      requestAnimationFrame(() => {
        try {
          input?.focus({ preventScroll: false });
        } catch (_) {
          input?.focus();
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("name-modal");
    if (modal) wireModal(modal);
  });
  if (document.readyState !== "loading") {
    const modal = document.getElementById("name-modal");
    if (modal) wireModal(modal);
  }

  window.SDZ_PLAYER = {
    getName,
    getKey,
    setName,
    askName,
    submitScore,
    fetchLeaderboard,
    online: Boolean(url && key),
  };
})();
