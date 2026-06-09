// ==UserScript==
// @name         litlink-analytics-plus
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  lit.linkの分析ページで任意期間の閲覧数・クリック数を集計します
// @author       tomoya-mitani
// @match        https://lit.link/admin/analytics*
// @connect      prd.api.lit.link
// @updateURL    https://raw.githubusercontent.com/tomoya-mitani/litlink-analytics-plus/main/litlink-analytics-plus.user.js
// @downloadURL  https://raw.githubusercontent.com/tomoya-mitani/litlink-analytics-plus/main/litlink-analytics-plus.user.js
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  let _creatorId = null;
  let _userId = null;
  let _token = null;

  const jwtRe = /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;

  /* API キャッシュ（1時間有効） */
  const CACHE_TTL = 60 * 60 * 1000;
  function getCache(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
        return parsed.data;
      }
    } catch (e) {}
    return null;
  }
  function setCache(key, data) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
    } catch (e) {}
  }

  /* 1. fetch / XMLHttpRequest を上書きして API リクエストを傍受 */
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const url = args[0];
    const opts = args[1] || {};
    if (typeof url === "string") {
      const cm = url.match(/\/creators\/([a-f0-9-]{36})/i);
      if (cm && !_creatorId) _creatorId = cm[1];
      const um = url.match(/[?&]user_id=([a-f0-9-]{36})/i);
      if (um && !_userId) _userId = um[1];
      if (opts.headers) {
        const h = new Headers(opts.headers);
        const auth = h.get("Authorization") || h.get("authorization");
        if (auth && auth.startsWith("Bearer ")) {
          const t = auth.replace("Bearer ", "").trim();
          if (jwtRe.test(t)) _token = t;
        }
      }
    }
    return origFetch.apply(this, args);
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (typeof url === "string") {
      const cm = url.match(/\/creators\/([a-f0-9-]{36})/i);
      if (cm && !_creatorId) _creatorId = cm[1];
      const um = url.match(/[?&]user_id=([a-f0-9-]{36})/i);
      if (um && !_userId) _userId = um[1];
    }
    this._lla_url = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
    if (header && header.toLowerCase() === "authorization" && value) {
      const m = value.match(/^Bearer\s+(.+)$/i);
      if (m) {
        const t = m[1].trim();
        if (jwtRe.test(t)) _token = t;
      }
    }
    return origSetRequestHeader.call(this, header, value);
  };

  /* 2. localStorage / cookie から認証情報を補完 */
  function extractFromLS(diagnostics) {
    try {
      const data = JSON.parse(
        localStorage.getItem("lit-link-production") || "{}",
      );
      if (!_userId && data.userId) _userId = data.userId;
      if (!_token) {
        const t =
          data.token ||
          data.accessToken ||
          data.authToken ||
          data.jwt ||
          data.idToken;
        if (t && typeof t === "string" && jwtRe.test(t)) _token = t;
      }
      const ua = data.userAnalyticsAccessLogs;
      if (Array.isArray(ua) && ua.length > 0) {
        const first = ua[0];
        if (!_creatorId && first.creator_id) _creatorId = first.creator_id;
        if (!_creatorId && first.creatorId) _creatorId = first.creatorId;
      }
      // diagnostics.push("localStorage keys: " + Object.keys(data).join(", "));
      // diagnostics.push(_token ? "token found in localStorage" : "token NOT found in localStorage");
    } catch (e) {
      if (diagnostics) diagnostics.push("localStorage read err: " + e.message);
    }

    if (!_token) {
      const cookies = document.cookie.split(";");
      for (const c of cookies) {
        const [name, value] = c.trim().split("=");
        if (value && jwtRe.test(decodeURIComponent(value))) {
          _token = decodeURIComponent(value);
          // diagnostics.push("token found in cookie: " + name);
          break;
        }
      }
    }
  }

  /* 3. UI 作成 */
  function createPanel() {
    if (document.getElementById("lla-panel")) return;

    const css = document.createElement("style");
    css.textContent = `
      #lla-panel{position:fixed;top:20px;right:20px;width:340px;max-height:calc(100vh - 40px);background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.25);z-index:2147483647;padding:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.4;color:#1f2937;overflow-y:auto}
      #lla-panel h2{margin:0 0 14px;font-size:16px;font-weight:700}
      #lla-panel label{display:block;font-size:12px;color:#6b7280;margin-bottom:4px}
      #lla-panel input{width:100%;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:10px;box-sizing:border-box;font-size:14px}
      #lla-panel button{width:100%;padding:10px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px}
      #lla-panel button:hover{background:#4f46e5}
      #lla-panel .result{margin-top:12px;padding:12px;background:#f3f4f6;border-radius:10px;font-size:13px}
      #lla-panel .close{position:absolute;top:12px;right:16px;cursor:pointer;color:#9ca3af;font-size:20px;line-height:1}
      #lla-panel .close:hover{color:#374151}
      #lla-panel .row{display:flex;justify-content:space-between;padding:4px 0}
      #lla-panel .num{font-weight:700;color:#111827}
      #lla-panel .err{color:#ef4444;font-size:13px;margin-top:8px}
      #lla-panel .diag{margin-top:8px;font-size:11px;color:#6b7280}
      #lla-panel pre{background:#f3f4f6;padding:8px;border-radius:6px;overflow:auto;max-height:150px;white-space:pre-wrap;word-break:break-all}
    `;
    document.head.appendChild(css);

    const panel = document.createElement("div");
    panel.id = "lla-panel";
    panel.innerHTML = `
      <div class="close" onclick="document.getElementById('lla-panel').remove()">&times;</div>
      <h2>📊 lit.link 期間集計</h2>
      <label>開始日（直近1ヶ月以内の日付を指定してください）</label><input type="date" id="lla-s">
      <label>終了日</label><input type="date" id="lla-e">
      <button id="lla-go">集計する</button>
      <div id="lla-r"></div>
    `;
    document.body.appendChild(panel);

    document.getElementById("lla-go").onclick = async () => {
      const rEl = document.getElementById("lla-r");
      rEl.innerHTML =
        '<div style="color:#6b7280;font-size:13px;">読み込み中…</div>';
      try {
        await runAggregation();
      } catch (err) {
        let diag = "";
        if (err.diagnostics) {
          diag =
            '<details class="diag"><summary>🔍 診断情報</summary><pre>' +
            err.diagnostics.join("\n") +
            "</pre></details>";
        }
        rEl.innerHTML = '<div class="err">' + err.message + "</div>" + diag;
      }
    };
  }

  /* 4. 集計処理 */
  async function runAggregation() {
    const rEl = document.getElementById("lla-r");
    const sVal = document.getElementById("lla-s").value;
    const eVal = document.getElementById("lla-e").value;
    if (!sVal || !eVal) throw new Error("開始日と終了日を選択してください");

    const s = new Date(sVal);
    s.setHours(0, 0, 0, 0);
    const e = new Date(eVal);
    e.setHours(23, 59, 59, 999);
    if (s > e) throw new Error("開始日が終了日より後です");

    let pvLogs = [];
    let lcLogs = [];
    let source = "";
    let diagnostics = [];

    extractFromLS(diagnostics);
    // diagnostics.push(_token ? "token available" : "token NOT available");

    /* 4a. localStorage の userAnalyticsAccessLogs を優先 */
    try {
      const data = JSON.parse(
        localStorage.getItem("lit-link-production") || "{}",
      );
      const ua = data.userAnalyticsAccessLogs;
      if (Array.isArray(ua) && ua.length > 0) {
        const dates = ua
          .map((item) => (item.logged_at_from || item.date || "").split("T")[0])
          .filter(Boolean);
        const minDate = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
        const maxDate = dates.reduce((max, d) => (d > max ? d : max), dates[0]);
        // diagnostics.push(`localStorage data range: ${minDate} ~ ${maxDate} (${ua.length}件)`);

        if (minDate <= sVal && maxDate >= eVal) {
          for (const item of ua) {
            if (!item || typeof item !== "object") continue;
            if ("view_count" in item && !("click_count" in item)) {
              pvLogs.push(item);
            } else if ("click_count" in item && !("view_count" in item)) {
              lcLogs.push(item);
            } else if ("view_count" in item && "click_count" in item) {
              pvLogs.push(item);
              lcLogs.push(item);
            }
          }
          if (pvLogs.length || lcLogs.length) {
            source = "localStorage";
          }
        } else {
          // diagnostics.push("localStorage data does not cover requested period, using API");
        }
      }
    } catch (e) {
      diagnostics.push("localStorage read err: " + e.message);
    }

    /* 4b. localStorage になければ API フェッチ */
    if (!pvLogs.length && !lcLogs.length) {
      source = "API";

      if (!_creatorId || !_userId) {
        const err = new Error(
          "creator_id / user_id を自動検出できませんでした。分析ページを開いてしばらく待ってから実行してください。",
        );
        err.diagnostics = diagnostics;
        throw err;
      }

      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fromStr = oneMonthAgo.toISOString();
      const toStr = now.toISOString();
      const base = "https://prd.api.lit.link/v1";
      const qs = `user_id=${encodeURIComponent(_userId)}&creator_id=${encodeURIComponent(_creatorId)}&logged_at_from=${encodeURIComponent(fromStr)}&logged_at_to=${encodeURIComponent(toStr)}&access_log_period=one_month`;

      const pvUrl = `${base}/page_view_access_logs/creators/${_creatorId}/time_series?${qs}`;
      const lcUrl = `${base}/link_access_logs/creators/${_creatorId}/time_series?${qs}`;

      // diagnostics.push(`fetching API: creatorId=${_creatorId}, userId=${_userId}`);
      // diagnostics.push(`apiStartDate: ${oneMonthAgo.toISOString().split('T')[0]}, userStartDate: ${sVal}`);
      // diagnostics.push(`pvUrl: ${pvUrl}`);

      const apiStartDate = oneMonthAgo.toISOString().split("T")[0];
      const pvCacheKey = `lla-pv-${_creatorId}-${apiStartDate}-${eVal}`;
      const lcCacheKey = `lla-lc-${_creatorId}-${apiStartDate}-${eVal}`;

      try {
        let pvData = getCache(pvCacheKey);
        if (pvData) {
          // diagnostics.push("pv: cache hit");
        } else {
          // diagnostics.push("pv: cache miss, fetching API");
          pvData = await gmFetch(pvUrl, diagnostics);
          setCache(pvCacheKey, pvData);
        }
        pvLogs = pvData.page_view_time_series_access_logs || [];
        // diagnostics.push(`pv logs count: ${pvLogs.length}`);
      } catch (e) {
        diagnostics.push("pv API err: " + e.message);
      }
      try {
        let lcData = getCache(lcCacheKey);
        if (lcData) {
          // diagnostics.push("lc: cache hit");
        } else {
          // diagnostics.push("lc: cache miss, fetching API");
          lcData = await gmFetch(lcUrl, diagnostics);
          setCache(lcCacheKey, lcData);
        }
        lcLogs = lcData.link_time_series_access_logs || [];
        // diagnostics.push(`lc logs count: ${lcLogs.length}`);
      } catch (e) {
        diagnostics.push("lc API err: " + e.message);
      }
    }

    if (!pvLogs.length && !lcLogs.length) {
      const err = new Error("データが見つかりませんでした。");
      err.diagnostics = diagnostics;
      throw err;
    }

    /* 5. 日付マージ */
    const map = new Map();
    for (const item of pvLogs) {
      const dateStr = item.logged_at_from || item.date;
      if (!dateStr) continue;
      const key = dateStr.split("T")[0];
      const existing = map.get(key) || {
        view_count: 0,
        click_count: 0,
        date: key,
      };
      existing.view_count += item.view_count || 0;
      map.set(key, existing);
    }
    for (const item of lcLogs) {
      const dateStr = item.logged_at_from || item.date;
      if (!dateStr) continue;
      const key = dateStr.split("T")[0];
      const existing = map.get(key) || {
        view_count: 0,
        click_count: 0,
        date: key,
      };
      existing.click_count += item.click_count || 0;
      map.set(key, existing);
    }

    const logs = Array.from(map.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const matchedLogs = [];
    let views = 0,
      clicks = 0;
    let minDate = null,
      maxDate = null;
    let matchedCount = 0;
    for (const item of logs) {
      const matched = item.date >= sVal && item.date <= eVal;
      if (matched) {
        matchedLogs.push(item);
        views += item.view_count;
        clicks += item.click_count;
        matchedCount++;
        if (!minDate || item.date < minDate) minDate = item.date;
        if (!maxDate || item.date > maxDate) maxDate = item.date;
      }
    }

    const dataRange =
      minDate && maxDate
        ? `${minDate} ～ ${maxDate} (${matchedCount}日分)`
        : "データなし";

    let warning = "";
    if (matchedCount === 0) {
      warning =
        '<div style="color:#ef4444;font-size:12px;margin-top:8px;">⚠️ 指定した期間にデータがありません。</div>';
    } else if (minDate > sVal || maxDate < eVal) {
      warning =
        '<div style="color:#f59e0b;font-size:12px;margin-top:8px;">⚠️ 指定した期間の一部しかデータがありません。</div>';
    }

    const dailyTable = matchedCount > 0
      ? `<hr style="border:0;border-top:1px solid #e5e7eb;margin:8px 0;">
         <div style="font-size:12px;font-weight:600;margin-bottom:4px;">📋 日別データ</div>
         <div style="max-height:200px;overflow-y:auto;">
           <table style="width:100%;font-size:10px;border-collapse:collapse;line-height:1.3;">
             <thead>
               <tr style="border-bottom:1px solid #e5e7eb;color:#6b7280;">
                 <th style="text-align:left;padding:1px 0;">日付</th>
                 <th style="text-align:right;padding:1px 0;">👁</th>
                 <th style="text-align:right;padding:1px 0;">👆</th>
               </tr>
             </thead>
             <tbody>
               ${matchedLogs.map(item => `
                 <tr>
                   <td style="padding:1px 0;">${item.date}</td>
                   <td style="text-align:right;padding:1px 0;">${item.view_count}</td>
                   <td style="text-align:right;padding:1px 0;">${item.click_count}</td>
                 </tr>
               `).join('')}
             </tbody>
           </table>
         </div>`
      : '';

    rEl.innerHTML = `
      <div class="result">
        <div class="row"><span>📅 指定期間</span><span class="num">${sVal} ～ ${eVal}</span></div>
        <div class="row"><span>👁 閲覧数</span><span class="num">${views}</span></div>
        <div class="row"><span>👆 クリック数</span><span class="num">${clicks}</span></div>
        <hr style="border:0;border-top:1px solid #e5e7eb;margin:8px 0;">
        <div class="row" style="font-size:11px;color:#6b7280;"><span>データソース</span><span>${source}</span></div>
        <div class="row" style="font-size:11px;color:#6b7280;"><span>取得した日付範囲</span><span>${dataRange}</span></div>
        <div style="font-size:10px;color:#9ca3af;margin-top:4px;">※ lit.link管理画面の合計と比較して確認してください</div>
        ${warning}
        ${dailyTable}
      </div>
    `;
  }

  /* 6. fetch API ラッパー */
  async function gmFetch(url, diagnostics) {
    const headers = {};
    if (_token) {
      headers["Authorization"] = "Bearer " + _token;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const text = await response.text();
      if (diagnostics) {
        diagnostics.push(
          `HTTP ${response.status} response: ${text.substring(0, 200)}`,
        );
      }
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  }

  /* 7. ページ読み込み後に UI を作成 */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createPanel);
  } else {
    createPanel();
  }
})();
