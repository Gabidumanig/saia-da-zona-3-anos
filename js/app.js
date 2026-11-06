(() => {
  const TEAMS = [
    { id: "bonete", name: "Bonete", color: "var(--team-bonete)" },
    { id: "marins", name: "Marins", color: "var(--team-marins)" },
    { id: "itatiaia", name: "Itatiaia", color: "var(--team-itatiaia)" },
    { id: "lopo", name: "Lopo", color: "var(--team-lopo)" },
  ];

  const AVATARS = [
    { id: "gabi", name: "Gabi", src: "assets/avatars/gabi.svg" },
    { id: "caio", name: "Caio", src: "assets/avatars/caio.svg" },
    { id: "franz", name: "Franz", src: "assets/avatars/franz.svg" },
    { id: "jin", name: "Jin", src: "assets/avatars/jin.svg" },
    { id: "diego", name: "Diego", src: "assets/avatars/diego.svg" },
    { id: "matheus", name: "Matheus", src: "assets/avatars/matheus.svg" },
  ];

  const STORAGE_KEY = "sdz3_participant";
  const ANSWERS_KEY = "sdz3_answers";

  const config = window.SDZ_CONFIG || {};
  const questions = Array.isArray(window.SDZ_QUESTIONS) ? window.SDZ_QUESTIONS : [];
  const pointsPerCorrect = Number(config.pointsPerCorrect) || 10;

  const els = {
    views: {
      home: document.getElementById("view-home"),
      teams: document.getElementById("view-teams"),
      quiz: document.getElementById("view-quiz"),
      trail: document.getElementById("view-trail"),
      scoreboard: document.getElementById("view-scoreboard"),
    },
    teamGrid: document.getElementById("team-grid"),
    avatarGrid: document.getElementById("avatar-grid"),
    playerForm: document.getElementById("player-form"),
    playerName: document.getElementById("player-name"),
    confirmTeam: document.getElementById("confirm-team"),
    teamStatus: document.getElementById("team-status"),
    quizGate: document.getElementById("quiz-gate"),
    quizBoard: document.getElementById("quiz-board"),
    quizDone: document.getElementById("quiz-done"),
    quizTeamChip: document.getElementById("quiz-team-chip"),
    quizProgress: document.getElementById("quiz-progress"),
    questionLabel: document.getElementById("question-label"),
    questionText: document.getElementById("question-text"),
    answers: document.getElementById("answers"),
    quizFeedback: document.getElementById("quiz-feedback"),
    prevQuestion: document.getElementById("prev-question"),
    nextQuestion: document.getElementById("next-question"),
    quizSummary: document.getElementById("quiz-summary"),
    scoreboard: document.getElementById("scoreboard"),
    scoreStatus: document.getElementById("score-status"),
    connectionPill: document.getElementById("connection-pill"),
  };

  let selectedTeamId = null;
  let selectedAvatarId = null;
  let currentQuestion = 0;
  let supabase = null;
  let liveScores = Object.fromEntries(TEAMS.map((t) => [t.id, 0]));
  let localScoreFallback = { ...liveScores };

  function uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function loadParticipant() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveParticipant(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function loadAnswers() {
    try {
      return JSON.parse(localStorage.getItem(ANSWERS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveAnswers(map) {
    localStorage.setItem(ANSWERS_KEY, JSON.stringify(map));
  }

  function teamById(id) {
    return TEAMS.find((t) => t.id === id) || null;
  }

  function avatarById(id) {
    return AVATARS.find((a) => a.id === id) || null;
  }

  function syncTrailAvatar(participant) {
    const avatar = participant ? avatarById(participant.avatarId) : null;
    if (window.SDZ_TRAIL_GAME?.setAvatar) {
      window.SDZ_TRAIL_GAME.setAvatar(avatar ? avatar.src : null);
    }
  }

  function setConnection(live) {
    els.connectionPill.textContent = live ? "ao vivo" : "local";
    els.connectionPill.classList.toggle("is-live", live);
  }

  function showView(name) {
    Object.entries(els.views).forEach(([key, node]) => {
      const active = key === name;
      node.classList.toggle("is-active", active);
      node.hidden = !active;
    });

    document.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-nav") === name);
    });

    if (name === "quiz") renderQuiz();
    if (name === "scoreboard") renderScoreboard();
    if (window.SDZ_TRAIL_GAME) {
      if (name === "trail") window.SDZ_TRAIL_GAME.activate();
      else window.SDZ_TRAIL_GAME.deactivate();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderAvatars() {
    if (!els.avatarGrid) return;
    els.avatarGrid.innerHTML = "";

    AVATARS.forEach((avatar) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "avatar-card";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-label", avatar.name);
      if (selectedAvatarId === avatar.id) btn.classList.add("is-selected");
      btn.innerHTML = `<strong>${avatar.name}</strong><img src="${avatar.src}" alt="" loading="lazy" />`;
      btn.addEventListener("click", () => {
        selectedAvatarId = avatar.id;
        renderAvatars();
        const team = selectedTeamId ? teamById(selectedTeamId) : null;
        els.teamStatus.textContent = team
          ? `Time ${team.name} · avatar ${avatar.name}. Confirme para continuar.`
          : `Avatar ${avatar.name} selecionado.`;
      });
      els.avatarGrid.appendChild(btn);
    });
  }

  function renderTeams() {
    const participant = loadParticipant();
    els.teamGrid.innerHTML = "";

    TEAMS.forEach((team) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "team-card";
      btn.style.setProperty("--team-color", team.color);
      if (participant?.teamId === team.id || selectedTeamId === team.id) {
        btn.classList.add("is-selected");
      }
      btn.innerHTML = `<strong>${team.name}</strong>`;
      btn.addEventListener("click", () => {
        if (participant?.teamId) {
          const av = avatarById(participant.avatarId);
          els.teamStatus.textContent = `Você já está no time ${teamById(participant.teamId).name}${
            av ? ` · ${av.name}` : ""
          }.`;
          return;
        }
        selectedTeamId = team.id;
        renderTeams();
        renderAvatars();
        els.playerForm.hidden = false;
        els.teamStatus.textContent = `Time ${team.name} selecionado. Escolha o avatar e confirme.`;
      });
      els.teamGrid.appendChild(btn);
    });

    if (participant?.teamId && participant.avatarId) {
      els.playerForm.hidden = true;
      const av = avatarById(participant.avatarId);
      els.teamStatus.textContent = `Você está no time ${teamById(participant.teamId).name}${
        av ? ` · ${av.name}` : ""
      }${participant.name ? ` · ${participant.name}` : ""}.`;
    } else if (participant?.teamId && !participant.avatarId) {
      selectedTeamId = participant.teamId;
      els.playerForm.hidden = false;
      renderAvatars();
      els.teamStatus.textContent = "Escolha o seu avatar para continuar.";
    } else if (selectedTeamId) {
      els.playerForm.hidden = false;
      renderAvatars();
    }
  }

  async function confirmTeam() {
    if (!selectedTeamId) {
      els.teamStatus.textContent = "Informe o seu time primeiro.";
      return;
    }
    if (!selectedAvatarId) {
      els.teamStatus.textContent = "Escolha o seu avatar para continuar.";
      return;
    }

    const existing = loadParticipant();
    const participant = {
      id: existing?.id || uid(),
      teamId: selectedTeamId,
      avatarId: selectedAvatarId,
      name: (els.playerName.value || existing?.name || "").trim(),
      joinedAt: existing?.joinedAt || new Date().toISOString(),
    };

    saveParticipant(participant);
    await ensureParticipantRemote(participant);
    syncTrailAvatar(participant);
    renderTeams();
    updateQuizChrome();
    const av = avatarById(participant.avatarId);
    els.teamStatus.textContent = `Pronto! Bem-vindo(a) ao time ${teamById(participant.teamId).name}${
      av ? ` como ${av.name}` : ""
    }.`;
    showView("quiz");
  }

  function answeredCount() {
    return Object.keys(loadAnswers()).length;
  }

  function updateQuizChrome() {
    const participant = loadParticipant();
    const team = participant ? teamById(participant.teamId) : null;
    const avatar = participant ? avatarById(participant.avatarId) : null;
    if (team && avatar) {
      els.quizTeamChip.classList.add("has-avatar");
      els.quizTeamChip.innerHTML = `<img class="avatar-badge" src="${avatar.src}" alt="" />Time ${team.name}`;
    } else {
      els.quizTeamChip.classList.remove("has-avatar");
      els.quizTeamChip.textContent = team ? `Time ${team.name}` : "Sem time";
    }
    els.quizProgress.textContent = `${answeredCount()} / ${questions.length}`;
  }

  function renderQuiz() {
    const participant = loadParticipant();
    updateQuizChrome();

    if (!participant) {
      els.quizGate.hidden = false;
      els.quizBoard.hidden = true;
      els.quizDone.hidden = true;
      return;
    }

    if (answeredCount() >= questions.length && questions.length > 0) {
      els.quizGate.hidden = true;
      els.quizBoard.hidden = true;
      els.quizDone.hidden = false;
      const correct = Object.values(loadAnswers()).filter((a) => a.correct).length;
      els.quizSummary.textContent = `Você acertou ${correct} de ${questions.length}. Os pontos já foram para o time ${
        teamById(participant.teamId).name
      }.`;
      return;
    }

    els.quizGate.hidden = true;
    els.quizDone.hidden = true;
    els.quizBoard.hidden = false;

    const q = questions[currentQuestion];
    if (!q) return;

    const answersMap = loadAnswers();
    const prior = answersMap[q.id];

    els.questionLabel.textContent = `Pergunta ${currentQuestion + 1}`;
    els.questionText.textContent = q.text;
    els.answers.innerHTML = "";
    els.quizFeedback.textContent = "";
    els.quizFeedback.className = "feedback";

    q.options.forEach((option, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "answer-btn";
      btn.textContent = option;

      if (prior) {
        btn.disabled = true;
        if (index === q.correctIndex) btn.classList.add("is-correct");
        if (index === prior.choice && !prior.correct) btn.classList.add("is-wrong");
      }

      btn.addEventListener("click", () => submitAnswer(q, index));
      els.answers.appendChild(btn);
    });

    if (prior) {
      els.quizFeedback.textContent = prior.correct
        ? `Boa! +${pointsPerCorrect} para o seu time.`
        : "Essa não foi. Segue para a próxima.";
      els.quizFeedback.classList.add(prior.correct ? "is-ok" : "is-bad");
    }

    els.prevQuestion.disabled = currentQuestion === 0;
    els.nextQuestion.disabled = !prior || currentQuestion >= questions.length - 1;

    if (prior && currentQuestion >= questions.length - 1 && answeredCount() >= questions.length) {
      els.nextQuestion.disabled = false;
      els.nextQuestion.textContent = "Ver resultado";
    } else {
      els.nextQuestion.textContent = "Próxima";
    }
  }

  async function submitAnswer(question, choiceIndex) {
    const participant = loadParticipant();
    if (!participant) return;

    const answersMap = loadAnswers();
    if (answersMap[question.id]) return;

    const correct = choiceIndex === question.correctIndex;
    answersMap[question.id] = { choice: choiceIndex, correct };
    saveAnswers(answersMap);
    updateQuizChrome();

    if (correct) {
      await awardPoints(participant, question.id);
    } else {
      await recordAnswerRemote(participant, question.id, false);
    }

    renderQuiz();
  }

  async function ensureParticipantRemote(participant) {
    if (!supabase) return;
    const { error } = await supabase.from("participants").upsert(
      {
        id: participant.id,
        team_id: participant.teamId,
        display_name: participant.name || null,
      },
      { onConflict: "id" }
    );
    if (error) console.warn("participant upsert", error.message);
  }

  async function recordAnswerRemote(participant, questionId, correct) {
    if (!supabase) return;
    const { error } = await supabase.from("answers").upsert(
      {
        participant_id: participant.id,
        question_id: questionId,
        team_id: participant.teamId,
        is_correct: correct,
        points: correct ? pointsPerCorrect : 0,
      },
      { onConflict: "participant_id,question_id" }
    );
    if (error) console.warn("answer upsert", error.message);
  }

  async function awardPoints(participant, questionId) {
    localScoreFallback[participant.teamId] =
      (localScoreFallback[participant.teamId] || 0) + pointsPerCorrect;
    liveScores = { ...localScoreFallback };

    if (!supabase) {
      renderScoreboard();
      return;
    }

    // A RPC grava a resposta e soma pontos de forma atómica (sem duplicar)
    const { error } = await supabase.rpc("award_team_points", {
      p_team_id: participant.teamId,
      p_points: pointsPerCorrect,
      p_participant_id: participant.id,
      p_question_id: questionId,
    });

    if (error) {
      console.warn("award_team_points", error.message);
      await recordAnswerRemote(participant, questionId, true);
      const { data } = await supabase
        .from("teams")
        .select("score")
        .eq("id", participant.teamId)
        .maybeSingle();
      const next = (data?.score || 0) + pointsPerCorrect;
      await supabase.from("teams").update({ score: next }).eq("id", participant.teamId);
    }
  }

  function renderScoreboard() {
    const max = Math.max(1, ...Object.values(liveScores));
    const ranked = [...TEAMS].sort(
      (a, b) => (liveScores[b.id] || 0) - (liveScores[a.id] || 0)
    );

    els.scoreboard.innerHTML = "";
    ranked.forEach((team, index) => {
      const points = liveScores[team.id] || 0;
      const row = document.createElement("article");
      row.className = "score-row" + (index === 0 ? " is-lead" : "");
      row.style.setProperty("--team-color", team.color);
      row.innerHTML = `
        <div class="rank">${index + 1}</div>
        <div><strong>${team.name}</strong></div>
        <div class="score-points">${points}</div>
        <div class="bar"><span style="width:${(points / max) * 100}%"></span></div>
      `;
      els.scoreboard.appendChild(row);
    });
  }

  async function initSupabase() {
    const url = (config.supabaseUrl || "").trim();
    const key = (config.supabaseAnonKey || "").trim();

    if (!url || !key || !window.supabase) {
      setConnection(false);
      els.scoreStatus.textContent =
        "Modo local: configure o Supabase em js/config.js para placar compartilhado ao vivo.";
      liveScores = { ...localScoreFallback };
      renderScoreboard();
      return;
    }

    supabase = window.supabase.createClient(url, key);
    setConnection(true);

    const { data, error } = await supabase.from("teams").select("id, score");
    if (error) {
      setConnection(false);
      els.scoreStatus.textContent = `Não foi possível conectar ao placar: ${error.message}`;
      return;
    }

    data.forEach((row) => {
      liveScores[row.id] = row.score || 0;
      localScoreFallback[row.id] = row.score || 0;
    });
    els.scoreStatus.textContent = "Placar sincronizado em tempo real.";
    renderScoreboard();

    supabase
      .channel("teams-score")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          const row = payload.new;
          if (!row?.id) return;
          liveScores[row.id] = row.score || 0;
          localScoreFallback[row.id] = row.score || 0;
          renderScoreboard();
        }
      )
      .subscribe();
  }

  function bindNav() {
    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.addEventListener("click", () => showView(el.getAttribute("data-nav")));
    });
  }

  function bindQuizNav() {
    els.prevQuestion.addEventListener("click", () => {
      if (currentQuestion > 0) {
        currentQuestion -= 1;
        renderQuiz();
      }
    });

    els.nextQuestion.addEventListener("click", () => {
      if (answeredCount() >= questions.length) {
        renderQuiz();
        return;
      }
      if (currentQuestion < questions.length - 1) {
        currentQuestion += 1;
        renderQuiz();
      }
    });
  }

  bindNav();
  bindQuizNav();
  els.confirmTeam.addEventListener("click", confirmTeam);
  renderTeams();
  renderAvatars();
  updateQuizChrome();
  syncTrailAvatar(loadParticipant());
  showView("home");
  initSupabase();
})();
