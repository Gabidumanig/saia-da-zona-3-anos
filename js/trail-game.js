(() => {
  const BEST_KEY = "sdz3_trail_best";
  const AVATAR_KEY = "sdz3_trail_avatar";
  const GRAVITY = 2400;
  const JUMP_V = -820;
  const PATH_X = 0.5;

  const AVATARS = [
    { id: "franz", name: "Franz", src: "assets/avatars/franz-v6.svg?v=67" },
    { id: "diego", name: "Diego", src: "assets/avatars/diego-v6.svg?v=67" },
    { id: "gabi", name: "Gabi", src: "assets/avatars/gabi-v6.svg?v=67" },
    { id: "jin", name: "Jin", src: "assets/avatars/jin-v6.svg?v=67" },
    { id: "caio", name: "Caio", src: "assets/avatars/caio-v7.svg?v=67" },
    { id: "matheus", name: "Matheus", src: "assets/avatars/matheus-v6.svg?v=67" },
  ];

  const canvas = document.getElementById("trail-canvas");
  const overlay = document.getElementById("trail-overlay");
  const messageEl = document.getElementById("trail-message");
  const startBtn = document.getElementById("trail-start");
  const scoreEl = document.getElementById("trail-score");
  const bestEl = document.getElementById("trail-best");
  const avatarGrid = document.getElementById("avatar-grid");
  const avatarStatus = document.getElementById("avatar-status");

  if (!canvas || !overlay || !startBtn || !avatarGrid) return;

  const ctx = canvas.getContext("2d");
  let running = false;
  let alive = false;
  let raf = 0;
  let lastTs = 0;
  let altitude = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let climbSpeed = 160;
  let spawnTimer = 0;
  let obstacles = [];
  let rainDrops = [];
  let walkPhase = 0;
  let selectedAvatarId = localStorage.getItem(AVATAR_KEY) || null;
  let avatarImg = null;
  let avatarReady = false;
  let avatarName = "";

  // worldY grows as we climb; player.baseY is the resting height on screen
  const player = {
    x: 0,
    y: 0,
    vy: 0,
    w: 46,
    h: 64,
    onGround: true,
  };

  function groundY() {
    return canvas.height * 0.72;
  }

  function pathCenterX() {
    return canvas.width * PATH_X;
  }

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
    avatarGrid.innerHTML = "";
    AVATARS.forEach((avatar) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "avatar-card";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-label", avatar.name);
      if (selectedAvatarId === avatar.id) btn.classList.add("is-selected");
      btn.innerHTML = `<strong>${avatar.name}</strong><img src="${avatar.src}" alt="${avatar.name}" width="96" height="112" />`;
      btn.addEventListener("click", () => {
        setAvatar(avatar.id);
        renderAvatarGrid();
        if (avatarStatus) avatarStatus.textContent = `Avatar selecionado: ${avatar.name}. Agora toque em Começar.`;
        if (!alive) showOverlay(`Vamos com ${avatar.name}!`, "Começar");
      });
      avatarGrid.appendChild(btn);
    });

    if (avatarStatus && !selectedAvatarId) {
      avatarStatus.textContent = "Toque em um avatar para selecionar.";
    }
  }

  function resize() {
    const parent = canvas.parentElement;
    const maxW = Math.min(900, parent.clientWidth);
    const ratio = 420 / 900;
    canvas.style.width = `${maxW}px`;
    canvas.style.height = `${Math.round(maxW * ratio)}px`;
  }

  function resetWorld() {
    altitude = 0;
    climbSpeed = 160;
    spawnTimer = 0.9;
    obstacles = [];
    rainDrops = [];
    player.x = pathCenterX() - player.w / 2;
    player.y = groundY();
    player.vy = 0;
    player.onGround = true;
    walkPhase = 0;
    updateHud();
  }

  function updateHud() {
    const meters = Math.floor(altitude / 14);
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
    const roll = Math.random();
    if (roll < 0.26) return "rock";
    if (roll < 0.46) return "snake";
    if (roll < 0.64) return "log";
    if (roll < 0.82) return "waterfall";
    return "rain";
  }

  function spawnObstacle() {
    const type = pickObstacle();
    const cx = pathCenterX();
    const base = { type, y: -40, hit: false };

    if (type === "rock") {
      const w = 36;
      obstacles.push({ ...base, w, h: 28, x: cx - w / 2 + (Math.random() * 30 - 15) });
    } else if (type === "snake") {
      const w = 48;
      obstacles.push({ ...base, w, h: 16, x: cx - w / 2 + (Math.random() * 24 - 12), phase: 0 });
    } else if (type === "log") {
      const w = 54;
      obstacles.push({ ...base, w, h: 22, x: cx - w / 2 });
    } else if (type === "waterfall") {
      const w = 70;
      obstacles.push({ ...base, w, h: 120, x: cx - w / 2 });
    } else if (type === "rain") {
      const w = 100;
      obstacles.push({ ...base, w, h: 24, x: cx - w / 2, cloudY: 0 });
    }
  }

  function hitbox(obs) {
    if (obs.type === "waterfall") {
      return { x: obs.x + 12, y: obs.y - 36, w: obs.w - 24, h: 36 };
    }
    if (obs.type === "rain") {
      return { x: obs.x + 14, y: obs.y - 18, w: obs.w - 28, h: 18 };
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
    const meters = Math.floor(altitude / 14);
    if (meters > best) {
      best = meters;
      localStorage.setItem(BEST_KEY, String(best));
    }
    updateHud();
    if (window.SDZ_PLAYER?.submitScore) {
      window.SDZ_PLAYER.submitScore("trail", meters);
    }
    showOverlay(`Queda na subida · ${meters} m`, "Tentar de novo");
  }

  function update(dt) {
    if (!alive) return;

    altitude += climbSpeed * dt;
    climbSpeed = Math.min(340, 160 + altitude / 700);
    walkPhase += dt * (player.onGround ? 11 : 0);

    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    const gy = groundY();
    if (player.y >= gy) {
      player.y = gy;
      player.vy = 0;
      player.onGround = true;
    }
    player.x = pathCenterX() - player.w / 2;

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = Math.max(0.75, 1.55 - altitude / 7000) + Math.random() * 0.5;
    }

    const scroll = climbSpeed * dt;
    obstacles.forEach((obs) => {
      obs.y += scroll;
      if (obs.type === "snake") obs.phase = (obs.phase || 0) + dt * 8;
      if (obs.type === "rain") obs.cloudY = obs.y - 110;
    });
    obstacles = obstacles.filter((obs) => obs.y - obs.h < canvas.height + 60);

    rainDrops = rainDrops.filter((d) => d.y < canvas.height + 20);
    obstacles
      .filter((o) => o.type === "rain")
      .forEach((o) => {
        if (Math.random() < 0.5) {
          rainDrops.push({
            x: o.x + 10 + Math.random() * (o.w - 20),
            y: (o.cloudY || o.y - 110) + 28,
            vy: 220 + Math.random() * 140,
          });
        }
      });
    rainDrops.forEach((d) => {
      d.y += d.vy * dt + scroll * 0.35;
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
    const W = canvas.width;
    const H = canvas.height;
    const gy = groundY();
    const scroll = altitude;

    // mountain sky → ridge
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#7EC8E8");
    g.addColorStop(0.22, "#4A8F6A");
    g.addColorStop(0.55, "#2F6B45");
    g.addColorStop(1, "#1F4A30");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // distant peaks (scroll slowly)
    for (let i = 0; i < 5; i += 1) {
      const span = H + 220;
      const py = ((i * 160 + scroll * 0.15) % span) - 40;
      ctx.fillStyle = i % 2 ? "rgba(36, 74, 52, 0.55)" : "rgba(28, 60, 42, 0.5)";
      ctx.beginPath();
      ctx.moveTo(0, py + 120);
      ctx.lineTo(W * 0.22, py);
      ctx.lineTo(W * 0.4, py + 90);
      ctx.lineTo(0, py + 140);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(W, py + 130);
      ctx.lineTo(W * 0.78, py + 10);
      ctx.lineTo(W * 0.58, py + 100);
      ctx.lineTo(W, py + 150);
      ctx.closePath();
      ctx.fill();
    }

    // side forest scrolling upward (visual: trees move down)
    for (let i = 0; i < 9; i += 1) {
      const span = H + 180;
      const ty = ((i * 95 + scroll * 0.45) % span) - 60;
      drawTree(W * 0.12 + (i % 2) * 18, ty + 80, 0.75 + (i % 3) * 0.1, true);
      drawTree(W * 0.88 - (i % 2) * 16, ty + 70, 0.8 + (i % 2) * 0.12, true);
    }
    for (let i = 0; i < 7; i += 1) {
      const span = H + 200;
      const ty = ((i * 120 + scroll * 0.7) % span) - 50;
      drawTree(W * 0.2 + (i % 3) * 8, ty + 90, 1 + (i % 2) * 0.12, false);
      drawTree(W * 0.8 - (i % 3) * 8, ty + 85, 1.05, false);
    }

    // cliff walls framing the trail
    ctx.fillStyle = "#3A4A38";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W * 0.28, 0);
    for (let i = 0; i <= 10; i += 1) {
      const yy = (i / 10) * H;
      const wobble = Math.sin((yy + scroll) * 0.02) * 10;
      ctx.lineTo(W * 0.26 + wobble, yy);
    }
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(W, 0);
    ctx.lineTo(W * 0.72, 0);
    for (let i = 0; i <= 10; i += 1) {
      const yy = (i / 10) * H;
      const wobble = Math.sin((yy + scroll) * 0.02 + 1.2) * 10;
      ctx.lineTo(W * 0.74 + wobble, yy);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // climbing dirt path up the center
    const pathW = Math.min(150, W * 0.28);
    const cx = pathCenterX();
    ctx.fillStyle = "#6B4A28";
    ctx.beginPath();
    ctx.moveTo(cx - pathW * 0.55, H);
    for (let i = 0; i <= 16; i += 1) {
      const t = i / 16;
      const yy = H - t * H;
      const sway = Math.sin((yy + scroll * 0.9) * 0.03) * 18;
      ctx.lineTo(cx - pathW * 0.5 + sway, yy);
    }
    for (let i = 16; i >= 0; i -= 1) {
      const t = i / 16;
      const yy = H - t * H;
      const sway = Math.sin((yy + scroll * 0.9) * 0.03) * 18;
      ctx.lineTo(cx + pathW * 0.5 + sway, yy);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#8B6438";
    ctx.beginPath();
    ctx.moveTo(cx - pathW * 0.32, H);
    for (let i = 0; i <= 16; i += 1) {
      const t = i / 16;
      const yy = H - t * H;
      const sway = Math.sin((yy + scroll * 0.9) * 0.03) * 18;
      ctx.lineTo(cx - pathW * 0.28 + sway, yy);
    }
    for (let i = 16; i >= 0; i -= 1) {
      const t = i / 16;
      const yy = H - t * H;
      const sway = Math.sin((yy + scroll * 0.9) * 0.03) * 18;
      ctx.lineTo(cx + pathW * 0.28 + sway, yy);
    }
    ctx.closePath();
    ctx.fill();

    // switchback steps / stones on the path
    ctx.fillStyle = "rgba(50, 32, 16, 0.3)";
    for (let i = 0; i < 14; i += 1) {
      const span = H + 60;
      const sy = ((i * 48 + scroll * 0.95) % span) - 20;
      const sway = Math.sin((sy + scroll * 0.9) * 0.03) * 18;
      ctx.beginPath();
      ctx.ellipse(cx - 12 + sway, sy, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 14 + sway, sy + 10, 12, 4.5, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }

    // summit mist near top of view
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 0, W, 50);

    // standing ledge under player
    ctx.fillStyle = "#4A6B38";
    ctx.fillRect(0, gy + 2, W, H - gy);
    ctx.fillStyle = "#3D6B32";
    ctx.fillRect(cx - pathW * 0.6, gy - 6, pathW * 1.2, 14);
  }

  function drawPlayer() {
    const x = player.x;
    const y = player.y;
    const bob = player.onGround ? Math.sin(walkPhase) * 2 : 0;
    const gy = groundY();

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(x + 22, gy + 4, 20, 5, 0, 0, Math.PI * 2);
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
      const ox = obs.x + 14 + i * 9;
      const oy = obs.y - 100 + ((Date.now() / 30 + i * 17) % 90);
      ctx.fillRect(ox, oy, 3, 10);
    }
    ctx.fillStyle = "#8B6A3D";
    ctx.fillRect(obs.x - 8, obs.y - 122, 18, 14);
    ctx.fillRect(obs.x + obs.w - 10, obs.y - 122, 18, 14);
  }

  function drawRain(obs) {
    const cloudY = obs.cloudY || obs.y - 110;
    ctx.fillStyle = "rgba(90,110,140,0.75)";
    ctx.beginPath();
    ctx.ellipse(obs.x + obs.w / 2, cloudY, obs.w * 0.42, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(obs.x + 22, cloudY + 6, 22, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(obs.x + obs.w - 22, cloudY + 6, 22, 12, 0, 0, Math.PI * 2);
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
    ctx.fillRect(12, 12, 140, 28);
    ctx.fillStyle = "#fff";
    ctx.font = "700 14px Manrope, sans-serif";
    ctx.fillText(`↑ ${Math.floor(altitude / 14)} m`, 24, 32);
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
    if (window.SDZ_RANKING?.requireName && !window.SDZ_RANKING.requireName("trail")) {
      showOverlay("Salva teu nome acima pra jogar", "Começar");
      return;
    }
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
    const t = e.target;
    const tag = (t && t.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) return;
    if (document.getElementById("name-modal")?.classList.contains("is-open")) return;
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
      player.x = pathCenterX() - player.w / 2;
      player.y = groundY();
      drawBackground();
      drawPlayer();
    }
  });

  resize();
  renderAvatarGrid();
  if (selectedAvatarId) setAvatar(selectedAvatarId);
  resetWorld();
  updateHud();
  showOverlay(
    selectedAvatarId ? "Subida com o Líder" : "Escolha um avatar para começar",
    "Começar"
  );

  window.SDZ_TRAIL_GAME = { activate, deactivate, jump, setAvatar };
})();
