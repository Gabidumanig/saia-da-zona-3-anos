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

    listEl.innerHTML = sorted
      .map((row, i) => {
        const isMe = me && row.player_name === me;
        return `
          <div class="rank-row${isMe ? " is-me" : ""}${i === 0 ? " is-lead" : ""}">
            <span class="rank-pos">${i + 1}º</span>
            <strong class="rank-name">${escapeHtml(row.player_name)}</strong>
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
