(() => {
  const NAME_KEY = "sdz3_player_name";
  const ID_KEY = "sdz3_player_key";
  const config = window.SDZ_CONFIG || {};
  const url = (config.supabaseUrl || "").trim().replace(/\/$/, "");
  const key = (config.supabaseAnonKey || "").trim();

  function uid() {
    try {
      if (crypto.randomUUID) return crypto.randomUUID();
    } catch (_) {
      /* ignore */
    }
    return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function storageGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (_) {
      return null;
    }
  }

  function storageSet(k, v) {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch (_) {
      return false;
    }
  }

  function getKey() {
    let id = storageGet(ID_KEY);
    if (!id) {
      id = uid();
      storageSet(ID_KEY, id);
    }
    return id;
  }

  function getName() {
    return (storageGet(NAME_KEY) || "").trim();
  }

  function setName(name) {
    const clean = String(name || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 24);
    if (clean.length < 2) return false;
    if (!storageSet(NAME_KEY, clean)) return false;
    window.dispatchEvent(new CustomEvent("sdz-name-updated", { detail: { name: clean } }));
    return true;
  }

  function headers() {
    return {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
  }

  async function submitScore(game, score) {
    const name = getName();
    if (!name || !url || !key) return null;
    try {
      const res = await fetch(`${url}/rest/v1/rpc/upsert_leaderboard_score`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          p_player_key: getKey(),
          p_player_name: name,
          p_game: game,
          p_score: Math.round(Number(score) || 0),
        }),
      });
      if (!res.ok) throw new Error(`score ${res.status}`);
      const data = await res.json();
      window.dispatchEvent(new CustomEvent("sdz-score-updated"));
      return data;
    } catch (err) {
      console.warn("SDZ ranking:", err);
      return null;
    }
  }

  async function fetchLeaderboard() {
    if (!url || !key) return [];
    try {
      const res = await fetch(
        `${url}/rest/v1/leaderboard?select=player_name,quiz_best,trail_best,pack_best,updated_at&order=updated_at.desc&limit=100`,
        { headers: headers() }
      );
      if (!res.ok) throw new Error(`lb ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn("SDZ ranking fetch:", err);
      return [];
    }
  }

  window.SDZ_PLAYER = {
    getName,
    getKey,
    setName,
    submitScore,
    fetchLeaderboard,
    online: Boolean(url && key),
  };
})();
