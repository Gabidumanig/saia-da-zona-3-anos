(() => {
  const box = document.getElementById("weather-box");
  if (!box) return;

  const LAT = -23.6567;
  const LON = -47.2225;
  const EVENT_DATE = "2026-11-14";

  const WMO = {
    0: { label: "Céu limpo", icon: "☀️" },
    1: { label: "Principalmente limpo", icon: "🌤️" },
    2: { label: "Parcialmente nublado", icon: "⛅" },
    3: { label: "Nublado", icon: "☁️" },
    45: { label: "Neblina", icon: "🌫️" },
    48: { label: "Neblina", icon: "🌫️" },
    51: { label: "Garoa", icon: "🌦️" },
    53: { label: "Garoa", icon: "🌦️" },
    55: { label: "Garoa forte", icon: "🌧️" },
    61: { label: "Chuva", icon: "🌧️" },
    63: { label: "Chuva", icon: "🌧️" },
    65: { label: "Chuva forte", icon: "🌧️" },
    66: { label: "Chuva gelada", icon: "🌧️" },
    67: { label: "Chuva gelada", icon: "🌧️" },
    71: { label: "Neve", icon: "🌨️" },
    73: { label: "Neve", icon: "🌨️" },
    75: { label: "Neve forte", icon: "🌨️" },
    77: { label: "Grãos de neve", icon: "🌨️" },
    80: { label: "Pancadas", icon: "🌦️" },
    81: { label: "Pancadas", icon: "🌧️" },
    82: { label: "Pancadas fortes", icon: "⛈️" },
    85: { label: "Pancadas de neve", icon: "🌨️" },
    86: { label: "Pancadas de neve", icon: "🌨️" },
    95: { label: "Tempestade", icon: "⛈️" },
    96: { label: "Tempestade com granizo", icon: "⛈️" },
    99: { label: "Tempestade com granizo", icon: "⛈️" },
  };

  function weatherOf(code) {
    return WMO[code] || { label: "Tempo variável", icon: "🌡️" };
  }

  function fmtTemp(n) {
    return `${Math.round(Number(n))}°`;
  }

  function renderLoading() {
    box.innerHTML = `
      <p class="weather-place">Ibiúna — SP</p>
      <p class="weather-now">Buscando clima…</p>
    `;
  }

  function renderError() {
    box.innerHTML = `
      <p class="weather-place">Ibiúna — SP</p>
      <p class="weather-now">Clima indisponível</p>
    `;
  }

  function render(data) {
    const now = weatherOf(data.current.weather_code);
    const days = data.daily.time || [];
    const eventIdx = days.indexOf(EVENT_DATE);
    let eventHtml = "";

    if (eventIdx >= 0) {
      const ev = weatherOf(data.daily.weather_code[eventIdx]);
      eventHtml = `
        <p class="weather-event">
          <span>14/11 ${ev.icon}</span>
          <strong>${fmtTemp(data.daily.temperature_2m_min[eventIdx])}–${fmtTemp(data.daily.temperature_2m_max[eventIdx])}</strong>
        </p>
      `;
    }

    box.innerHTML = `
      <p class="weather-place">Ibiúna — SP</p>
      <p class="weather-now" title="${now.label}">
        <span class="weather-icon" aria-hidden="true">${now.icon}</span>
        <strong>${fmtTemp(data.current.temperature_2m)}</strong>
        <span class="weather-label">${now.label}</span>
      </p>
      ${eventHtml}
    `;
  }

  async function load() {
    renderLoading();
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${LAT}&longitude=${LON}` +
        `&current=temperature_2m,weather_code` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
        `&timezone=America%2FSao_Paulo&forecast_days=16`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("weather http");
      const data = await res.json();
      render(data);
    } catch {
      renderError();
    }
  }

  load();
})();
