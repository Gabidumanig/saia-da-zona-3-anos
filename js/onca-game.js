(() => {
  const BEST_KEY = "sdz3_onca_best";
  const LANES = 3;

  const LEADERS = [
    { id: "franz", name: "Franz", src: "assets/avatars/franz-bandage.svg?v=97" },
    { id: "diego", name: "Diego", src: "assets/avatars/diego-v6.svg?v=97" },
    { id: "gabi", name: "Gabi", src: "assets/avatars/gabi-v7.svg?v=97" },
    { id: "jin", name: "Jin", src: "assets/avatars/jin-v6.svg?v=97" },
    { id: "caio", name: "Caio", src: "assets/avatars/caio-v7.svg?v=97" },
    { id: "matheus", name: "Matheus", src: "assets/avatars/matheus-v6.svg?v=97" },
  ];

  const canvas = document.getElementById("onca-canvas");
  const overlay = document.getElementById("onca-overlay");
  const messageEl = document.getElementById("onca-message");
  const startBtn = document.getElementById("onca-start");
  const scoreEl = document.getElementById("onca-score");
  const bestEl = document.getElementById("onca-best");
  const distEl = document.getElementById("onca-dist");
  const avatarGrid = document.getElementById("onca-avatar-grid");

  if (!canvas || !overlay || !startBtn) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  let active = false;
  let running = false;
  let raf = 0;
  let lastTs = 0;
  let score = 0;
  let coinScore = 0;
  let distance = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let submitted = false;
  let lane = 1;
  let targetLane = 1;
  let laneX = 0;
  let jumpY = 0;
  let jumpV = 0;
  let sliding = false;
  let slideTimer = 0;
  let speed = 320;
  let spawnTimer = 0;
  let obstacles = [];
  let coins = [];
  let groundScroll = 0;
  let selectedId = localStorage.getItem("sdz3_onca_avatar") || "gabi";
  let leaderImg = null;
  let leaderImgs = {};
  let bob = 0;
  let hitFlash = 0;
  let oncaGap = 140;

  function laneCenter(i) {
    const roadW = 420;
    const left = (W - roadW) / 2;
    return left + roadW * ((i + 0.5) / LANES);
  }

  function updateChrome() {
    if (scoreEl) scoreEl.textContent = `${score} pts`;
    if (distEl) distEl.textContent = `${Math.floor(distance)} m`;
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

  function loadAvatars() {
    LEADERS.forEach((a) => {
      const img = new Image();
      img.onload = () => {
        leaderImgs[a.id] = img;
        if (a.id === selectedId) leaderImg = img;
      };
      img.src = a.src;
    });
  }

  function renderAvatarPicker() {
    if (!avatarGrid) return;
    avatarGrid.innerHTML = "";
    LEADERS.forEach((a) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "avatar-card";
      if (a.id === selectedId) btn.classList.add("is-selected");
      btn.innerHTML = `<strong>${a.name}</strong><img src="${a.src}" alt="${a.name}" width="72" height="84" />`;
      btn.addEventListener("click", () => {
        selectedId = a.id;
        localStorage.setItem("sdz3_onca_avatar", a.id);
        leaderImg = leaderImgs[a.id] || null;
        renderAvatarPicker();
      });
      avatarGrid.appendChild(btn);
    });
  }

  function resetRun() {
    score = 0;
    coinScore = 0;
    distance = 0;
    lane = 1;
    targetLane = 1;
    laneX = laneCenter(1);
    jumpY = 0;
    jumpV = 0;
    sliding = false;
    slideTimer = 0;
    speed = 340;
    spawnTimer = 0.6;
    obstacles = [];
    coins = [];
    groundScroll = 0;
    submitted = false;
    hitFlash = 0;
    oncaGap = 150;
    bob = 0;
  }

  function spawnObstacle() {
    const kind = Math.random() < 0.55 ? "rock" : Math.random() < 0.5 ? "log" : "bush";
    const laneId = Math.floor(Math.random() * LANES);
    obstacles.push({
      kind,
      lane: laneId,
      z: 1100 + Math.random() * 200,
      w: kind === "log" ? 70 : 46,
      h: kind === "bush" ? 40 : 50,
    });
    if (Math.random() < 0.7) {
      const cl = (laneId + 1 + Math.floor(Math.random() * 2)) % LANES;
      coins.push({ lane: cl, z: 950 + Math.random() * 180, r: 12, taken: false });
    }
  }

  function startGame() {
    if (window.SDZ_RANKING?.requireName && !window.SDZ_RANKING.requireName("onca")) {
      return;
    }
    if (!selectedId) {
      showOverlay("Escolha um líder pra correr!", "Começar");
      return;
    }
    resetRun();
    running = true;
    hideOverlay();
    updateChrome();
    lastTs = 0;
    if (!raf) raf = requestAnimationFrame(frame);
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
      window.SDZ_PLAYER.submitScore("onca", score);
    }
    showOverlay(`A onça te alcançou! ${Math.floor(distance)} m · ${score} pts`, "Correr de novo");
  }

  function jump() {
    if (!running || jumpY > 0 || sliding) return;
    jumpV = -520;
  }

  function slide() {
    if (!running || jumpY > 0) return;
    sliding = true;
    slideTimer = 0.55;
  }

  function changeLane(dir) {
    if (!running) return;
    targetLane = Math.max(0, Math.min(LANES - 1, targetLane + dir));
  }

  function project(z) {
    const near = 120;
    const far = 1200;
    const t = 1 - Math.max(0, Math.min(1, (z - near) / (far - near)));
    const scale = 0.35 + t * 0.9;
    const y = H * 0.28 + (1 - t) * (H * 0.55);
    return { scale, y, t };
  }

  function step(dt) {
    bob += dt * 10;
    speed += dt * 6;
    distance += (speed * dt) / 8;
    score = Math.floor(distance) + coinScore;
    groundScroll = (groundScroll + speed * dt) % 80;
    oncaGap = Math.max(70, oncaGap - dt * 1.5);

    const desired = laneCenter(targetLane);
    laneX += (desired - laneX) * Math.min(1, dt * 12);
    if (Math.abs(desired - laneX) < 2) lane = targetLane;

    if (jumpY > 0 || jumpV < 0) {
      jumpV += 1600 * dt;
      jumpY += jumpV * dt;
      if (jumpY >= 0) {
        jumpY = 0;
        jumpV = 0;
      }
    }

    if (sliding) {
      slideTimer -= dt;
      if (slideTimer <= 0) sliding = false;
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = Math.max(0.55, 1.35 - speed / 900);
    }

    const run = speed * dt * 1.15;
    obstacles.forEach((o) => {
      o.z -= run;
    });
    coins.forEach((c) => {
      c.z -= run;
    });
    obstacles = obstacles.filter((o) => o.z > 80);
    coins = coins.filter((c) => c.z > 80 && !c.taken);

    // colisão
    const playerZ = 220;
    obstacles.forEach((o) => {
      if (Math.abs(o.z - playerZ) < 36 && o.lane === lane) {
        const high = o.kind === "log" || o.kind === "rock";
        const low = o.kind === "bush";
        if (high && jumpY > 28) return;
        if (low && sliding) return;
        hitFlash = 0.35;
        endGame();
      }
    });

    coins.forEach((c) => {
      if (c.taken) return;
      if (Math.abs(c.z - playerZ) < 30 && c.lane === lane && jumpY < 40) {
        c.taken = true;
        coinScore += 25;
        score = Math.floor(distance) + coinScore;
        updateChrome();
      }
    });

    if (hitFlash > 0) hitFlash -= dt;
    updateChrome();
  }

  function drawRoad() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#6EB6D9");
    g.addColorStop(0.45, "#8FBF6A");
    g.addColorStop(1, "#3F6B3A");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // montanhas
    ctx.fillStyle = "#3F6B45";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.42);
    ctx.lineTo(120, H * 0.22);
    ctx.lineTo(260, H * 0.4);
    ctx.lineTo(420, H * 0.18);
    ctx.lineTo(600, H * 0.38);
    ctx.lineTo(780, H * 0.2);
    ctx.lineTo(W, H * 0.36);
    ctx.lineTo(W, H * 0.5);
    ctx.lineTo(0, H * 0.5);
    ctx.fill();

    // estrada em perspectiva
    ctx.fillStyle = "#6B5340";
    ctx.beginPath();
    ctx.moveTo(W * 0.5 - 40, H * 0.34);
    ctx.lineTo(W * 0.5 + 40, H * 0.34);
    ctx.lineTo(W * 0.5 + 240, H);
    ctx.lineTo(W * 0.5 - 240, H);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i += 1) {
      const z = 180 + i * 120 + (groundScroll % 120);
      const p = project(z);
      const x = W / 2;
      const len = 18 * p.scale;
      ctx.beginPath();
      ctx.moveTo(x - len, p.y);
      ctx.lineTo(x + len, p.y);
      ctx.stroke();
    }

    // faixas laterais
    ctx.strokeStyle = "rgba(255,220,120,0.45)";
    ctx.lineWidth = 2;
    for (let i = 1; i < LANES; i += 1) {
      ctx.beginPath();
      ctx.moveTo(laneCenter(i - 0.5), H * 0.36);
      ctx.lineTo(laneCenter(i - 0.5) + (i === 1 ? -90 : 90), H);
      // simplified vertical separators via road edges only
    }
  }

  function drawJaguar() {
    const p = project(95);
    const x = laneX - 8;
    const y = p.y - 10;
    const s = 0.9;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // corpo
    ctx.fillStyle = "#E0A030";
    ctx.beginPath();
    ctx.ellipse(0, 0, 38, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    // manchas
    ctx.fillStyle = "#3A2A12";
    [[-16, -4], [-4, 2], [10, -6], [18, 4], [-22, 6]].forEach(([px, py]) => {
      ctx.beginPath();
      ctx.ellipse(px, py, 4, 3, 0.3, 0, Math.PI * 2);
      ctx.fill();
    });
    // cabeça
    ctx.fillStyle = "#E8B040";
    ctx.beginPath();
    ctx.arc(34, -8, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(40, -10, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "800 11px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ONÇA", 0, 36);
    ctx.restore();
  }

  function drawObstacle(o) {
    const p = project(o.z);
    const x = laneCenter(o.lane);
    const y = p.y;
    const s = p.scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (o.kind === "rock") {
      ctx.fillStyle = "#8B949E";
      ctx.beginPath();
      ctx.moveTo(-24, 10);
      ctx.lineTo(-10, -22);
      ctx.lineTo(18, -14);
      ctx.lineTo(26, 10);
      ctx.closePath();
      ctx.fill();
    } else if (o.kind === "log") {
      ctx.fillStyle = "#8B5A2B";
      ctx.fillRect(-36, -12, 72, 22);
      ctx.fillStyle = "#C99555";
      ctx.beginPath();
      ctx.arc(-36, -1, 11, 0, Math.PI * 2);
      ctx.arc(36, -1, 11, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#2F7A3C";
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6B4226";
      ctx.fillRect(-3, 8, 6, 14);
    }
    ctx.restore();
  }

  function drawCoin(c) {
    if (c.taken) return;
    const p = project(c.z);
    const x = laneCenter(c.lane);
    ctx.save();
    ctx.translate(x, p.y - 20 * p.scale);
    ctx.scale(p.scale, p.scale);
    ctx.fillStyle = "#FFD166";
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#C58A12";
    ctx.font = "800 10px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SZ", 0, 3);
    ctx.restore();
  }

  function drawPlayer() {
    const baseY = H * 0.72;
    const x = laneX;
    const y = baseY + Math.sin(bob) * 3 - jumpY * 0.12;
    const h = sliding ? 46 : 78;
    const w = 56;
    ctx.save();
    ctx.translate(x, y);
    if (leaderImg) {
      ctx.drawImage(leaderImg, -w / 2, -h, w, h);
    } else {
      ctx.fillStyle = "#1A6BFF";
      ctx.fillRect(-20, -60, 40, 60);
    }
    const leader = LEADERS.find((a) => a.id === selectedId);
    ctx.fillStyle = "rgba(8,24,16,0.8)";
    ctx.fillRect(-34, -h - 22, 68, 18);
    ctx.fillStyle = "#fff";
    ctx.font = "800 11px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(leader?.name || "Líder", 0, -h - 9);
    ctx.restore();
  }

  function draw() {
    drawRoad();

    const drawable = [
      ...obstacles.map((o) => ({ z: o.z, draw: () => drawObstacle(o) })),
      ...coins.map((c) => ({ z: c.z, draw: () => drawCoin(c) })),
    ].sort((a, b) => b.z - a.z);
    drawable.forEach((d) => d.draw());

    drawJaguar();
    drawPlayer();

    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,40,40,${hitFlash})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.fillStyle = "rgba(8,24,16,0.88)";
    ctx.fillRect(12, 12, 220, 34);
    ctx.fillStyle = "#fff";
    ctx.font = "700 14px Manrope, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Foge da onça · ${Math.floor(distance)} m`, 22, 34);
  }

  function frame(ts) {
    if (!active) {
      raf = 0;
      return;
    }
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.033, (ts - lastTs) / 1000);
    lastTs = ts;
    if (running) step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function onKey(e) {
    if (!active) return;
    if (["ArrowLeft", "a", "A"].includes(e.key)) {
      e.preventDefault();
      changeLane(-1);
    } else if (["ArrowRight", "d", "D"].includes(e.key)) {
      e.preventDefault();
      changeLane(1);
    } else if (["ArrowUp", "w", "W", " "].includes(e.key)) {
      e.preventDefault();
      jump();
    } else if (["ArrowDown", "s", "S"].includes(e.key)) {
      e.preventDefault();
      slide();
    }
  }

  let touchStart = null;
  canvas.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener("touchend", (e) => {
    if (!touchStart || !running) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 28) changeLane(dx > 0 ? 1 : -1);
    else if (dy < -28) jump();
    else if (dy > 28) slide();
    touchStart = null;
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

  loadAvatars();
  renderAvatarPicker();
  updateChrome();
  showOverlay("Escolha o líder e fuja da onça na trilha!", "Começar");
  draw();

  window.SDZ_ONCA_GAME = { activate, deactivate };
})();
