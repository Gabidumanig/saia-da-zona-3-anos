(() => {
  const BEST_KEY = "sdz3_trail_best";
  const AVATAR_KEY = "sdz3_trail_avatar";
  const GRAVITY = 2200;
  const JUMP_V = -780;
  const GROUND_Y = 292;

  const AVATARS = [
    { id: "gabi", name: "Gabi", src: "assets/avatars/gabi.svg" },
    { id: "caio", name: "Caio", src: "assets/avatars/caio.svg" },
    { id: "franz", name: "Franz", src: "assets/avatars/franz.svg" },
    { id: "jin", name: "Jin", src: "assets/avatars/jin.svg" },
    { id: "diego", name: "Diego", src: "assets/avatars/diego.svg" },
    { id: "matheus", name: "Matheus", src: "assets/avatars/matheus.svg" },
  ];

  const canvas = document.getElementById("trail-canvas");
  const overlay = document.getElementById("trail-overlay");
  const messageEl = document.getElementById("trail-message");
  const startBtn = document.getElementById("trail-start");
  const scoreEl = document.getElementById("trail-score");
  const bestEl = document.getElementById("trail-best");
  const avatarGrid = document.getElementById("avatar-grid");

  if (!canvas || !overlay || !startBtn) return;

  const ctx = canvas.getContext("2d");
  let running = false;
  let alive = false;
  let raf = 0;
  let lastTs = 0;
  let distance = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let speed = 280;
  let spawnTimer = 0;
  let obstacles = [];
  let clouds = [];
  let hills = [];
  let rainDrops = [];
  let walkPhase = 0;
  let selectedAvatarId = localStorage.getItem(AVATAR_KEY) || null;
  let avatarImg = null;
  let avatarReady = false;
  let avatarName = "";

  const player = {
    x: 110,
    y: GROUND_Y,
    vy: 0,
    w: 46,
    h: 64,
    onGround: true,
  };

  function avatarById(id) {
    return AVATARS.find((a) => a.id === id) || null;
  }

  function setAvatar(id) {
    const avatar = avatarById(id);
    selectedAvatarId = avatar ? avatar.id : null;
    avatarReady = false;
    avatarImg = null;
    avatarName = avatar ? avatar.name : "";
    if (!avatar) return;
    localStorage.setItem(AVATAR_KEY, avatar.id);
    const img = new Image();
    img.onload = () => {
      avatarImg = img;
      avatarReady = true;
      if (!running) {
        drawBackground();
        drawPlayer();
      }
    };
    img.src = avatar.src;
  }

  function renderAvatarGrid() {
    if (!avatarGrid) return;
    avatarGrid.innerHTML = "";
    AVATARS.forEach((avatar) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "avatar-card";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-label", avatar.name);
      if (selectedAvatarId === avatar.id) btn.classList.add("is-selected");
      btn.innerHTML = `<strong>${avatar.name}</strong><img src="${avatar.src}" alt="" loading="lazy" />`;
      btn.addEventListener("click", () => {
        setAvatar(avatar.id);
        renderAvatarGrid();
        if (!alive) {
          showOverlay(`Vamos com ${avatar.name}!`, "Começar");
        }
      });
      avatarGrid.appendChild(btn);
    });
  }

  function resize() {
    const parent = canvas.parentElement;
    const maxW = Math.min(900, parent.clientWidth);
    const ratio = 360 / 900;
    canvas.style.width = `${maxW}px`;
    canvas.style.height = `${Math.round(maxW * ratio)}px`;
  }

  function resetWorld() {
    distance = 0;
    speed = 280;
    spawnTimer = 0.8;
    obstacles = [];
    rainDrops = [];
    player.y = GROUND_Y;
    player.vy = 0;
    player.onGround = true;
    walkPhase = 0;
    clouds = Array.from({ length: 4 }, (_, i) => ({
      x: 80 + i * 220,
      y: 36 + (i % 2) * 22,
      w: 70 + (i % 3) * 18,
      s: 12 + i * 3,
    }));
    hills = Array.from({ length: 5 }, (_, i) => ({
      x: i * 220,
      h: 40 + (i % 3) * 18,
      w: 180 + (i % 2) * 40,
    }));
    updateHud();
  }

  function updateHud() {
    const meters = Math.floor(distance / 18);
    if (scoreEl) scoreEl.textContent = `${meters} m`;
    if (bestEl) bestEl.textContent = `Recorde ${Math.floor(best)} m`;
  }

  function showOverlay(text, btnLabel = "Começar") {
    messageEl.textContent = text;
    startBtn.textContent = btnLabel;
    overlay.hidden = false;
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function jump() {
    if (!alive || !running) return;
    if (player.onGround) {
      player.vy = JUMP_V;
      player.onGround = false;
    }
  }

  function pickObstacle() {
    const types = ["rock", "snake", "waterfall", "rain", "log"];
    const roll = Math.random();
    if (roll < 0.28) return "rock";
    if (roll < 0.48) return "snake";
    if (roll < 0.66) return "log";
    if (roll < 0.82) return "waterfall";
    return "rain";
  }

  function spawnObstacle() {
    const type = pickObstacle();
    const base = { type, x: canvas.width + 40, hit: false };

    if (type === "rock") {
      obstacles.push({ ...base, w: 36, h: 28, y: GROUND_Y });
    } else if (type === "snake") {
      obstacles.push({ ...base, w: 48, h: 16, y: GROUND_Y, phase: 0 });
    } else if (type === "log") {
      obstacles.push({ ...base, w: 54, h: 22, y: GROUND_Y });
    } else if (type === "waterfall") {
      obstacles.push({ ...base, w: 58, h: 120, y: GROUND_Y });
    } else if (type === "rain") {
      obstacles.push({ ...base, w: 90, h: 24, y: GROUND_Y, cloudY: 48 });
    }
  }

  function hitbox(obs) {
    if (obs.type === "waterfall") {
      return { x: obs.x + 10, y: obs.y - 34, w: obs.w - 20, h: 34 };
    }
    if (obs.type === "rain") {
      return { x: obs.x + 12, y: obs.y - 18, w: obs.w - 24, h: 18 };
    }
    if (obs.type === "snake") {
      return { x: obs.x + 4, y: obs.y - obs.h, w: obs.w - 8, h: obs.h };
    }
    return { x: obs.x, y: obs.y - obs.h, w: obs.w, h: obs.h };
  }

  function playerBox() {
    return {
      x: player.x + 8,
      y: player.y - player.h + 10,
      w: player.w - 14,
      h: player.h - 14,
    };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function gameOver() {
    alive = false;
    running = false;
    const meters = Math.floor(distance / 18);
    if (meters > best) {
      best = meters;
      localStorage.setItem(BEST_KEY, String(best));
    }
    updateHud();
    showOverlay(`Queda na trilha · ${meters} m`, "Tentar de novo");
  }

  function update(dt) {
    if (!alive) return;

    distance += speed * dt;
    speed = Math.min(520, 280 + distance / 900);
    walkPhase += dt * (player.onGround ? 10 : 0);

    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y >= GROUND_Y) {
      player.y = GROUND_Y;
      player.vy = 0;
      player.onGround = true;
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = Math.max(0.85, 1.7 - distance / 8000) + Math.random() * 0.55;
    }

    obstacles.forEach((obs) => {
      obs.x -= speed * dt;
      if (obs.type === "snake") obs.phase = (obs.phase || 0) + dt * 8;
    });
    obstacles = obstacles.filter((obs) => obs.x + obs.w > -40);

    clouds.forEach((c) => {
      c.x -= c.s * dt;
      if (c.x + c.w < 0) c.x = canvas.width + 40;
    });
    hills.forEach((h) => {
      h.x -= speed * 0.25 * dt;
      if (h.x + h.w < 0) h.x += 220 * hills.length;
    });

    rainDrops = rainDrops.filter((d) => d.y < GROUND_Y + 10);
    obstacles
      .filter((o) => o.type === "rain")
      .forEach((o) => {
        if (Math.random() < 0.45) {
          rainDrops.push({
            x: o.x + 10 + Math.random() * (o.w - 20),
            y: o.cloudY + 28,
            vy: 280 + Math.random() * 120,
          });
        }
      });
    rainDrops.forEach((d) => {
      d.y += d.vy * dt;
      d.x -= speed * 0.2 * dt;
    });

    const pb = playerBox();
    for (const obs of obstacles) {
      if (overlaps(pb, hitbox(obs))) {
        gameOver();
        return;
      }
    }

    updateHud();
  }

  function drawTree(tx, baseY, scale, dark) {
    const trunkH = 70 * scale;
    const trunkW = 12 * scale;
    ctx.fillStyle = dark ? "#3A2414" : "#5A3A1E";
    ctx.fillRect(tx - trunkW / 2, baseY - trunkH, trunkW, trunkH);

    const greens = dark
      ? ["#1A4A24", "#245C30", "#1F5530"]
      : ["#2F7A3A", "#3D9148", "#2A6B34"];
    for (let layer = 0; layer < 3; layer += 1) {
      const top = baseY - trunkH - 18 * scale - layer * 28 * scale;
      const half = (42 - layer * 6) * scale;
      ctx.fillStyle = greens[layer];
      ctx.beginPath();
      ctx.moveTo(tx - half, baseY - trunkH + 10 * scale - layer * 22 * scale);
      ctx.lineTo(tx, top);
      ctx.lineTo(tx + half, baseY - trunkH + 10 * scale - layer * 22 * scale);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBackground() {
    // forest canopy sky
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#1B3A28");
    g.addColorStop(0.35, "#2F5A3A");
    g.addColorStop(0.7, "#4F8A45");
    g.addColorStop(1, "#6B9A4A");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // distant misty hills
    hills.forEach((h, i) => {
      ctx.fillStyle = i % 2 ? "#2E5A34" : "#244A2C";
      ctx.beginPath();
      ctx.moveTo(h.x - 20, GROUND_Y);
      ctx.quadraticCurveTo(h.x + h.w / 2, GROUND_Y - h.h - 30, h.x + h.w + 20, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    });

    // back trees
    for (let i = 0; i < 10; i += 1) {
      const span = canvas.width + 160;
      const tx = ((i * 110 - distance * 0.12) % span + span) % span - 40;
      drawTree(tx, GROUND_Y, 0.7 + (i % 3) * 0.08, true);
    }

    // mid trees denser
    for (let i = 0; i < 8; i += 1) {
      const span = canvas.width + 200;
      const tx = ((i * 140 - distance * 0.28) % span + span) % span - 50;
      drawTree(tx, GROUND_Y, 1 + (i % 2) * 0.15, false);
    }

    // hanging canopy leaves at top
    ctx.fillStyle = "rgba(20, 60, 30, 0.55)";
    for (let i = 0; i < 14; i += 1) {
      const lx = ((i * 80 - distance * 0.35) % (canvas.width + 100)) - 40;
      ctx.beginPath();
      ctx.ellipse(lx, 18 + (i % 3) * 10, 40, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // light shafts
    ctx.fillStyle = "rgba(255, 240, 180, 0.07)";
    for (let i = 0; i < 4; i += 1) {
      const sx = ((i * 220 - distance * 0.2) % (canvas.width + 120)) - 40;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx + 50, 0);
      ctx.lineTo(sx + 110, GROUND_Y);
      ctx.lineTo(sx + 40, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }

    // forest floor sides (moss/grass)
    ctx.fillStyle = "#3D6B32";
    ctx.fillRect(0, GROUND_Y - 8, canvas.width, 14);
    ctx.fillStyle = "#2F5528";
    for (let x = -((distance * 0.5) % 22); x < canvas.width; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y - 2);
      ctx.lineTo(x + 5, GROUND_Y - 14);
      ctx.lineTo(x + 10, GROUND_Y - 2);
      ctx.fill();
    }

    // dirt trail
    ctx.fillStyle = "#6B4A28";
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    ctx.fillStyle = "#8B6438";
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.quadraticCurveTo(canvas.width * 0.35, GROUND_Y - 4, canvas.width * 0.7, GROUND_Y + 2);
    ctx.lineTo(canvas.width, GROUND_Y);
    ctx.lineTo(canvas.width, GROUND_Y + 18);
    ctx.lineTo(0, GROUND_Y + 18);
    ctx.closePath();
    ctx.fill();

    // trail stones / footprints
    const stripe = (distance * 0.55) % 48;
    ctx.fillStyle = "rgba(50, 32, 16, 0.28)";
    for (let x = -stripe; x < canvas.width; x += 48) {
      ctx.beginPath();
      ctx.ellipse(x + 10, GROUND_Y + 18, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + 28, GROUND_Y + 26, 8, 3.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ferns / bushes foreground sides
    for (let i = 0; i < 7; i += 1) {
      const span = canvas.width + 90;
      const bx = ((i * 130 - distance * 0.55) % span + span) % span - 30;
      ctx.fillStyle = i % 2 ? "#2A6B34" : "#1F5530";
      ctx.beginPath();
      ctx.ellipse(bx, GROUND_Y + 8, 22, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx - 8, GROUND_Y + 4);
      ctx.quadraticCurveTo(bx - 18, GROUND_Y - 18, bx - 2, GROUND_Y - 10);
      ctx.quadraticCurveTo(bx + 4, GROUND_Y - 22, bx + 10, GROUND_Y - 6);
      ctx.fill();
    }
  }

  function drawPlayer() {
    const x = player.x;
    const y = player.y;
    const bob = player.onGround ? Math.sin(walkPhase) * 2 : 0;

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(x + 22, GROUND_Y + 4, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (avatarReady && avatarImg) {
      const h = 72;
      const w = 62;
      ctx.drawImage(avatarImg, x - 4, y - h + bob, w, h);

      if (avatarName) {
        ctx.font = "700 13px Manrope, sans-serif";
        const tw = ctx.measureText(avatarName).width;
        const labelX = x + w / 2 - 4;
        const labelY = y - h + bob - 8;
        ctx.fillStyle = "rgba(4, 24, 51, 0.7)";
        ctx.beginPath();
        ctx.roundRect(labelX - tw / 2 - 8, labelY - 14, tw + 16, 20, 10);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.fillText(avatarName, labelX, labelY);
        ctx.textAlign = "left";
      }
      return;
    }

    // fallback bonequinho
    const leg = player.onGround ? Math.sin(walkPhase) * 7 : 4;
    ctx.strokeStyle = "#1A2A4A";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + 14, y - 18 + bob);
    ctx.lineTo(x + 10 - leg, y + bob);
    ctx.moveTo(x + 18, y - 18 + bob);
    ctx.lineTo(x + 22 + leg, y + bob);
    ctx.stroke();
    ctx.fillStyle = "#1A6BFF";
    ctx.fillRect(x + 8, y - 40 + bob, 18, 24);
    ctx.fillStyle = "#C45C26";
    ctx.fillRect(x - 2, y - 44 + bob, 14, 28);
    ctx.fillStyle = "#F2C7A4";
    ctx.beginPath();
    ctx.arc(x + 17, y - 48 + bob, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRock(obs) {
    ctx.fillStyle = "#6E727A";
    ctx.beginPath();
    ctx.moveTo(obs.x, obs.y);
    ctx.lineTo(obs.x + 8, obs.y - obs.h);
    ctx.lineTo(obs.x + obs.w - 6, obs.y - obs.h + 4);
    ctx.lineTo(obs.x + obs.w, obs.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#9AA0A8";
    ctx.beginPath();
    ctx.ellipse(obs.x + 14, obs.y - 16, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSnake(obs) {
    const wave = Math.sin(obs.phase || 0) * 3;
    ctx.strokeStyle = "#2F8F3A";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(obs.x, obs.y - 4);
    ctx.quadraticCurveTo(obs.x + 16, obs.y - 14 + wave, obs.x + 32, obs.y - 4);
    ctx.quadraticCurveTo(obs.x + 40, obs.y + 2 - wave, obs.x + obs.w, obs.y - 6);
    ctx.stroke();
    ctx.fillStyle = "#F5E66B";
    ctx.beginPath();
    ctx.arc(obs.x + obs.w - 2, obs.y - 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.fillRect(obs.x + obs.w, obs.y - 9, 2, 2);
  }

  function drawLog(obs) {
    ctx.fillStyle = "#7A4A22";
    ctx.fillRect(obs.x, obs.y - obs.h, obs.w, obs.h);
    ctx.fillStyle = "#A56B3A";
    ctx.beginPath();
    ctx.ellipse(obs.x + obs.w, obs.y - obs.h / 2, 7, obs.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5A3214";
    ctx.lineWidth = 2;
    for (let i = 1; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(obs.x + i * 16, obs.y - obs.h + 3);
      ctx.lineTo(obs.x + i * 16, obs.y - 3);
      ctx.stroke();
    }
  }

  function drawWaterfall(obs) {
    const grad = ctx.createLinearGradient(obs.x, obs.y - 120, obs.x, obs.y);
    grad.addColorStop(0, "rgba(180,220,255,0.15)");
    grad.addColorStop(1, "rgba(70,160,255,0.75)");
    ctx.fillStyle = grad;
    ctx.fillRect(obs.x + 8, obs.y - 120, obs.w - 16, 120);

    ctx.fillStyle = "#3D6FB5";
    ctx.fillRect(obs.x, obs.y - 18, obs.w, 18);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let i = 0; i < 5; i += 1) {
      const ox = obs.x + 12 + i * 8;
      const oy = obs.y - 100 + ((Date.now() / 30 + i * 17) % 90);
      ctx.fillRect(ox, oy, 3, 10);
    }
    ctx.fillStyle = "#8B6A3D";
    ctx.fillRect(obs.x - 8, obs.y - 122, 18, 14);
    ctx.fillRect(obs.x + obs.w - 10, obs.y - 122, 18, 14);
  }

  function drawRain(obs) {
    ctx.fillStyle = "rgba(90,110,140,0.75)";
    ctx.beginPath();
    ctx.ellipse(obs.x + obs.w / 2, obs.cloudY, obs.w * 0.42, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(obs.x + 22, obs.cloudY + 6, 22, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(obs.x + obs.w - 22, obs.cloudY + 6, 22, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4A6A3A";
    ctx.beginPath();
    ctx.ellipse(obs.x + obs.w / 2, obs.y - 4, obs.w * 0.4, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(80,140,200,0.45)";
    ctx.beginPath();
    ctx.ellipse(obs.x + obs.w / 2, obs.y - 6, obs.w * 0.32, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRainDrops() {
    ctx.strokeStyle = "rgba(200,230,255,0.8)";
    ctx.lineWidth = 1.5;
    rainDrops.forEach((d) => {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 2, d.y + 10);
      ctx.stroke();
    });
  }

  function drawObstacles() {
    obstacles.forEach((obs) => {
      if (obs.type === "rock") drawRock(obs);
      else if (obs.type === "snake") drawSnake(obs);
      else if (obs.type === "log") drawLog(obs);
      else if (obs.type === "waterfall") drawWaterfall(obs);
      else if (obs.type === "rain") drawRain(obs);
    });
    drawRainDrops();
  }

  function drawHudCorner() {
    if (!alive) return;
    ctx.fillStyle = "rgba(4,24,51,0.35)";
    ctx.fillRect(12, 12, 120, 28);
    ctx.fillStyle = "#fff";
    ctx.font = "700 14px Manrope, sans-serif";
    ctx.fillText(`${Math.floor(distance / 18)} m`, 24, 32);
  }

  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    update(dt);
    drawBackground();
    drawObstacles();
    drawPlayer();
    drawHudCorner();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (!selectedAvatarId || !avatarReady) {
      showOverlay("Escolha um avatar para começar", "Começar");
      return;
    }
    resetWorld();
    alive = true;
    running = true;
    hideOverlay();
    lastTs = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function activate() {
    resize();
    renderAvatarGrid();
    if (selectedAvatarId) setAvatar(selectedAvatarId);
    resetWorld();
    drawBackground();
    drawPlayer();
    const av = avatarById(selectedAvatarId);
    showOverlay(
      av
        ? best > 0
          ? `${av.name} · recorde ${Math.floor(best)} m`
          : `Vamos com ${av.name}!`
        : "Escolha um avatar para começar",
      "Começar"
    );
  }

  function deactivate() {
    pause();
    alive = false;
  }

  startBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    start();
  });

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!alive) return;
    jump();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      if (elsActive()) {
        e.preventDefault();
        if (!alive && !overlay.hidden) start();
        else jump();
      }
    }
  });

  function elsActive() {
    const view = document.getElementById("view-trail");
    return view && view.classList.contains("is-active");
  }

  window.addEventListener("resize", () => {
    resize();
    if (!running) {
      drawBackground();
      drawPlayer();
    }
  });

  resize();
  renderAvatarGrid();
  if (selectedAvatarId) setAvatar(selectedAvatarId);
  updateHud();
  showOverlay(
    selectedAvatarId ? "Trilha do Saia da Zona" : "Escolha um avatar para começar",
    "Começar"
  );

  window.SDZ_TRAIL_GAME = { activate, deactivate, jump, setAvatar };
})();
