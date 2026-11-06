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
  let pack = { x: W / 2, y: H - 72, w: 118, h: 86, speed: 460 };
  let pointerX = W / 2;
  let keys = { left: false, right: false };
  let flash = 0;
  let catchGlow = 0;
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
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#071833");
    sky.addColorStop(0.45, "#0C2F63");
    sky.addColorStop(0.78, "#1A3F2A");
    sky.addColorStop(1, "#24351C");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // distant ridges
    ctx.fillStyle = "rgba(20, 48, 90, 0.55)";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.55);
    ctx.lineTo(W * 0.18, H * 0.38);
    ctx.lineTo(W * 0.34, H * 0.52);
    ctx.lineTo(W * 0.52, H * 0.32);
    ctx.lineTo(W * 0.7, H * 0.5);
    ctx.lineTo(W * 0.88, H * 0.36);
    ctx.lineTo(W, H * 0.48);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.045)";
    for (let i = 0; i < 22; i += 1) {
      ctx.fillRect((i * 83) % W, (i * 47) % (H * 0.55), 3, 7);
    }

    // trail ground
    const dirt = ctx.createLinearGradient(0, H - 48, 0, H);
    dirt.addColorStop(0, "#3A5A2C");
    dirt.addColorStop(0.45, "#4A3A28");
    dirt.addColorStop(1, "#2C2118");
    ctx.fillStyle = dirt;
    ctx.beginPath();
    ctx.moveTo(0, H - 28);
    ctx.quadraticCurveTo(W * 0.3, H - 46, W * 0.55, H - 30);
    ctx.quadraticCurveTo(W * 0.8, H - 16, W, H - 34);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 140, 60, 0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H - 22);
    ctx.quadraticCurveTo(W * 0.5, H - 38, W, H - 18);
    ctx.stroke();
  }

  function drawPack() {
    const { x, y, w, h } = pack;

    ctx.save();
    ctx.translate(x, y);

    // soft shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.52, w * 0.48, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // hip belt (Deuter-style fins)
    ctx.fillStyle = "#FF7A18";
    roundRect(-w * 0.62, h * 0.18, w * 0.28, h * 0.18, 8);
    roundRect(w * 0.34, h * 0.18, w * 0.28, h * 0.18, 8);
    ctx.fill();
    ctx.fillStyle = "#1B2740";
    roundRect(-w * 0.58, h * 0.22, w * 0.2, h * 0.1, 5);
    roundRect(w * 0.38, h * 0.22, w * 0.2, h * 0.1, 5);
    ctx.fill();

    // shoulder straps rising behind lid
    ctx.strokeStyle = "#FF8A2A";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-w * 0.22, -h * 0.05);
    ctx.quadraticCurveTo(-w * 0.42, -h * 0.55, -w * 0.12, -h * 0.72);
    ctx.moveTo(w * 0.22, -h * 0.05);
    ctx.quadraticCurveTo(w * 0.42, -h * 0.55, w * 0.12, -h * 0.72);
    ctx.stroke();
    ctx.strokeStyle = "#1B2740";
    ctx.lineWidth = 3;
    ctx.stroke();

    // main body — navy Deuter shell
    const body = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    body.addColorStop(0, "#2A3F66");
    body.addColorStop(0.45, "#1B2C4A");
    body.addColorStop(1, "#121E34");
    ctx.fillStyle = body;
    roundRect(-w * 0.42, -h * 0.28, w * 0.84, h * 0.78, 16);
    ctx.fill();

    // orange side accents / compression panels
    ctx.fillStyle = "#FF7A18";
    roundRect(-w * 0.42, -h * 0.08, w * 0.1, h * 0.42, 6);
    roundRect(w * 0.32, -h * 0.08, w * 0.1, h * 0.42, 6);
    ctx.fill();

    // mesh side pockets
    ctx.fillStyle = "rgba(140, 190, 255, 0.22)";
    roundRect(-w * 0.5, h * 0.02, w * 0.12, h * 0.32, 5);
    roundRect(w * 0.38, h * 0.02, w * 0.12, h * 0.32, 5);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1.5;
    roundRect(-w * 0.5, h * 0.02, w * 0.12, h * 0.32, 5);
    ctx.stroke();
    roundRect(w * 0.38, h * 0.02, w * 0.12, h * 0.32, 5);
    ctx.stroke();

    // front stretch pocket
    ctx.fillStyle = "rgba(90, 130, 190, 0.35)";
    roundRect(-w * 0.28, h * 0.02, w * 0.56, h * 0.28, 10);
    ctx.fill();
    ctx.strokeStyle = "#FF8A2A";
    ctx.lineWidth = 2;
    roundRect(-w * 0.28, h * 0.02, w * 0.56, h * 0.28, 10);
    ctx.stroke();

    // zipper U suggestion
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.22, -h * 0.12);
    ctx.quadraticCurveTo(0, h * 0.18, w * 0.22, -h * 0.12);
    ctx.stroke();

    // lid (open upward for catch mouth)
    const lid = ctx.createLinearGradient(0, -h * 0.55, 0, -h * 0.15);
    lid.addColorStop(0, "#FF9A3C");
    lid.addColorStop(1, "#E85D00");
    ctx.fillStyle = lid;
    roundRect(-w * 0.36, -h * 0.58, w * 0.72, h * 0.28, 12);
    ctx.fill();

    // lid buckle
    ctx.fillStyle = "#1B2740";
    roundRect(-8, -h * 0.36, 16, 10, 3);
    ctx.fill();
    ctx.fillStyle = "#FFD166";
    ctx.fillRect(-3, -h * 0.34, 6, 6);

    // open mouth (catch opening)
    const mouthGlow = catchGlow > 0 ? 0.55 + catchGlow * 0.45 : 0.35;
    ctx.fillStyle = `rgba(4, 16, 36, ${0.75})`;
    roundRect(-w * 0.3, -h * 0.34, w * 0.6, h * 0.16, 8);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 170, 70, ${mouthGlow})`;
    ctx.lineWidth = 3;
    roundRect(-w * 0.3, -h * 0.34, w * 0.6, h * 0.16, 8);
    ctx.stroke();

    // bottom compartment seam
    ctx.strokeStyle = "rgba(255,122,24,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.34, h * 0.32);
    ctx.lineTo(w * 0.34, h * 0.32);
    ctx.stroke();

    // tiny brand-free label patch
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    roundRect(-18, -h * 0.02, 36, 12, 4);
    ctx.fill();
    ctx.fillStyle = "#FF9A3C";
    ctx.font = "bold 8px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SDZ", 0, 7);

    ctx.restore();

    // catch aura
    if (catchGlow > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 154, 60, ${catchGlow * 0.7})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(255, 122, 24, 0.8)";
      ctx.shadowBlur = 18;
      roundRect(x - w * 0.32, y - h * 0.42, w * 0.64, 18, 8);
      ctx.stroke();
      ctx.restore();
    }
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
      x: pack.x - pack.w * 0.3,
      y: pack.y - pack.h * 0.42,
      w: pack.w * 0.6,
      h: pack.h * 0.28,
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
        catchGlow = 1;
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
    if (catchGlow > 0) catchGlow = Math.max(0, catchGlow - dt * 2.2);
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
