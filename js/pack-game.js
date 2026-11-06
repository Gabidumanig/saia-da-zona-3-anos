(() => {
  const BEST_KEY = "sdz3_pack_best";
  const MAX_MISSES = 3;

  const canvas = document.getElementById("pack-canvas");
  const overlay = document.getElementById("pack-overlay");
  const messageEl = document.getElementById("pack-message");
  const startBtn = document.getElementById("pack-start");
  const scoreEl = document.getElementById("pack-score");
  const missesEl = document.getElementById("pack-misses");
  const bestEl = document.getElementById("pack-best");

  if (!canvas || !overlay || !startBtn) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const ITEM_TYPES = [
    { id: "barraca", label: "Barraca", color: "#3DDC97" },
    { id: "garrafa", label: "Garrafa", color: "#00C2FF" },
    { id: "bussola", label: "Bússola", color: "#FFD166" },
    { id: "bota", label: "Bota", color: "#C45C26" },
    { id: "corda", label: "Corda", color: "#F0B35A" },
    { id: "mapa", label: "Mapa", color: "#FF8FAB" },
    { id: "lanterna", label: "Lanterna", color: "#6BA3FF" },
    { id: "chapéu", label: "Chapéu", color: "#E8C56A" },
    { id: "atum", label: "Atum", color: "#1A6BFF" },
    { id: "pepino", label: "Pepino", color: "#2BB673" },
  ];

  let running = false;
  let raf = 0;
  let lastTs = 0;
  let score = 0;
  let misses = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let spawnTimer = 0;
  let items = [];
  let pack = { x: W / 2, y: H - 58, w: 92, h: 52, speed: 420 };
  let pointerX = W / 2;
  let keys = { left: false, right: false };
  let flash = 0;
  let active = false;

  function updateHud() {
    if (scoreEl) scoreEl.textContent = `${score} itens`;
    if (missesEl) missesEl.textContent = `${misses} / ${MAX_MISSES} perdidos`;
    if (bestEl) bestEl.textContent = `Recorde ${best}`;
  }

  function showOverlay(text, showBtn = true) {
    messageEl.textContent = text;
    startBtn.hidden = !showBtn;
    overlay.hidden = false;
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function resetRound() {
    score = 0;
    misses = 0;
    items = [];
    spawnTimer = 0.4;
    pack.x = W / 2;
    pointerX = W / 2;
    flash = 0;
    updateHud();
  }

  function spawnItem() {
    const type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
    const size = 34 + Math.random() * 10;
    items.push({
      type,
      x: 28 + Math.random() * (W - 56),
      y: -40,
      r: size / 2,
      vy: 120 + Math.random() * 70 + Math.min(score * 3.5, 160),
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 3.2,
    });
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0B3D91");
    g.addColorStop(0.55, "#0A2A5C");
    g.addColorStop(1, "#16301A");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    for (let i = 0; i < 18; i += 1) {
      const x = (i * 97) % W;
      const y = (i * 53) % (H * 0.7);
      ctx.fillRect(x, y, 4, 8);
    }

    ctx.fillStyle = "#2A4A28";
    ctx.beginPath();
    ctx.moveTo(0, H - 18);
    ctx.quadraticCurveTo(W * 0.25, H - 34, W * 0.5, H - 20);
    ctx.quadraticCurveTo(W * 0.75, H - 8, W, H - 26);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawPack() {
    const { x, y, w, h } = pack;
    const left = x - w / 2;
    const top = y - h / 2;

    ctx.save();
    ctx.translate(x, y);

    // straps
    ctx.strokeStyle = "#8B3E14";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-18, -h / 2 + 4);
    ctx.quadraticCurveTo(-28, -h / 2 - 18, -10, -h / 2 - 22);
    ctx.moveTo(18, -h / 2 + 4);
    ctx.quadraticCurveTo(28, -h / 2 - 18, 10, -h / 2 - 22);
    ctx.stroke();

    // body
    const body = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    body.addColorStop(0, "#E07A3D");
    body.addColorStop(1, "#C45C26");
    ctx.fillStyle = body;
    roundRect(-w / 2, -h / 2, w, h, 14);
    ctx.fill();

    // pocket
    ctx.fillStyle = "#8B3E14";
    roundRect(-w * 0.28, -4, w * 0.56, h * 0.42, 8);
    ctx.fill();

    ctx.fillStyle = "#FFD166";
    ctx.beginPath();
    ctx.arc(0, 8, 4, 0, Math.PI * 2);
    ctx.fill();

    // open mouth glow
    ctx.fillStyle = "rgba(4, 24, 51, 0.35)";
    roundRect(-w * 0.34, -h / 2 + 2, w * 0.68, 12, 6);
    ctx.fill();

    ctx.restore();

    // catch zone hint
    ctx.strokeStyle = "rgba(255,209,102,0.25)";
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(left + 8, top - 6, w - 16, 10);
    ctx.setLineDash([]);
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawItem(item) {
    const { x, y, r, type, rot } = item;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    switch (type.id) {
      case "barraca":
        ctx.fillStyle = type.color;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.95, r * 0.7);
        ctx.lineTo(-r * 0.95, r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(0, r * 0.7);
        ctx.stroke();
        break;
      case "garrafa":
        ctx.fillStyle = type.color;
        roundRect(-r * 0.35, -r * 0.7, r * 0.7, r * 1.35, 6);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        roundRect(-r * 0.22, -r, r * 0.44, r * 0.35, 4);
        ctx.fill();
        break;
      case "bussola":
        ctx.fillStyle = "#D9E4F5";
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = type.color;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = "#FF4D6D";
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.55);
        ctx.lineTo(r * 0.18, 0);
        ctx.lineTo(-r * 0.18, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath();
        ctx.moveTo(0, r * 0.55);
        ctx.lineTo(r * 0.18, 0);
        ctx.lineTo(-r * 0.18, 0);
        ctx.closePath();
        ctx.fill();
        break;
      case "bota":
        ctx.fillStyle = type.color;
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.7);
        ctx.lineTo(r * 0.15, -r * 0.7);
        ctx.lineTo(r * 0.2, r * 0.1);
        ctx.lineTo(r * 0.85, r * 0.25);
        ctx.lineTo(r * 0.85, r * 0.7);
        ctx.lineTo(-r * 0.55, r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#2A2A2A";
        ctx.fillRect(-r * 0.55, r * 0.45, r * 1.4, r * 0.28);
        break;
      case "corda":
        ctx.strokeStyle = type.color;
        ctx.lineWidth = 5;
        ctx.beginPath();
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 4) * Math.PI * 2;
          const rr = r * (0.35 + i * 0.1);
          ctx.arc(0, 0, rr, a, a + Math.PI * 1.2);
        }
        ctx.stroke();
        break;
      case "mapa":
        ctx.fillStyle = "#FFE8C2";
        roundRect(-r * 0.75, -r * 0.55, r * 1.5, r * 1.1, 4);
        ctx.fill();
        ctx.strokeStyle = type.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, -r * 0.1);
        ctx.quadraticCurveTo(0, -r * 0.45, r * 0.45, r * 0.05);
        ctx.quadraticCurveTo(0, r * 0.35, -r * 0.35, r * 0.25);
        ctx.stroke();
        break;
      case "lanterna":
        ctx.fillStyle = type.color;
        roundRect(-r * 0.35, -r * 0.2, r * 1.1, r * 0.45, 5);
        ctx.fill();
        ctx.fillStyle = "#FFD166";
        ctx.beginPath();
        ctx.moveTo(r * 0.75, -r * 0.35);
        ctx.lineTo(r * 1.15, 0);
        ctx.lineTo(r * 0.75, r * 0.35);
        ctx.closePath();
        ctx.fill();
        break;
      case "chapéu":
        ctx.fillStyle = type.color;
        ctx.beginPath();
        ctx.ellipse(0, r * 0.25, r * 0.95, r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.05, r * 0.55, r * 0.45, 0, Math.PI, 0);
        ctx.fill();
        break;
      case "atum":
        ctx.fillStyle = "#D9E4F5";
        roundRect(-r * 0.55, -r * 0.7, r * 1.1, r * 1.4, 8);
        ctx.fill();
        ctx.fillStyle = type.color;
        roundRect(-r * 0.55, -r * 0.7, r * 1.1, r * 0.4, 8);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.floor(r * 0.35)}px Manrope, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("ATUM", 0, -r * 0.42);
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath();
        ctx.arc(-r * 0.18, r * 0.05, 2.2, 0, Math.PI * 2);
        ctx.arc(r * 0.18, r * 0.05, 2.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "pepino":
        ctx.fillStyle = type.color;
        roundRect(-r * 0.32, -r * 0.9, r * 0.64, r * 1.8, r * 0.32);
        ctx.fill();
        ctx.fillStyle = "#1A1A1A";
        ctx.beginPath();
        ctx.arc(-r * 0.1, -r * 0.15, 2, 0, Math.PI * 2);
        ctx.arc(r * 0.1, -r * 0.15, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      default:
        ctx.fillStyle = type.color;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
  }

  function drawHudCanvas() {
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 77, 109, ${Math.min(0.35, flash)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function catchBox() {
    return {
      x: pack.x - pack.w * 0.38,
      y: pack.y - pack.h * 0.55,
      w: pack.w * 0.76,
      h: pack.h * 0.45,
    };
  }

  function update(dt) {
    let target = pointerX;
    if (keys.left) target -= pack.speed * dt * 1.2;
    if (keys.right) target += pack.speed * dt * 1.2;
    if (keys.left || keys.right) pointerX = target;

    const maxX = W - pack.w / 2 - 8;
    const minX = pack.w / 2 + 8;
    const desired = Math.max(minX, Math.min(maxX, pointerX));
    pack.x += (desired - pack.x) * Math.min(1, dt * 14);

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnItem();
      const base = Math.max(0.45, 1.15 - score * 0.02);
      spawnTimer = base + Math.random() * 0.35;
    }

    const box = catchBox();
    const next = [];
    for (const item of items) {
      item.y += item.vy * dt;
      item.rot += item.spin * dt;

      const hit =
        item.x > box.x &&
        item.x < box.x + box.w &&
        item.y + item.r > box.y &&
        item.y - item.r < box.y + box.h + 8;

      if (hit) {
        score += 1;
        if (score > best) {
          best = score;
          localStorage.setItem(BEST_KEY, String(best));
        }
        updateHud();
        continue;
      }

      if (item.y - item.r > H) {
        misses += 1;
        flash = 0.45;
        updateHud();
        if (misses >= MAX_MISSES) {
          endGame();
          return;
        }
        continue;
      }

      next.push(item);
    }
    items = next;
    if (flash > 0) flash = Math.max(0, flash - dt);
  }

  function endGame() {
    running = false;
    cancelAnimationFrame(raf);
    showOverlay(`Cargueira incompleta! Você catou ${score} itens.`, true);
    startBtn.textContent = "Jogar de novo";
  }

  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    update(dt);
    if (!running) return;

    drawBackground();
    items.forEach(drawItem);
    drawPack();
    drawHudCanvas();
    raf = requestAnimationFrame(frame);
  }

  function startGame() {
    resetRound();
    hideOverlay();
    running = true;
    lastTs = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function setPointerFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    pointerX = ((clientX - rect.left) / rect.width) * W;
  }

  function onKey(e, down) {
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      keys.left = down;
      e.preventDefault();
    }
    if (e.code === "ArrowRight" || e.code === "KeyD") {
      keys.right = down;
      e.preventDefault();
    }
  }

  canvas.addEventListener("mousemove", setPointerFromEvent);
  canvas.addEventListener("touchmove", (e) => {
    setPointerFromEvent(e);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener("touchstart", (e) => {
    setPointerFromEvent(e);
    if (!running && active) startGame();
  }, { passive: true });

  window.addEventListener("keydown", (e) => onKey(e, true));
  window.addEventListener("keyup", (e) => onKey(e, false));

  startBtn.addEventListener("click", startGame);

  function activate() {
    active = true;
    updateHud();
    if (!running) {
      drawBackground();
      drawPack();
      showOverlay("Mova a mochila e não deixe cair o equipamento!", true);
      startBtn.textContent = "Começar";
    }
  }

  function deactivate() {
    active = false;
    running = false;
    cancelAnimationFrame(raf);
  }

  updateHud();
  drawBackground();
  drawPack();

  window.SDZ_PACK_GAME = { activate, deactivate };
})();
