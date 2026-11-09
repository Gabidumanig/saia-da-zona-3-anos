(() => {
  const SCORE_KEY = {
    quiz: "quiz_best",
    trail: "trail_best",
    pack: "pack_best",
  };

  const UNIT = {
    quiz: (n) => `${n} pts`,
    trail: (n) => `${n} m`,
    pack: (n) => `${n} itens`,
  };

  const FALLBACK_AVATARS = [
    { id: "franz", name: "Franz", src: "assets/avatars/franz-v6.svg?v=85" },
    { id: "diego", name: "Diego", src: "assets/avatars/diego-v6.svg?v=85" },
    { id: "gabi", name: "Gabi", src: "assets/avatars/gabi-v6.svg?v=85" },
    { id: "jin", name: "Jin", src: "assets/avatars/jin-v6.svg?v=85" },
    { id: "caio", name: "Caio", src: "assets/avatars/caio-v7.svg?v=85" },
    { id: "matheus", name: "Matheus", src: "assets/avatars/matheus-v6.svg?v=85" },
  ];

  let rows = [];

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function scoreOf(row, game) {
    return Number(row[SCORE_KEY[game]] || 0);
  }

  function avatarById(id) {
    const list = window.SDZ_TRAIL_GAME?.AVATARS || FALLBACK_AVATARS;
    return list.find((a) => a.id === id) || null;
  }

  function trailAvatarHtml(row) {
    const avatar = avatarById(row.trail_avatar);
    if (!avatar) {
      return `<span class="rank-avatar rank-avatar-empty" aria-hidden="true"></span>`;
    }
    return `<img class="rank-avatar" src="${escapeHtml(avatar.src)}" alt="${escapeHtml(avatar.name)}" title="${escapeHtml(avatar.name)}" width="32" height="36" />`;
  }

  function renderBoard(game) {
    const root = document.querySelector(`.game-board[data-board="${game}"]`);
    if (!root) return;
    const listEl = root.querySelector("[data-board-list]");
    const statusEl = root.querySelector("[data-board-status]");
    const me = window.SDZ_PLAYER?.getName?.() || "";
    const sorted = [...rows]
      .filter((r) => scoreOf(r, game) > 0)
      .sort((a, b) => scoreOf(b, game) - scoreOf(a, game))
      .slice(0, 30);

    if (statusEl) {
      statusEl.textContent = window.SDZ_PLAYER?.online
        ? `${sorted.length} no placar`
        : "Placar offline";
    }

    if (!listEl) return;
    if (!sorted.length) {
      listEl.innerHTML = `<p class="ranking-empty">Ninguém jogou ainda. Seja o primeiro!</p>`;
      return;
    }

    const withAvatar = game === "trail";
    listEl.classList.toggle("has-avatars", withAvatar);

    listEl.innerHTML = sorted
      .map((row, i) => {
        const isMe = me && row.player_name === me;
        const avatarCell = withAvatar ? trailAvatarHtml(row) : "";
        const nameBlock = withAvatar
          ? `<span class="rank-who">${avatarCell}<strong class="rank-name">${escapeHtml(row.player_name)}</strong></span>`
          : `<strong class="rank-name">${escapeHtml(row.player_name)}</strong>`;
        return `
          <div class="rank-row${withAvatar ? " has-avatar" : ""}${isMe ? " is-me" : ""}${i === 0 ? " is-lead" : ""}">
            <span class="rank-pos">${i + 1}º</span>
            ${nameBlock}
            <span class="rank-score">${UNIT[game](scoreOf(row, game))}</span>
          </div>
        `;
      })
      .join("");
  }

  function syncNameForms() {
    const me = window.SDZ_PLAYER?.getName?.() || "";
    document.querySelectorAll(".game-name-form").forEach((form) => {
      const input = form.querySelector("input");
      const hint = form.querySelector("[data-name-hint]");
      if (input && me && input.value !== me) input.value = me;
      if (hint) {
        hint.textContent = me
          ? `Jogando como ${me}`
          : "Coloca teu nome antes de jogar.";
        hint.classList.toggle("is-ok", Boolean(me));
      }
    });
  }

  function focusNameInView(viewName) {
    const map = { quiz: "name-input-quiz", trail: "name-input-trail", pack: "name-input-pack" };
    const input = document.getElementById(map[viewName]);
    if (!input) return;
    input.focus();
    const form = input.closest(".game-name-form");
    const hint = form?.querySelector("[data-name-hint]");
    if (hint) {
      hint.textContent = "Digite e salve teu nome pra jogar.";
      hint.classList.remove("is-ok");
    }
  }

  function requireName(viewName) {
    const name = window.SDZ_PLAYER?.getName?.() || "";
    if (name) return true;
    focusNameInView(viewName);
    return false;
  }

  async function refresh() {
    rows = (await window.SDZ_PLAYER?.fetchLeaderboard?.()) || [];
    syncNameForms();
    ["quiz", "trail", "pack"].forEach(renderBoard);
  }

  document.querySelectorAll(".game-name-form").forEach((form) => {
    const input = form.querySelector("input");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const ok = window.SDZ_PLAYER?.setName?.(input?.value || "");
      const hint = form.querySelector("[data-name-hint]");
      if (!ok) {
        if (hint) {
          hint.textContent = "Digite pelo menos 2 letras.";
          hint.classList.remove("is-ok");
        }
        input?.focus();
        return;
      }
      syncNameForms();
      ["quiz", "trail", "pack"].forEach(renderBoard);
    });
  });

  window.addEventListener("sdz-score-updated", refresh);
  window.addEventListener("sdz-name-updated", () => {
    syncNameForms();
    ["quiz", "trail", "pack"].forEach(renderBoard);
  });

  window.SDZ_RANKING = { refresh, requireName, syncNameForms };

  refresh();
  setInterval(refresh, 20000);
})();
