(() => {
  const ANSWERS_KEY = "sdz3_answers";
  const SESSION_KEY = "sdz3_quiz_session";
  const QUIZ_SIZE = 12;

  const config = window.SDZ_CONFIG || {};
  const questionBank = Array.isArray(window.SDZ_QUESTIONS) ? window.SDZ_QUESTIONS : [];
  const pointsPerCorrect = Number(config.pointsPerCorrect) || 10;
  let sessionQuestions = [];
  let currentQuestion = 0;
  let quizScoreSent = false;

  const els = {
    views: {
      home: document.getElementById("view-home"),
      infos: document.getElementById("view-infos"),
      quiz: document.getElementById("view-quiz"),
      trail: document.getElementById("view-trail"),
      pack: document.getElementById("view-pack"),
    },
    quizBoard: document.getElementById("quiz-board"),
    quizDone: document.getElementById("quiz-done"),
    quizProgress: document.getElementById("quiz-progress"),
    questionLabel: document.getElementById("question-label"),
    questionText: document.getElementById("question-text"),
    answers: document.getElementById("answers"),
    quizFeedback: document.getElementById("quiz-feedback"),
    prevQuestion: document.getElementById("prev-question"),
    nextQuestion: document.getElementById("next-question"),
    quizSummary: document.getElementById("quiz-summary"),
    quizScore: document.getElementById("quiz-score"),
    playAgain: document.getElementById("play-again"),
  };

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

  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveSession(data) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  }

  function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickRandomQuestions() {
    const size = Math.min(QUIZ_SIZE, questionBank.length);
    return shuffle(questionBank).slice(0, size);
  }

  function questionsFromIds(ids) {
    const byId = Object.fromEntries(questionBank.map((q) => [q.id, q]));
    return ids.map((id) => byId[id]).filter(Boolean);
  }

  function startQuizSession() {
    const picked = pickRandomQuestions();
    saveSession({ questionIds: picked.map((q) => q.id) });
    saveAnswers({});
    currentQuestion = 0;
    quizScoreSent = false;
    sessionQuestions = picked;
    return sessionQuestions;
  }

  function ensureQuizSession() {
    const session = loadSession();
    if (Array.isArray(session?.questionIds) && session.questionIds.length === QUIZ_SIZE) {
      const restored = questionsFromIds(session.questionIds);
      if (restored.length === QUIZ_SIZE) {
        sessionQuestions = restored;
        return sessionQuestions;
      }
    }
    return startQuizSession();
  }

  function answeredCount() {
    const ids = new Set(sessionQuestions.map((q) => q.id));
    return Object.keys(loadAnswers()).filter((id) => ids.has(id)).length;
  }

  function correctCount() {
    const ids = new Set(sessionQuestions.map((q) => q.id));
    return Object.entries(loadAnswers()).filter(
      ([id, a]) => ids.has(id) && a.correct
    ).length;
  }

  function updateQuizChrome() {
    const total = sessionQuestions.length || QUIZ_SIZE;
    els.quizProgress.textContent = `${answeredCount()} / ${total}`;
  }

  function showView(name) {
    Object.entries(els.views).forEach(([key, node]) => {
      if (!node) return;
      const active = key === name;
      node.classList.toggle("is-active", active);
      node.hidden = !active;
    });

    document.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-nav") === name);
    });

    if (name === "quiz") renderQuiz();
    if (["quiz", "trail", "pack"].includes(name)) {
      window.SDZ_RANKING?.syncNameForms?.();
      window.SDZ_RANKING?.refresh?.();
    }
    if (window.SDZ_TRAIL_GAME) {
      if (name === "trail") window.SDZ_TRAIL_GAME.activate();
      else window.SDZ_TRAIL_GAME.deactivate();
    }
    if (window.SDZ_PACK_GAME) {
      if (name === "pack") window.SDZ_PACK_GAME.activate();
      else window.SDZ_PACK_GAME.deactivate();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderQuiz() {
    ensureQuizSession();
    updateQuizChrome();

    const total = sessionQuestions.length;
    if (answeredCount() >= total && total > 0) {
      els.quizBoard.hidden = true;
      els.quizDone.hidden = false;
      const correct = correctCount();
      const points = correct * pointsPerCorrect;
      els.quizScore.textContent = `${correct} / ${total}`;
      els.quizSummary.textContent =
        correct === total
          ? `Gabaritou! ${points} pontos.`
          : `Você fez ${points} pontos (${correct} acerto${correct === 1 ? "" : "s"}).`;
      if (!quizScoreSent && window.SDZ_PLAYER?.submitScore) {
        quizScoreSent = true;
        window.SDZ_PLAYER.submitScore("quiz", points);
      }
      return;
    }

    els.quizDone.hidden = true;
    els.quizBoard.hidden = false;

    const q = sessionQuestions[currentQuestion];
    if (!q) return;

    const answersMap = loadAnswers();
    const prior = answersMap[q.id];

    els.questionLabel.textContent = `Pergunta ${currentQuestion + 1} de ${total}`;
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
        ? `Boa! +${pointsPerCorrect} pontos.`
        : "Essa não foi. Segue para a próxima.";
      els.quizFeedback.classList.add(prior.correct ? "is-ok" : "is-bad");
    }

    els.prevQuestion.disabled = currentQuestion === 0;
    els.nextQuestion.disabled = !prior || currentQuestion >= total - 1;

    if (prior && currentQuestion >= total - 1 && answeredCount() >= total) {
      els.nextQuestion.disabled = false;
      els.nextQuestion.textContent = "Ver resultado";
    } else {
      els.nextQuestion.textContent = "Próxima";
    }
  }

  function submitAnswer(question, choiceIndex) {
    if (window.SDZ_RANKING?.requireName && !window.SDZ_RANKING.requireName("quiz")) {
      return;
    }
    const answersMap = loadAnswers();
    if (answersMap[question.id]) return;

    answersMap[question.id] = {
      choice: choiceIndex,
      correct: choiceIndex === question.correctIndex,
    };
    saveAnswers(answersMap);
    updateQuizChrome();
    renderQuiz();
  }

  function playAgain() {
    startQuizSession();
    renderQuiz();
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
      if (answeredCount() >= sessionQuestions.length) {
        renderQuiz();
        return;
      }
      if (currentQuestion < sessionQuestions.length - 1) {
        currentQuestion += 1;
        renderQuiz();
      }
    });

    els.playAgain.addEventListener("click", playAgain);
  }

  bindNav();
  bindQuizNav();
  ensureQuizSession();
  showView("home");
})();
