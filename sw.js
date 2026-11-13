const VERSION = "1.0.27-b11af7767321";
// Every file the app needs with no signal, and a short hash of each so an update only downloads what changed.
const FILES = {
"./": "4ae8675cb15f41da",
"app.zip": "6aa1fb4befb0f673",
"boot.js": "4e30489f48beb1ac",
"docs.html": "432c5e152f1bfc09",
"field.css": "a4ab701569828a83",
"icon-180.png": "a1c552a282551c81",
"icon-192.png": "4e2f7f53cb474a9e",
"icon-512.png": "5b59382f82268a5a",
"index.html": "4ae8675cb15f41da",
"manifest.webmanifest": "fabeddf8a04d64b4",
"offline.js": "0ff659333818e744",
"pyodide/package.json": "40ca48e43ce4ddc6",
"pyodide/pyodide-lock.json": "5dc2fc119108bc14",
"pyodide/pyodide.asm.mjs": "f7cdc8ece80678ce",
"pyodide/pyodide.asm.wasm": "cc36e3cab04fdfc9",
"pyodide/pyodide.js": "3141b814715a72e5",
"pyodide/pyodide.mjs": "6f1d60f7bf529beb",
"pyodide/python_stdlib.zip": "fa1957e5777068fc",
"server.py": "b57964b9c298ae6f",
"static/aar-marks-ui.js": "1f745f28e0c08f79",
"static/catalog.js": "22bc4903d7b3b6df",
"static/confirm.js": "b0c981bbd059599e",
"static/debug.js": "fc7d7a9cb68361bf",
"static/docs.js": "f35370686c2b0629",
"static/docs/iphone-sync-guide.pdf": "93ab0f763bd817f1",
"static/durability.js": "bc0e3dff6f99098f",
"static/erg/guides.json": "232bcb5c740df4e9",
"static/erg/ids.json": "b502401b5bb372fd",
"static/erg/placards/blasting.png": "458234a1d1d947f5",
"static/erg/placards/class9.png": "eca31b718f00e946",
"static/erg/placards/combustible.png": "5b541447ba723081",
"static/erg/placards/corrosive.png": "ab79e3e18c34af77",
"static/erg/placards/dangerous-wet.png": "49fbbdf9dbb5b404",
"static/erg/placards/dangerous.png": "6263db85741a6779",
"static/erg/placards/explosive-14.png": "ef6f81a6dd20eccc",
"static/erg/placards/explosive-16.png": "e9ed0cbbca148ae7",
"static/erg/placards/explosive.png": "39bc30861253c82b",
"static/erg/placards/flammable-gas.png": "44e754ab617f4978",
"static/erg/placards/flammable-solid.png": "a397b4757e5e3371",
"static/erg/placards/flammable.png": "b33238e77321a767",
"static/erg/placards/hot.png": "3eec64e53bfeab5d",
"static/erg/placards/infectious.png": "d1a9238a108a4697",
"static/erg/placards/inhalation.png": "f42237a525b7936b",
"static/erg/placards/nonflammable-gas.png": "7d84f3273c8e7e77",
"static/erg/placards/oxidizer.png": "0ef0a979e55e909b",
"static/erg/placards/oxygen.png": "45db769f3db682ee",
"static/erg/placards/peroxide.png": "d70ae2bbfff9b5fd",
"static/erg/placards/poison-gas.png": "80d77e57b0c5ded7",
"static/erg/placards/poison.png": "0d3f144cefff585b",
"static/erg/placards/radioactive.png": "a7d2afd3e2284b01",
"static/erg/placards/spontaneous.png": "3ba58bc987747c64",
"static/erg/top100.json": "9a95a704fb5b47b9",
"static/form.js": "c7f2bf8372336509",
"static/icon.png": "5b59382f82268a5a",
"static/jsqr.js": "bc40c8a15196236b",
"static/kmi-e-variants.html": "464a6345b31f22d6",
"static/kmi-mockups.html": "17557560e829b04f",
"static/library.js": "ac0c17b65852d95b",
"static/mockups/footer-tools-drawer-v2.html": "a169f232d53294a2",
"static/mockups/footer-tools-drawer.html": "b6347b15482e6966",
"static/ocr/eng.traineddata.gz": "18c1ac52b75e35d4",
"static/ocr/tesseract-core-simd-lstm.wasm.js": "ce20eda9533cbed1",
"static/ocr/tesseract.min.js": "a8e29918d098b2b0",
"static/ocr/worker.min.js": "aca1229639fc9907",
"static/read-units.html": "1caec40753753b0d",
"static/read-units.js": "c197bb73e1a73b5a",
"static/reference/aar-marks.json": "e81e6db6e00a6333",
"static/review/footer-timer-ticker.html": "b478624debd7fd30",
"static/review/mockup-footer-A.jpg": "3b2ae691c62e7ea9",
"static/review/mockup-footer-B.jpg": "26ee6a8be478fe3e",
"static/review/mockup-footer-C.jpg": "1bd186e20977744c",
"static/review/settings-trip-picks-placements.html": "9456cc6b695c45f5",
"static/review/trip-packing-checklist.html": "2ba9c0e54c4490e2",
"static/styles.css": "c6e936672c78f89d",
"static/sync.js": "a4b3c284cb340636",
"static/tablesort.js": "a0868583f6fcbeb0",
"static/theme.js": "e1b11ec2a11ec05f",
"static/timer-mockups.html": "86ec2dbcaf2ad078",
"static/trackside.js": "52247adb91774ec4",
"version.json": "a71723304ee6bc4e"
};
const CACHE = "train-log-" + VERSION;
const HASH_HEADER = "X-Train-Log-Hash";
const names = Object.keys(FILES);

