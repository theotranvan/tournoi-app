/// <reference lib="webworker" />

/**
 * Kickoff — Service Worker
 *
 * Caching strategies:
 * - App shell (HTML, CSS, JS, fonts): Cache-first + periodic update
 * - API calls: Network-first with cache fallback
 * - Static assets (images, icons): Cache-first
 * - Navigation failures: Offline page fallback
 */

const CACHE_VERSION = "kickoff-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;
const PUBLIC_API_CACHE = `${CACHE_VERSION}-public-api`;
const MATCHES_CACHE = `${CACHE_VERSION}-matches`;

// App shell files to precache on install
const APP_SHELL = [
  "/",
  "/offline",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// ── Install ─────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn("[SW] Failed to precache some resources:", err);
      });
    })
  );
  // Activate immediately without waiting for tabs to close
  self.skipWaiting();
});

// ── Activate ────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("kickoff-") &&
              key !== STATIC_CACHE &&
              key !== DYNAMIC_CACHE &&
              key !== API_CACHE &&
              key !== PUBLIC_API_CACHE &&
              key !== MATCHES_CACHE
          )
          .map((key) => caches.delete(key))
      )
    )
  );
  // Claim existing clients
  self.clients.claim();
});

// ── Fetch ───────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin && !url.hostname.includes("fonts")) {
    return;
  }

  // WebSocket — don't cache
  if (url.protocol === "ws:" || url.protocol === "wss:") return;

  // Public API — stale-while-revalidate (coach can always see cached data)
  if (url.pathname.match(/\/api\/v1\/public\//)) {
    event.respondWith(staleWhileRevalidate(request, PUBLIC_API_CACHE));
    return;
  }

  // Match API — network-first with 5s timeout
  if (url.pathname.match(/\/api\/v1\/tournaments\/.*\/matches/)) {
    event.respondWith(networkFirstWithTimeout(request, MATCHES_CACHE, 5000));
    return;
  }

  // Other API calls — network-first
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Static assets — cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation requests — network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request, DYNAMIC_CACHE).catch(() => {
        return caches.match("/offline") || new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/html" },
        });
      })
    );
    return;
  }

  // Everything else — stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
});

// ── Caching Strategies ──────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 408 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("Network failed and no cache available");
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        caches.open(cacheName).then((cache) => {
          cache.put(request, response.clone());
        });
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

async function networkFirstWithTimeout(request, cacheName, timeoutMs) {
  const cached = await caches.match(request);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (cached) return cached;
    return new Response(JSON.stringify({ detail: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico|webp)$/i.test(
    pathname
  );
}

// ── Push notifications ──────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || "Kickoff", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.tag || "kickoff",
        data: { url: data.url || "/" },
        vibrate: [100, 50, 100],
      })
    );
  } catch {
    // Ignore malformed push
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// ── Background Sync — Pending Scores ────────────────────────────────────────

const PENDING_SCORES_STORE = "kickoff-pending-scores";

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-pending-scores") {
    event.waitUntil(syncPendingScores());
  }
});

async function syncPendingScores() {
  let db;
  try {
    db = await openScoresDB();
  } catch {
    return;
  }

  const tx = db.transaction(PENDING_SCORES_STORE, "readonly");
  const store = tx.objectStore(PENDING_SCORES_STORE);
  const entries = await idbGetAll(store);
  tx.oncomplete = () => {};

  let synced = 0;
  const failed = [];

  for (const entry of entries) {
    try {
      const res = await fetch(entry.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(entry.token ? { Authorization: `Bearer ${entry.token}` } : {}),
        },
        body: JSON.stringify(entry.data),
      });
      if (res.ok) {
        synced++;
        // Remove from DB
        const delTx = db.transaction(PENDING_SCORES_STORE, "readwrite");
        delTx.objectStore(PENDING_SCORES_STORE).delete(entry.id);
      } else {
        failed.push(entry);
      }
    } catch {
      failed.push(entry);
    }
  }

  db.close();

  // Notify all open clients
  if (synced > 0) {
    const allClients = await self.clients.matchAll({ type: "window" });
    for (const client of allClients) {
      client.postMessage({
        type: "SCORES_SYNCED",
        count: synced,
        remaining: failed.length,
      });
    }
  }
}

function openScoresDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("kickoff-offline", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PENDING_SCORES_STORE)) {
        db.createObjectStore(PENDING_SCORES_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
