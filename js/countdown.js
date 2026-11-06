(() => {
  // 14 de novembro de 2026, 10h (horário de Brasília)
  const EVENT_AT = new Date("2026-11-14T10:00:00-03:00").getTime();

  const els = {
    days: document.getElementById("cd-days"),
    hours: document.getElementById("cd-hours"),
    mins: document.getElementById("cd-mins"),
    secs: document.getElementById("cd-secs"),
    live: document.getElementById("countdown-live"),
    grid: document.getElementById("countdown-grid"),
  };

  if (!els.days || !els.hours || !els.mins || !els.secs) return;

  function pad(n) {
    return String(Math.max(0, n)).padStart(2, "0");
  }

  function pulse(el) {
    el.classList.remove("is-tick");
    void el.offsetWidth;
    el.classList.add("is-tick");
  }

  function setValue(el, next) {
    const text = pad(next);
    if (el.textContent !== text) {
      el.textContent = text;
      pulse(el);
    }
  }

  function render() {
    const now = Date.now();
    const diff = EVENT_AT - now;

    if (diff <= 0) {
      els.days.textContent = "00";
      els.hours.textContent = "00";
      els.mins.textContent = "00";
      els.secs.textContent = "00";
      if (els.live) els.live.textContent = "É HOJE! Se você não for só você não vai.";
      if (els.grid) els.grid.classList.add("is-live");
      return;
    }

    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    setValue(els.days, days);
    setValue(els.hours, hours);
    setValue(els.mins, mins);
    setValue(els.secs, secs);

    if (els.live) {
      els.live.textContent = "Se você não for só você não vai";
    }
  }

  render();
  setInterval(render, 1000);
})();
