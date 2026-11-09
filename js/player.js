(() => {
  const NAME_KEY = "sdz3_player_name";
  const ID_KEY = "sdz3_player_key";
  const TRAIL_AVATAR_KEY = "sdz3_trail_avatar";
  // marca invisível no nome quando o banco ainda não tem trail_avatar
  const AVATAR_MARK = "\u200b#";
  const config = window.SDZ_CONFIG || {};
  const url = (config.supabaseUrl || "").trim().replace(/\/$/, "");
  const key = (config.supabaseAnonKey || "").trim();
  let supportsTrailAvatar = null;

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
      .replace(new RegExp(`${AVATAR_MARK}[a-z0-9_-]+$`, "i"), "")
      .trim()
      .slice(0, 24);
    if (clean.length < 2) return false;
    if (!storageSet(NAME_KEY, clean)) return false;
    window.dispatchEvent(new CustomEvent("sdz-name-updated", { detail: { name: clean } }));
    return true;
  }

  function decodeNameAvatar(raw) {
    const text = String(raw || "");
    const m = text.match(/^(.*?)\u200b#([a-z0-9_-]+)$/i);
    if (m) {
      return { name: m[1].trim(), avatar: m[2].toLowerCase() };
    }
    return { name: text.trim(), avatar: null };
  }

  function encodeNameWithAvatar(name, avatar) {
    const id = String(avatar || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 16);
    if (!id) return name;
    const room = Math.max(2, 24 - id.length - 2);
    const base = String(name || "")
      .replace(new RegExp(`${AVATAR_MARK}[a-z0-9_-]+$`, "i"), "")
      .trim()
      .slice(0, room);
    return `${base}${AVATAR_MARK}${id}`;
  }

  function headers() {
    return {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
  }

  async function probeTrailAvatarColumn() {
    if (supportsTrailAvatar !== null) return supportsTrailAvatar;
    if (!url || !key) {
      supportsTrailAvatar = false;
      return false;
    }
    try {
      const res = await fetch(
        `${url}/rest/v1/leaderboard?select=trail_avatar&limit=1`,
        { headers: headers() }
      );
      supportsTrailAvatar = res.ok;
    } catch (_) {
      supportsTrailAvatar = false;
    }
    return supportsTrailAvatar;
  }

  async function submitScore(game, score, meta = {}) {
    const name = getName();
    if (!name || !url || !key) return null;
    try {
      const hasColumn = await probeTrailAvatarColumn();
      let avatar = meta.avatar ? String(meta.avatar).slice(0, 24) : null;
      if (avatar) storageSet(TRAIL_AVATAR_KEY, avatar);
      else avatar = storageGet(TRAIL_AVATAR_KEY);

      const body = {
        p_player_key: getKey(),
        p_player_name: name,
        p_game: game,
        p_score: Math.round(Number(score) || 0),
      };

      if (hasColumn && avatar) {
        body.p_avatar = avatar;
      } else if (avatar) {
        // fallback: guarda o avatar no próprio nome até a migração rodar
        body.p_player_name = encodeNameWithAvatar(name, avatar);
      }

      let res = await fetch(`${url}/rest/v1/rpc/upsert_leaderboard_score`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });

      // fallback se a RPC antiga (sem avatar) ainda estiver no ar
      if (!res.ok && body.p_avatar) {
        delete body.p_avatar;
        body.p_player_name = encodeNameWithAvatar(name, avatar);
        res = await fetch(`${url}/rest/v1/rpc/upsert_leaderboard_score`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify(body),
        });
      }

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
      const hasColumn = await probeTrailAvatarColumn();
      const select = hasColumn
        ? "player_name,quiz_best,trail_best,pack_best,trail_avatar,updated_at"
        : "player_name,quiz_best,trail_best,pack_best,updated_at";
      const res = await fetch(
        `${url}/rest/v1/leaderboard?select=${select}&order=updated_at.desc&limit=100`,
        { headers: headers() }
      );
      if (!res.ok) throw new Error(`lb ${res.status}`);
      const rows = await res.json();
      return rows.map((row) => {
        const parsed = decodeNameAvatar(row.player_name);
        return {
          ...row,
          player_name: parsed.name,
          trail_avatar: row.trail_avatar || parsed.avatar || null,
        };
      });
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
