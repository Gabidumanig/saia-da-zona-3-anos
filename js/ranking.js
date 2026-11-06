(() => {
  const listEl = document.getElementById("ranking-list");
  const statusEl = document.getElementById("ranking-status");
  const tabs = document.querySelectorAll("[data-rank-tab]");
  const nameForm = document.getElementById("ranking-name-form");
  const nameInput = document.getElementById("ranking-name-input");
  const nameHint = document.getElementById("ranking-name-hint");
  if (!listEl) return;

  let mode = "geral";
  let rows = [];

  function totalOf(row) {
    return (row.quiz_best || 0) + (row.trail_best || 0) + (row.pack_best || 0);
  }

  function sortRows() {
    const copy = [...rows];
    if (mode === "quiz") copy.sort((a, b) => (b.quiz_best || 0) - (a.quiz_best || 0));
    else if (mode === "trail") copy.sort((a, b) => (b.trail_best || 0) - (a.trail_best || 0));
    else if (mode === "pack") copy.sort((a, b) => (b.pack_best || 0) - (a.pack_best || 0));
    else copy.sort((a, b) => totalOf(b) - totalOf(a));
    return copy.filter((r) => {
      if (mode === "quiz") return (r.quiz_best || 0) > 0;
      if (mode === "trail") return (r.trail_best || 0) > 0;
      if (mode === "pack") return (r.pack_best || 0) > 0;
      return totalOf(r) > 0;
    });
  }

  function scoreLabel(row) {
    if (mode === "quiz") return `${row.quiz_best} pts`;
    if (mode === "trail") return `${row.trail_best} m`;
    if (mode === "pack") return `${row.pack_best} itens`;
    return `${totalOf(row)} pts`;
  }

  function syncNameField() {
    if (!nameInput) return;
    const me = window.SDZ_PLAYER?.getName?.() || "";
    if (me && nameInput.value !== me) nameInput.value = me;
    if (nameHint) {
      nameHint.textContent = me
        ? `Jogando como ${me}. Pode trocar o nome quando quiser.`
        : "Salva o nome pra aparecer no placar depois do Quiz e dos jogos.";
      nameHint.classList.toggle("is-ok", Boolean(me));
    }
  }

  function render() {
    const me = window.SDZ_PLAYER?.getName?.() || "";
    const sorted = sortRows().slice(0, 30);
    if (!sorted.length) {
      listEl.innerHTML = `<p class="ranking-empty">Ainda sem placar. Salva teu nome acima e joga o Quiz, a Trilha ou a Cargueira!</p>`;
      return;
    }
    listEl.innerHTML = sorted
      .map((row, i) => {
        const isMe = me && row.player_name === me;
        return `
          <div class="rank-row${isMe ? " is-me" : ""}${i === 0 ? " is-lead" : ""}">
            <span class="rank-pos">${i + 1}º</span>
            <strong class="rank-name">${escapeHtml(row.player_name)}</strong>
            <span class="rank-score">${scoreLabel(row)}</span>
          </div>
        `;
      })
      .join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function refresh() {
    if (statusEl) statusEl.textContent = "Atualizando…";
    rows = (await window.SDZ_PLAYER?.fetchLeaderboard?.()) || [];
    if (statusEl) {
      statusEl.textContent = window.SDZ_PLAYER?.online
        ? `${rows.length} jogador${rows.length === 1 ? "" : "es"} online`
        : "Ranking offline";
    }
    syncNameField();
    render();
  }

  if (nameForm && nameInput) {
    nameForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const ok = window.SDZ_PLAYER?.setName?.(nameInput.value);
      if (!ok) {
        if (nameHint) {
          nameHint.textContent = "Digite pelo menos 2 letras.";
          nameHint.classList.remove("is-ok");
        }
        nameInput.focus();
        return;
      }
      syncNameField();
      render();
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      mode = tab.getAttribute("data-rank-tab");
      tabs.forEach((t) => t.classList.toggle("is-active", t === tab));
      render();
    });
  });

  window.addEventListener("sdz-score-updated", refresh);
  window.addEventListener("sdz-name-updated", () => {
    syncNameField();
    render();
  });
  window.SDZ_RANKING = { refresh };

  refresh();
  setInterval(refresh, 20000);
})();
