/* ==========================================================================
   Static API shim — GitHub Pages build
   --------------------------------------------------------------------------
   The dashboard is written against a live FastAPI service. GitHub Pages can
   only serve files, so this file answers the same URLs from pre-captured JSON
   responses. Nothing else in the app changes: the shim replaces window.fetch.

   The captures in data/ were produced by calling the real endpoints on the
   local server, so the static build shows byte-identical numbers to the live
   one rather than a hand-made mock.

   Loaded BEFORE the application script so the override is in place by the time
   boot() runs.
   ========================================================================== */
(function () {
  "use strict";

  var orig = window.fetch.bind(window);
  var ROUTES = {
    "/api/summary": "data/summary.json",
    "/api/windows": "data/windows.json",
    "/api/compare": "data/compare.json",
    "/api/qc": "data/qc.json"
  };

  var cache = {};

  function getJSON(path) {
    if (!cache[path]) {
      // relative to the page, so the site also works under /<repo>/ on Pages
      cache[path] = orig(path, { cache: "force-cache" }).then(function (r) {
        if (!r.ok) throw new Error(path + " → " + r.status);
        return r.json();
      });
    }
    return cache[path];
  }

  function json(obj) {
    return Promise.resolve(new Response(JSON.stringify(obj), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));
  }

  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var path = url.split("?")[0];

    // /api/flags  → the whole captured list (the app asks for limit=10000)
    if (path === "/api/flags") return getJSON("data/flags.json").then(json);

    // /api/flags/<step> → pull that one record out of the same capture
    var m = path.match(/^\/api\/flags\/(\d+)$/);
    if (m) {
      return getJSON("data/flags.json").then(function (body) {
        var list = (body && body.flags) || [];
        var hit = null;
        for (var i = 0; i < list.length; i++) {
          if (String(list[i].step) === m[1]) { hit = list[i]; break; }
        }
        return json(hit || {});
      });
    }

    // /api/series/<var>
    var s = path.match(/^\/api\/series\/([a-z_]+)$/);
    if (s) return getJSON("data/series_" + s[1] + ".json").then(json);

    if (ROUTES[path]) return getJSON(ROUTES[path]).then(json);

    // anything else (styles.css, images, …) goes to the real network
    return orig(input, init);
  };

  // Surface a readable message instead of a blank page if a capture is missing.
  window.addEventListener("error", function (e) {
    var b = document.createElement("div");
    b.textContent = "Static build error: " + (e.message || "unknown");
    b.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:99;padding:8px 12px;" +
      "background:#A32B22;color:#fff;font:12px system-ui;border-radius:4px";
    document.body.appendChild(b);
  });
})();
