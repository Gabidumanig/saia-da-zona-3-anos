(() => {
  const BEST_KEY = "sdz3_tetris_best";
  const COLS = 10;
  const ROWS = 18;
  const CELL = 28;

  const PIECES = {
    I: { color: "#00C2FF", label: "Corda", shapes: [[[1, 1, 1, 1]], [[1], [1], [1], [1]]] },
    O: { color: "#FFD166", label: "Barraca", shapes: [[[1, 1], [1, 1]]] },
    T: { color: "#1A6BFF", label: "Mochila", shapes: [[[0, 1, 0], [1, 1, 1]], [[1, 0], [1, 1], [1, 0]], [[1, 1, 1], [0, 1, 0]], [[0, 1], [1, 1], [0, 1]]] },
    S: { color: "#2BB673", label: "Pepino", shapes: [[[0, 1, 1], [1, 1, 0]], [[1, 0], [1, 1], [0, 1]]] },
    Z: { color: "#FF4D6D", label: "Atum", shapes: [[[1, 1, 0], [0, 1, 1]], [[0, 1], [1, 1], [1, 0]]] },
    J: { color: "#6BA3FF", label: "Bota", shapes: [[[1, 0, 0], [1, 1, 1]], [[1, 1], [1, 0], [1, 0]], [[1, 1, 1], [0, 0, 1]], [[0, 1], [0, 1], [1, 1]]] },
    L: { color: "#FF7A18", label: "Lanterna", shapes: [[[0, 0, 1], [1, 1, 1]], [[1, 0], [1, 0], [1, 1]], [[1, 1, 1], [1, 0, 0]], [[1, 1], [0, 1], [0, 1]]] },
  };
  const BAG = Object.keys(PIECES);

  const canvas = document.getElementById("tetris-canvas");
  const overlay = document.getElementById("tetris-overlay");
  const messageEl = document.getElementById("tetris-message");
  const startBtn = document.getElementById("tetris-start");
  const scoreEl = document.getElementById("tetris-score");
  const linesEl = document.getElementById("tetris-lines");
  const bestEl = document.getElementById("tetris-best");
  const levelEl = document.getElementById("tetris-level");

  if (!canvas || !overlay || !startBtn) return;
  const ctx = canvas.getContext("2d");

  let active = false;
  let running = false;
  let raf = 0;
  let lastTs = 0;
  let dropAcc = 0;
  let board = [];
  let piece = null;
  let nextKey = "T";
  let score = 0;
  let lines = 0;
  let level = 1;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let submitted = false;
  let bag = [];

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function updateChrome() {
    if (scoreEl) scoreEl.textContent = `${score} pts`;
    if (linesEl) linesEl.textContent = `${lines} linhas`;
    if (levelEl) levelEl.textContent = `Nv ${level}`;
    if (bestEl) bestEl.textContent = `Recorde ${Math.max(best, score)}`;
  }

  function showOverlay(text, label = "Começar") {
    if (messageEl) messageEl.textContent = text;
    if (startBtn) startBtn.textContent = label;
    overlay.hidden = false;
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function shuffleBag() {
    bag = [...BAG].sort(() => Math.random() - 0.5);
  }

  function takeKey() {
    if (!bag.length) shuffleBag();
    return bag.pop();
  }

  function spawn() {
    const key = nextKey;
    nextKey = takeKey();
    const def = PIECES[key];
    piece = {
      key,
      rot: 0,
      x: 3,
      y: 0,
      color: def.color,
      label: def.label,
    };
    if (collides(piece.x, piece.y, piece.rot)) {
      endGame();
    }
  }

  function shapeOf(p, rot = p.rot) {
    const shapes = PIECES[p.key].shapes;
    return shapes[rot % shapes.length];
  }

  function collides(x, y, rot) {
    const shape = shapeOf(piece, rot);
    for (let r = 0; r < shape.length; r += 1) {
      for (let c = 0; c < shape[r].length; c += 1) {
        if (!shape[r][c]) continue;
        const nx = x + c;
        const ny = y + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function lockPiece() {
    const shape = shapeOf(piece);
    for (let r = 0; r < shape.length; r += 1) {
      for (let c = 0; c < shape[r].length; c += 1) {
        if (!shape[r][c]) continue;
        const ny = piece.y + r;
        const nx = piece.x + c;
        if (ny >= 0) board[ny][nx] = { color: piece.color, label: piece.label };
      }
    }
    clearLines();
    spawn();
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      if (board[r].every((cell) => cell)) {
        board.splice(r, 1);
        board.unshift(Array(COLS).fill(null));
        cleared += 1;
        r += 1;
      }
    }
    if (!cleared) return;
    lines += cleared;
    const table = [0, 100, 300, 500, 800];
    score += (table[cleared] || 800) * level;
    level = 1 + Math.floor(lines / 8);
    updateChrome();
  }

  function hardDrop() {
    if (!piece || !running) return;
    while (!collides(piece.x, piece.y + 1, piece.rot)) {
      piece.y += 1;
      score += 2;
    }
    lockPiece();
    updateChrome();
  }

  function softDrop() {
    if (!piece || !running) return;
    if (!collides(piece.x, piece.y + 1, piece.rot)) {
      piece.y += 1;
      score += 1;
      updateChrome();
    } else lockPiece();
  }

  function move(dx) {
    if (!piece || !running) return;
    if (!collides(piece.x + dx, piece.y, piece.rot)) piece.x += dx;
  }

  function rotate() {
    if (!piece || !running) return;
    const next = piece.rot + 1;
    if (!collides(piece.x, piece.y, next)) {
      piece.rot = next;
      return;
    }
    // wall kick simples
    for (const kick of [-1, 1, -2, 2]) {
      if (!collides(piece.x + kick, piece.y, next)) {
        piece.x += kick;
        piece.rot = next;
        return;
      }
    }
  }

  function dropInterval() {
    return Math.max(120, 700 - (level - 1) * 55);
  }

  function endGame() {
    running = false;
    if (score > best) {
      best = score;
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch (_) {
        /* ignore */
      }
    }
    updateChrome();
    if (!submitted && score > 0 && window.SDZ_PLAYER?.submitScore) {
      submitted = true;
      window.SDZ_PLAYER.submitScore("tetris", score);
    }
    showOverlay(`Mochila lotou! ${score} pts`, "Jogar de novo");
  }

  function startGame() {
    if (window.SDZ_RANKING?.requireName && !window.SDZ_RANKING.requireName("tetris")) {
      return;
    }
    board = emptyBoard();
    score = 0;
    lines = 0;
    level = 1;
    submitted = false;
    shuffleBag();
    nextKey = takeKey();
    spawn();
    dropAcc = 0;
    lastTs = 0;
    running = true;
    hideOverlay();
    updateChrome();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function drawCell(x, y, color, label) {
    const px = x * CELL;
    const py = y * CELL;
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(px + 3, py + 3, CELL - 8, 5);
    if (label && CELL >= 24) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.font = "700 8px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label.slice(0, 3), px + CELL / 2, py + CELL / 2 + 3);
    }
  }

  function draw() {
    const boardW = COLS * CELL;
    const boardH = ROWS * CELL;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // fundo trilha
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#12324f");
    g.addColorStop(1, "#0a1c30");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const ox = 24;
    const oy = 16;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = "rgba(4,20,36,0.85)";
    ctx.fillRect(0, 0, boardW, boardH);
    ctx.strokeStyle = "rgba(120,180,255,0.2)";
    ctx.strokeRect(0.5, 0.5, boardW - 1, boardH - 1);

    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const cell = board[r][c];
        if (cell) drawCell(c, r, cell.color, cell.label);
        else {
          ctx.strokeStyle = "rgba(255,255,255,0.04)";
          ctx.strokeRect(c * CELL + 0.5, r * CELL + 0.5, CELL - 1, CELL - 1);
        }
      }
    }

    if (piece) {
      const shape = shapeOf(piece);
      for (let r = 0; r < shape.length; r += 1) {
        for (let c = 0; c < shape[r].length; c += 1) {
          if (!shape[r][c]) continue;
          drawCell(piece.x + c, piece.y + r, piece.color, piece.label);
        }
      }
    }
    ctx.restore();

    // painel next
    const nx = ox + boardW + 28;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(nx, oy, 150, 160);
    ctx.fillStyle = "#fff";
    ctx.font = "700 14px Manrope, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Próximo", nx + 14, oy + 28);
    const next = PIECES[nextKey];
    const nshape = next.shapes[0];
    nshape.forEach((row, r) => {
      row.forEach((on, c) => {
        if (!on) return;
        ctx.fillStyle = next.color;
        ctx.fillRect(nx + 28 + c * 24, oy + 50 + r * 24, 22, 22);
      });
    });
    ctx.fillStyle = "#FFD166";
    ctx.font = "700 13px Manrope, sans-serif";
    ctx.fillText(next.label, nx + 14, oy + 140);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "600 12px Manrope, sans-serif";
    ctx.fillText("← → mover", nx + 14, oy + 200);
    ctx.fillText("↑ / X girar", nx + 14, oy + 220);
    ctx.fillText("↓ descer", nx + 14, oy + 240);
    ctx.fillText("Espaço drop", nx + 14, oy + 260);
  }

  function frame(ts) {
    if (!active) {
      raf = 0;
      return;
    }
    if (!lastTs) lastTs = ts;
    const dt = Math.min(40, ts - lastTs);
    lastTs = ts;
    if (running && piece) {
      dropAcc += dt;
      if (dropAcc >= dropInterval()) {
        dropAcc = 0;
        softDrop();
      }
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  function onKey(e) {
    if (!active || !running) return;
    const k = e.key;
    if (["ArrowLeft", "a", "A"].includes(k)) {
      e.preventDefault();
      move(-1);
    } else if (["ArrowRight", "d", "D"].includes(k)) {
      e.preventDefault();
      move(1);
    } else if (["ArrowDown", "s", "S"].includes(k)) {
      e.preventDefault();
      softDrop();
    } else if (["ArrowUp", "w", "W", "x", "X"].includes(k)) {
      e.preventDefault();
      rotate();
    } else if (k === " " || k === "Spacebar") {
      e.preventDefault();
      hardDrop();
    }
  }

  // touch controls via buttons in overlay area - swipe on canvas
  let touchX = null;
  canvas.addEventListener("touchstart", (e) => {
    touchX = e.changedTouches[0].clientX;
  }, { passive: true });
  canvas.addEventListener("touchend", (e) => {
    if (touchX == null || !running) return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - (e.changedTouches[0].clientY);
    if (Math.abs(dx) > 30) move(dx > 0 ? 1 : -1);
    else rotate();
    touchX = null;
  });

  startBtn.addEventListener("click", startGame);
  window.addEventListener("keydown", onKey);

  function activate() {
    active = true;
    updateChrome();
    if (!raf) {
      lastTs = 0;
      raf = requestAnimationFrame(frame);
    }
    draw();
  }

  function deactivate() {
    active = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  updateChrome();
  showOverlay("Empilha o kit da trilha e limpa as linhas!", "Começar");
  draw();

  window.SDZ_TETRIS_GAME = { activate, deactivate };
})();
