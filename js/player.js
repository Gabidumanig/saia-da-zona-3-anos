(() => {
  const NAME_KEY = "sdz3_player_name";
  const ID_KEY = "sdz3_player_key";
  const config = window.SDZ_CONFIG || {};
  const url = (config.supabaseUrl || "").trim().replace(/\/$/, "");
  const key = (config.supabaseAnonKey || "").trim();

  function uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function getKey() {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = uid();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  }

  function getName() {
    return (localStorage.getItem(NAME_KEY) || "").trim();
  }

  function setName(name) {
    const clean = String(name || "").trim().slice(0, 24);
    if (clean.length < 2) return false;
    localStorage.setItem(NAME_KEY, clean);
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
        <h3 id="name-modal-title">Como te chamas?</h3>
        <p class="name-modal-lede">Teu nome entra no ranking online do Níver SZ.</p>
        <form id="name-form">
          <input id="name-input" type="text" maxlength="24" autocomplete="nickname" placeholder="Seu nome" required />
          <button type="submit" class="btn btn-primary">Continuar</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function askName() {
    return new Promise((resolve) => {
      const existing = getName();
      if (existing) {
        resolve(existing);
        return;
      }
      const modal = ensureModal();
      const form = modal.querySelector("#name-form");
      const input = modal.querySelector("#name-input");
      modal.hidden = false;
      setTimeout(() => input.focus(), 50);

      function onSubmit(e) {
        e.preventDefault();
        if (!setName(input.value)) {
          input.focus();
          return;
        }
        form.removeEventListener("submit", onSubmit);
        modal.hidden = true;
        resolve(getName());
      }
      form.addEventListener("submit", onSubmit);
    });
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
