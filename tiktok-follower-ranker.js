// ─────────────────────────────────────────────────────────────
// TikTok Follower Ranker
//
// This ranks a TikTok account's followers by follower count.
// Paste this into the browser console while logged into tiktok.com.
//
// Built for @austinfrankel1.
// It does not follow, unfollow, message, or change anything.
// ─────────────────────────────────────────────────────────────

(async () => {
  const TARGET_USERNAME = "austinfrankel1";
  const TOP_AMOUNT = 30;
  const PAGE_SIZE = 30;
  const DELAY_MIN_MS = 900;
  const DELAY_MAX_MS = 1800;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const randomDelay = () => Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS + 1)) + DELAY_MIN_MS;
  const cleanUsername = (value) => String(value || "").replace("@", "").trim().toLowerCase();
  const formatNumber = (value) => Number(value || 0).toLocaleString();
  const getCookie = (name) => document.cookie.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=").slice(1).join("=") || "";
  const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

  if (!location.hostname.endsWith("tiktok.com")) {
    alert("Go to tiktok.com first, then paste this again.");
    location.href = "https://www.tiktok.com";
    return;
  }

  function baseParams(extra = {}) {
    const params = new URLSearchParams({
      aid: "1988",
      app_name: "tiktok_web",
      channel: "tiktok_web",
      device_platform: "web_pc",
      browser_language: navigator.language || "en-US",
      browser_platform: navigator.platform || "MacIntel",
      browser_name: "Mozilla",
      browser_version: navigator.userAgent,
      cookie_enabled: String(navigator.cookieEnabled),
      screen_width: String(screen.width || 1440),
      screen_height: String(screen.height || 900),
      tz_name: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
      webcast_language: navigator.language || "en-US",
      ...extra,
    });

    const msToken = getCookie("msToken");
    if (msToken) params.set("msToken", msToken);

    return params;
  }

  async function fetchJson(url, label) {
    const response = await fetch(url, {
      credentials: "include",
      headers: { accept: "application/json, text/plain, */*" },
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`${label} failed with ${response.status}. TikTok may be blocking or rate-limiting the request.`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${label} returned non-JSON. TikTok may have changed this endpoint.`);
    }
  }

  function findUserObjects(obj, username, found = []) {
    if (!obj || typeof obj !== "object" || found.length > 20) return found;

    if (typeof obj.uniqueId === "string" && cleanUsername(obj.uniqueId) === username && (obj.secUid || obj.id)) {
      found.push(obj);
    }

    const values = Array.isArray(obj) ? obj : Object.values(obj);
    for (const value of values) {
      if (value && typeof value === "object") findUserObjects(value, username, found);
      if (found.length > 20) break;
    }

    return found;
  }

  function normalizeUser(input) {
    const user = input?.user || input || {};
    const stats = input?.stats || user?.stats || input?.userStats || user?.userStats || {};
    const username = cleanUsername(user.uniqueId || user.unique_id || input?.uniqueId || input?.unique_id);
    const followers = Number(stats.followerCount ?? stats.follower_count ?? user.followerCount ?? user.follower_count ?? input?.followerCount);

    return {
      username,
      nickname: user.nickname || input?.nickname || "",
      secUid: user.secUid || input?.secUid || "",
      id: user.id || input?.id || "",
      followers: Number.isFinite(followers) ? followers : null,
      verified: Boolean(user.verified || input?.verified),
      private: Boolean(user.privateAccount || input?.privateAccount),
      profileUrl: username ? `https://www.tiktok.com/@${username}` : "",
    };
  }

  async function getUserProfile(username) {
    const clean = cleanUsername(username);

    try {
      const html = await fetch(`https://www.tiktok.com/@${encodeURIComponent(clean)}`, { credentials: "include" }).then((res) => res.text());
      const matches = [...html.matchAll(/<script[^>]+id="(?:__UNIVERSAL_DATA_FOR_REHYDRATION__|SIGI_STATE)"[^>]*>([\s\S]*?)<\/script>/g)];

      for (const match of matches) {
        try {
          const json = JSON.parse(match[1]);
          const found = findUserObjects(json, clean).map(normalizeUser).find((user) => user.secUid || user.id);
          if (found) return found;
        } catch {}
      }
    } catch {}

    const url = `https://www.tiktok.com/api/user/detail/?${baseParams({ uniqueId: clean })}`;
    const data = await fetchJson(url, `Finding @${clean}`);
    const user = normalizeUser(data?.userInfo || data?.user || data?.data?.user || data);

    if (!user.secUid && !user.id) {
      throw new Error(`Could not find @${clean}. Open that TikTok profile in this tab and try again.`);
    }

    return user;
  }

  function getUsersFromListResponse(data) {
    const list = data?.userList || data?.users || data?.data?.userList || data?.data?.users || [];
    return list.map(normalizeUser).filter((user) => user.username);
  }

  async function fetchListPage(secUid, type, cursor) {
    const params = baseParams({
      secUid,
      count: String(PAGE_SIZE),
      cursor: String(cursor),
      maxCursor: String(cursor),
      minCursor: "0",
      type: String(type),
      from_page: "user",
    });

    const url = `https://www.tiktok.com/api/user/list/?${params}`;
    const data = await fetchJson(url, `Fetching list type ${type}`);
    const users = getUsersFromListResponse(data);
    const nextCursor = String(data?.maxCursor ?? data?.cursor ?? data?.data?.maxCursor ?? data?.data?.cursor ?? "");
    const hasMore = Boolean(data?.hasMore ?? data?.has_more ?? data?.data?.hasMore);

    return { users, nextCursor, hasMore };
  }

  async function fetchAllForType(secUid, type) {
    const users = [];
    const seen = new Set();
    let cursor = 0;

    while (true) {
      const page = await fetchListPage(secUid, type, cursor);

      for (const user of page.users) {
        if (!seen.has(user.username)) {
          seen.add(user.username);
          users.push(user);
        }
      }

      console.log(`Type ${type}: fetched ${formatNumber(users.length)} users...`);

      if (!page.hasMore || !page.nextCursor || page.nextCursor === String(cursor)) break;
      cursor = page.nextCursor;
      await sleep(randomDelay());
    }

    return users;
  }

  function chooseLikelyFollowers(typeOne, typeTwo, profile) {
    if (profile.followers !== null) {
      const oneGap = Math.abs(typeOne.length - profile.followers);
      const twoGap = Math.abs(typeTwo.length - profile.followers);
      return oneGap <= twoGap ? typeOne : typeTwo;
    }

    return typeTwo.length >= typeOne.length ? typeTwo : typeOne;
  }

  async function fillFollowerCount(user) {
    if (user.followers !== null) return user;

    try {
      await sleep(randomDelay());
      const profile = await getUserProfile(user.username);
      return { ...user, followers: profile.followers };
    } catch {
      return user;
    }
  }

  function showPopup(users, targetUsername) {
    document.getElementById("tiktok-follower-ranker")?.remove();

    const box = document.createElement("div");
    box.id = "tiktok-follower-ranker";
    box.style.cssText = `position:fixed;top:20px;right:20px;width:390px;max-height:80vh;overflow:auto;background:white;color:#111;border:1px solid #ddd;border-radius:16px;padding:16px;z-index:999999;font-family:Arial,sans-serif;box-shadow:0 14px 35px rgba(0,0,0,.22);`;

    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <strong style="font-size:16px;">Top TikTok Followers</strong>
        <button id="close-tiktok-follower-ranker" style="cursor:pointer;border:0;background:#eee;border-radius:8px;padding:6px 10px;">Close</button>
      </div>
      <p style="font-size:13px;color:#444;margin:10px 0;">Top ${users.length} followers for @${escapeHtml(targetUsername)} by follower count.</p>
      <button id="copy-tiktok-follower-ranker" style="cursor:pointer;border:0;background:#111;color:white;border-radius:8px;padding:8px 10px;margin-bottom:10px;">Copy list</button>
      <div>
        ${users.map((user) => `
          <a href="${user.profileUrl}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;color:#111;border-top:1px solid #eee;padding:10px 0;">
            <strong>#${user.rank} @${escapeHtml(user.username)}</strong>
            <div style="font-size:12px;color:#666;">${formatNumber(user.followers)} followers${user.nickname ? ` · ${escapeHtml(user.nickname)}` : ""}</div>
          </a>
        `).join("")}
      </div>
    `;

    document.body.appendChild(box);
    document.getElementById("close-tiktok-follower-ranker").onclick = () => box.remove();
    document.getElementById("copy-tiktok-follower-ranker").onclick = async () => {
      const text = users.map((user) => `#${user.rank} @${user.username} — ${formatNumber(user.followers)} followers — ${user.profileUrl}`).join("\n");
      await navigator.clipboard.writeText(text);
      alert("Copied the list.");
    };
  }

  try {
    const targetUsername = cleanUsername(TARGET_USERNAME);
    console.log(`Finding TikTok profile @${targetUsername}...`);
    const profile = await getUserProfile(targetUsername);

    console.log(`Fetching TikTok list candidates for @${targetUsername}...`);
    const [typeOne, typeTwo] = await Promise.all([
      fetchAllForType(profile.secUid, 1),
      fetchAllForType(profile.secUid, 2),
    ]);

    const followers = chooseLikelyFollowers(typeOne, typeTwo, profile);

    if (!followers.length) {
      throw new Error("No followers were returned. TikTok may be blocking the endpoint, or this account/list may be private.");
    }

    const enriched = [];
    for (let i = 0; i < followers.length; i += 1) {
      enriched.push(await fillFollowerCount(followers[i]));
      if ((i + 1) % 10 === 0 || i + 1 === followers.length) {
        console.log(`Checked ${formatNumber(i + 1)} / ${formatNumber(followers.length)} followers...`);
      }
    }

    const ranked = enriched
      .filter((user) => user.followers !== null)
      .sort((a, b) => b.followers - a.followers || a.username.localeCompare(b.username));

    const topFollowers = ranked.slice(0, TOP_AMOUNT).map((user, index) => ({ ...user, rank: index + 1 }));

    console.log(`%cTop ${TOP_AMOUNT} TikTok followers for @${targetUsername}`, "color:#00f2ea;font-weight:bold;font-size:15px");
    console.table(topFollowers.map(({ rank, username, nickname, followers, verified, private: isPrivate, profileUrl }) => ({ rank, username, nickname, followers, verified, private: isPrivate, profileUrl })));

    window.austinTikTokTopFollowers = topFollowers;
    window.austinTikTokAllFollowerRankings = ranked;

    showPopup(topFollowers, targetUsername);
    console.log("Saved top results to window.austinTikTokTopFollowers");
  } catch (error) {
    console.error("TikTok follower ranker stopped:", error);
    alert(error.message);
  }
})();