// Safari aborts a service-worker install that downloads the whole field app (~26 MB).
// Install only the shell so the new version can take over; fill the rest after activate
// while older caches are still around for unchanged files.
function isShell(name) {
  if (name === "./" || name === "index.html") return true;
  if (name === "boot.js" || name === "offline.js" || name === "field.css" || name === "server.py" || name === "app.zip") return true;
  if (name.indexOf("icon-") === 0) return true;
  if (name.endsWith(".webmanifest")) return true;
  if (name === "static/styles.css" || name === "static/sync.js" || name === "static/form.js" || name === "static/icon.png") return true;
  // Settings / reference cards: keep these warm so Placards, Marks, Symbol Guide,
  // Heritage/Steam, Library, and Types open with data before the full offline fill.
  if (
    name === "static/catalog.js" ||
    name === "static/library.js" ||
    name === "static/aar-marks-ui.js" ||
    name === "static/reference/aar-marks.json"
  ) {
    return true;
  }
  if (name.indexOf("static/erg/") === 0) return true;
  return false;
}

function urlFor(name) {
  return new URL(name, self.location.href).href;
}

async function tell(message) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  windows.forEach(function (client) {
    client.postMessage(message);
  });
}

async function earlierCopy(name) {
  const hash = FILES[name];
  const keys = await caches.keys();
  for (const key of keys) {
    if (key === CACHE || key.indexOf("train-log-") !== 0) continue;
    const hit = await (await caches.open(key)).match(urlFor(name));
    if (hit && hit.headers.get(HASH_HEADER) === hash) return hit;
  }
  return null;
}

async function download(name) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(new Request(urlFor(name), { cache: "reload" }));
      if (!response.ok) throw new Error(name + " " + response.status);
      const headers = new Headers(response.headers);
      headers.set(HASH_HEADER, FILES[name]);
      return new Response(await response.blob(), { status: 200, statusText: "OK", headers: headers });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function putOne(cache, name) {
  await cache.put(urlFor(name), (await earlierCopy(name)) || (await download(name)));
}

async function missingFiles(cache) {
  const missing = [];
  for (const name of names) {
    const hit = await cache.match(urlFor(name));
    if (!hit || hit.headers.get(HASH_HEADER) !== FILES[name]) missing.push(name);
  }
  return missing;
}

async function cacheShell() {
  const cache = await caches.open(CACHE);
  const shell = names.filter(isShell);
  for (const name of shell) {
    try {
      await putOne(cache, name);
    } catch (err) {
      // Online fetches can cover gaps until fill() finishes.
    }
  }
}

