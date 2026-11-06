(() => {
  const INTERVAL_MS = 5500;
  const data = window.SDZ_SLIDESHOW_PHOTOS || {};
  const photos = Array.isArray(data.photos) ? data.photos : [];
  const root = document.getElementById("home-slideshow");
  const label = document.getElementById("home-slideshow-label");
  if (!root || photos.length === 0) return;

  const slides = photos.map((photo, index) => {
    const fig = document.createElement("figure");
    fig.className = "home-slide" + (index === 0 ? " is-active" : "");
    fig.dataset.album = photo.album || "";

    const img = document.createElement("img");
    img.src = photo.src;
    img.alt = "";
    img.decoding = "async";
    img.loading = index === 0 ? "eager" : "lazy";
    img.referrerPolicy = "no-referrer";

    fig.appendChild(img);
    root.appendChild(fig);
    return fig;
  });

  let index = 0;
  let timer = null;

  function show(next) {
    slides[index]?.classList.remove("is-active");
    index = next;
    slides[index]?.classList.add("is-active");
    if (label) label.textContent = photos[index]?.album || "";
  }

  function tick() {
    show((index + 1) % slides.length);
  }

  function start() {
    stop();
    timer = window.setInterval(tick, INTERVAL_MS);
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  if (label) label.textContent = photos[0]?.album || "";
  start();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  window.SDZ_SLIDESHOW = { start, stop, show };
})();