// Fills this version's copy one file at a time, so a launch that is cut short picks up where it stopped.
async function fill() {
  const cache = await caches.open(CACHE);
  const missing = await missingFiles(cache);
  let done = names.length - missing.length;
  const failed = [];
  await tell({ type: "offline-progress", version: VERSION, done: done, total: names.length });
  for (const name of missing) {
    try {
      await putOne(cache, name);
      done += 1;
    } catch (err) {
      failed.push(name);
    }
    await tell({ type: "offline-progress", version: VERSION, done: done, total: names.length });
  }
  if (failed.length) {
    await tell({ type: "offline-progress", version: VERSION, done: done, total: names.length, failed: true });
    throw new Error("Could not save for offline: " + failed.join(", "));
  }
  await tell({ type: "offline-progress", version: VERSION, done: done, total: names.length, finished: true });
}

async function dropOldCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter(function (key) {
        return key.indexOf("train-log-") === 0 && key !== CACHE;
      })
      .map(function (key) {
        return caches.delete(key);
      })
  );
}

async function report() {
  const cache = await caches.open(CACHE);
  const missing = await missingFiles(cache);
  return { type: "offline-report", version: VERSION, total: names.length, have: names.length - missing.length, missing: missing };
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    cacheShell().then(function () {
      return self.skipWaiting();
    })
  );
});

let fillQueued = null;
let fillDelayTimer = 0;

function runFill() {
  if (fillQueued) return fillQueued;
  fillQueued = fill()
    .then(function () {
      return dropOldCaches();
    })
    .catch(function () {})
    .then(function () {
      fillQueued = null;
    });
  return fillQueued;
}

self.addEventListener("activate", function (event) {
  // Claim quickly so Check for Update can reload into this build. Do NOT start the full
  // ~26 MB fill here — that races the first Pyodide download after Add to Home Screen and
  // stalls Intel Macs / slower Wi‑Fi (Safari spinner forever). Boot asks for fill when
  // the pad is up; a delayed fallback still fills if that message never arrives.
  event.waitUntil(self.clients.claim());
  clearTimeout(fillDelayTimer);
  fillDelayTimer = setTimeout(function () {
    runFill();
  }, 45000);
});

self.addEventListener("message", function (event) {
  const data = event.data || {};
  const reply = function (message) {
    if (event.ports && event.ports[0]) event.ports[0].postMessage(message);
  };
  if (data.type === "offline-check") {
    event.waitUntil(report().then(reply));
  } else if (data.type === "offline-fill") {
    clearTimeout(fillDelayTimer);
    event.waitUntil(runFill().then(report).then(reply));
  } else if (data.type === "offline-repair") {
    clearTimeout(fillDelayTimer);
    event.waitUntil(
      runFill()
        .then(report)
        .then(reply)
    );
  } else if (data.type === "skip-waiting") {
    self.skipWaiting();
  }
});

function fetchWithTimeout(request, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(function () {
    ctrl.abort();
  }, ms);
  return fetch(request, { cache: "no-store", signal: ctrl.signal }).finally(function () {
    clearTimeout(timer);
  });
}

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    (async function () {
      const cache = await caches.open(CACHE);
      // Home Screen must open from cache even when the Mac is asleep or the firewall is
      // blocking a fresh TRAIN LOG build. Waiting on the Mac first is what produced
      // Safari's "server stopped responding" after 1.0.19. Repair Install clears caches
      // before reload, so that path still hits the Mac with no stale shell.
      if (event.request.mode === "navigate") {
        const cached =
          (await cache.match(event.request, { ignoreSearch: true })) || (await cache.match(urlFor("index.html")));
        if (cached) {
          // Refresh the shell in the background when the Mac answers quickly; never block open.
          event.waitUntil(
            fetchWithTimeout(event.request, 2500)
              .then(function (fresh) {
                if (fresh && fresh.ok) return cache.put(urlFor("index.html"), fresh.clone());
              })
              .catch(function () {})
          );
          return cached;
        }
        try {
          const fresh = await fetchWithTimeout(event.request, 12000);
          if (fresh && fresh.ok) {
            try {
              await cache.put(urlFor("index.html"), fresh.clone());
            } catch (err) {}
            return fresh;
          }
        } catch (err) {}
        throw new Error("offline");
      }
      const hit = await cache.match(event.request, { ignoreSearch: true });
      if (hit) return hit;
      try {
        return await fetch(event.request);
      } catch (err) {
        throw err;
      }
    })()
  );
});
