/**
 * Mint Asset (vanilla JS + optional Vite)
 * Notes:
 * - When running with Vite, keys can come from import.meta.env.VITE_*
 * - For pure static hosting, you can use config.js (window.MINT_ASSET_CONFIG) or localStorage
 * - Any frontend key is still public; hide keys with a backend/serverless proxy if needed
 */

// Runtime config for plain static hosting:
// - Preferred: create config.js (see config.example.js) defining window.MINT_ASSET_CONFIG
// - Fallback: set keys via DevTools -> Console using localStorage
const VITE_ENV = (import.meta && import.meta.env) ? import.meta.env : {};
const RUNTIME_CONFIG =
  (typeof window !== "undefined" && window.MINT_ASSET_CONFIG) ? window.MINT_ASSET_CONFIG : {};

const API_KEY =
  String(VITE_ENV.VITE_FINNHUB_API_KEY || "").trim() ||
  String(RUNTIME_CONFIG.FINNHUB_API_KEY || "").trim() ||
  String(localStorage.getItem("mintasset-finnhub-key") || "").trim();

const WEATHER_API_KEY =
  String(VITE_ENV.VITE_WEATHER_API_KEY || "").trim() ||
  String(RUNTIME_CONFIG.WEATHER_API_KEY || "").trim() ||
  String(localStorage.getItem("mintasset-weather-key") || "").trim();

const FALLBACK_IMAGE = "./mint_asset_pic.png";
const BOOKMARKS_KEY = "mintasset-bookmarks-v1";

const newsContainer = document.getElementById('news-container');
const loader = document.getElementById('loader');
const batchLoader = document.getElementById('loader-2');
const sentinel = document.getElementById('sentinel');
const homeBtn = document.getElementById('home-btn');
const statusEl = document.getElementById('status');
const retryBtn = document.getElementById('retry-btn');
const lastUpdatedEl = document.getElementById('last-updated');
const weatherContainer = document.getElementById('weatherContainer');

const themeSelect = document.getElementById("theme-toggle");
const searchInput = document.getElementById("search-input");
const categorySelect = document.getElementById("category-select");
const sortSelect = document.getElementById("sort-select");
const bookmarksOnlyToggle = document.getElementById("bookmarks-only");

// Modal elements
const modalEl = document.getElementById("article-modal");
const modalTitleEl = document.getElementById("modal-title");
const modalSummaryEl = document.getElementById("modal-summary");
const modalImageEl = document.getElementById("modal-image");
const modalSourceEl = document.getElementById("modal-source");
const modalTimeagoEl = document.getElementById("modal-timeago");
const modalOpenEl = document.getElementById("modal-open");
const modalBookmarkBtn = document.getElementById("modal-bookmark");
const modalShareBtn = document.getElementById("modal-share");

let allNews = [];
let filteredNews = [];
let currentIndex = 0;
let isFetching = false;
let isBatching = false;
let observer = null;
let lastFocusedEl = null;
let currentModalArticle = null;

function getBatchSize() {
  const width = window.innerWidth;
  if (width <= 768) return 10;
  if (width <= 1024) return 14;
  return 18;
}

function showStatus(message) {
  if (!message) {
    statusEl.style.display = "none";
    statusEl.textContent = "";
    return;
  }
  statusEl.textContent = message;
  statusEl.style.display = "block";
}

function setLastUpdated(tsMs) {
  lastUpdatedEl.textContent = tsMs ? `Updated ${new Date(tsMs).toLocaleTimeString()}` : "";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timeAgoFromSeconds(epochSeconds) {
  if (!epochSeconds) return "";
  const diffMs = Date.now() - epochSeconds * 1000;
  const s = Math.max(0, Math.floor(diffMs / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const ICON_BOOKMARK = `
  <svg class="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
  </svg>
`;

const ICON_SHARE = `
  <svg class="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <path d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .17 1L8.9 9.2a3 3 0 0 0-1.9-.7 3 3 0 1 0 2.83 4l6.27 3.2A3 3 0 0 0 16 17a3 3 0 1 0 1.9-2.8l-6.27-3.2A2.98 2.98 0 0 0 10 10c0-.34.06-.67.17-.98l6.27-3.2A3 3 0 0 0 18 8z" />
  </svg>
`;

function normalizeArticle(article) {
  const image = (article?.image || "").trim();
  const badImage =
    !image ||
    image.includes("market_watch_logo.png") ||
    image.includes("logobbg-wht.png");

  return {
    ...article,
    image: badImage ? FALLBACK_IMAGE : image,
    headline: article?.headline || "Untitled",
    summary: article?.summary || "",
    source: article?.source || "Source",
    url: article?.url || "",
    datetime: article?.datetime || 0,
  };
}

function dedupeByUrl(articles) {
  const seen = new Set();
  const out = [];
  for (const a of articles) {
    if (!a.url) continue;
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    out.push(a);
  }
  return out;
}

function loadBookmarks() {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveBookmarks(bookmarksObj) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarksObj));
}

function isBookmarked(url) {
  if (!url) return false;
  const b = loadBookmarks();
  return Boolean(b[url]);
}

function toggleBookmark(article) {
  const b = loadBookmarks();
  if (!article?.url) return { saved: false };
  if (b[article.url]) {
    delete b[article.url];
    saveBookmarks(b);
    return { saved: false };
  }
  b[article.url] = {
    url: article.url,
    headline: article.headline,
    summary: article.summary,
    image: article.image,
    datetime: article.datetime,
    source: article.source,
  };
  saveBookmarks(b);
  return { saved: true };
}

function isModalOpen() {
  return modalEl && !modalEl.hasAttribute("hidden");
}

function closeModal() {
  if (!modalEl) return;
  modalEl.setAttribute("hidden", "");
  document.body.classList.remove("modal-open");
  currentModalArticle = null;
  if (lastFocusedEl && typeof lastFocusedEl.focus === "function") lastFocusedEl.focus();
}

function openModal(article) {
  if (!modalEl || !article) return;
  lastFocusedEl = document.activeElement;
  currentModalArticle = article;

  const saved = isBookmarked(article.url);
  modalTitleEl.textContent = article.headline || "Untitled";
  modalSummaryEl.textContent = article.summary || "";
  modalSourceEl.textContent = article.source || "Source";
  modalTimeagoEl.textContent = timeAgoFromSeconds(article.datetime) || "";

  if (article.image) {
    modalImageEl.src = article.image;
    modalImageEl.alt = article.headline || "Article image";
    modalImageEl.hidden = false;
    modalImageEl.onerror = () => {
      modalImageEl.src = FALLBACK_IMAGE;
    };
  } else {
    modalImageEl.hidden = true;
  }

  modalOpenEl.href = article.url || "#";

  modalBookmarkBtn.innerHTML = ICON_BOOKMARK;
  modalBookmarkBtn.classList.toggle("is-active", saved);
  modalBookmarkBtn.setAttribute("aria-pressed", saved ? "true" : "false");
  modalBookmarkBtn.setAttribute("aria-label", saved ? "Remove bookmark" : "Save bookmark");
  modalBookmarkBtn.setAttribute("title", saved ? "Saved" : "Save");

  modalShareBtn.innerHTML = ICON_SHARE;

  modalEl.removeAttribute("hidden");
  document.body.classList.add("modal-open");

  // focus close button for accessibility
  const closeBtn = modalEl.querySelector("[data-modal-close]");
  if (closeBtn && typeof closeBtn.focus === "function") closeBtn.focus();
}

async function shareUrl(url, title) {
  if (!url) return;
  try {
    if (navigator.share) {
      await navigator.share({ title: title || "Mint Asset", url });
      showStatus("Shared.");
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      showStatus("Link copied to clipboard.");
    } else {
      showStatus("Sharing not supported in this browser.");
    }
  } catch {
    // user cancelled share
  } finally {
    setTimeout(() => showStatus(""), 1400);
  }
}

function applyTheme(theme) {
  const t = theme === "dark" || theme === "light" ? theme : "default";
  document.body.dataset.theme = t;
  localStorage.setItem("selected-theme", t);
}

function getCurrentSort() {
  return sortSelect?.value === "oldest" ? "oldest" : "newest";
}

function sortArticles(list) {
  const sort = getCurrentSort();
  const copy = [...list];
  copy.sort((a, b) => sort === "oldest" ? a.datetime - b.datetime : b.datetime - a.datetime);
  return copy;
}

function filterArticles() {
  const q = (searchInput?.value || "").trim().toLowerCase();
  const bookmarksOnly = Boolean(bookmarksOnlyToggle?.checked);

  if (bookmarksOnly) {
    const b = loadBookmarks();
    let list = Object.values(b).map(normalizeArticle);
    if (q) {
      list = list.filter(a =>
        (a.headline || "").toLowerCase().includes(q) ||
        (a.summary || "").toLowerCase().includes(q) ||
        (a.source || "").toLowerCase().includes(q)
      );
    }
    filteredNews = sortArticles(list);
    resetAndRender();
    return;
  }

  let list = allNews;
  if (q) {
    list = list.filter(a =>
      (a.headline || "").toLowerCase().includes(q) ||
      (a.summary || "").toLowerCase().includes(q) ||
      (a.source || "").toLowerCase().includes(q)
    );
  }
  filteredNews = sortArticles(list);
  resetAndRender();
}

function renderArticleCard(article) {
  const saved = isBookmarked(article.url);
  const safeHeadline = escapeHtml(article.headline);
  const safeSummary = escapeHtml(article.summary);
  const safeSource = escapeHtml(article.source);
  const safeUrl = escapeHtml(article.url);
  const timeAgo = timeAgoFromSeconds(article.datetime);

  const imgHtml = article.image
    ? `<img src="${escapeHtml(article.image)}" alt="${safeHeadline}" loading="lazy" decoding="async" data-fallback="${escapeHtml(FALLBACK_IMAGE)}">`
    : "";

  return `
    <div class="news-item" data-url="${safeUrl}">
      ${imgHtml}
      <div class="card-meta">
        <span class="badge">${safeSource}</span>
        <span class="timeago">${timeAgo || ""}</span>
      </div>
      <h2>${safeHeadline}</h2>
      <p>${safeSummary}</p>
      <div class="card-footer">
        <div class="card-actions">
          <button type="button" data-action="open" data-url="${safeUrl}">Read</button>
          <button
            type="button"
            class="icon-btn ${saved ? "is-active" : ""}"
            data-action="bookmark"
            data-url="${safeUrl}"
            aria-label="${saved ? "Remove bookmark" : "Save bookmark"}"
            aria-pressed="${saved ? "true" : "false"}"
            title="${saved ? "Saved" : "Save"}"
          >${ICON_BOOKMARK}</button>
          <button
            type="button"
            class="icon-btn"
            data-action="share"
            data-url="${safeUrl}"
            aria-label="Share"
            title="Share"
          >${ICON_SHARE}</button>
        </div>
        <small>${article.datetime ? new Date(article.datetime * 1000).toLocaleString() : "—"}</small>
      </div>
      </div>
    `;
}

function appendBatch(batch) {
  if (!batch.length) return;
  const html = batch.map(renderArticleCard).join("");
  newsContainer.insertAdjacentHTML("beforeend", html);
}

function resetAndRender() {
  currentIndex = 0;
  newsContainer.innerHTML = "";
  showStatus("");
  loadNextBatch(true);
}

function loadNextBatch(isInitial = false) {
  const list = filteredNews;
  if (!list || currentIndex >= list.length) {
    if (!list || list.length === 0) {
      showStatus(bookmarksOnlyToggle?.checked ? "No saved stories match your search." : "No stories match your search.");
    } else {
      showStatus("You’re all caught up.");
    }
    batchLoader.style.display = "none";
    return;
  }

  if (isBatching) return;
  isBatching = true;

  const batchSize = getBatchSize();
  const nextBatch = list.slice(currentIndex, currentIndex + batchSize);

  if (!isInitial) batchLoader.style.display = "flex";
  setTimeout(() => {
    appendBatch(nextBatch);
    currentIndex += batchSize;
    batchLoader.style.display = "none";
    isBatching = false;
  }, isInitial ? 0 : 250);
}

function setupObserver() {
  if (observer) observer.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) loadNextBatch(false);
      }
    },
    { root: null, rootMargin: "800px 0px", threshold: 0 }
  );
  observer.observe(sentinel);
}

async function fetchNews({ category, force } = {}) {
  if (!API_KEY) {
    const isVite = Boolean(VITE_ENV && (VITE_ENV.DEV || VITE_ENV.MODE));
    showStatus(
      isVite
        ? "Missing Finnhub API key. Add VITE_FINNHUB_API_KEY=... to your .env, then restart: Ctrl+C and npm run dev."
        : "Missing Finnhub API key. Provide it via config.js (window.MINT_ASSET_CONFIG) or localStorage: mintasset-finnhub-key."
    );
    retryBtn.hidden = true;
    return;
  }

  if (isFetching && !force) return;
  isFetching = true;

  retryBtn.hidden = true;
  showStatus("Loading news…");
  loader.style.display = "flex";

  try {
    const cat = category || categorySelect?.value || "general";
    const url = `https://finnhub.io/api/v1/news?category=${encodeURIComponent(cat)}&token=${encodeURIComponent(API_KEY)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    const normalized = dedupeByUrl((data || []).map(normalizeArticle));
    allNews = normalized;
    setLastUpdated(Date.now());
    filterArticles(); // respects search/sort + bookmarks toggle
    showStatus("");
  } catch (error) {
    console.error("Error fetching news:", error);
    showStatus("Couldn’t load news. Check your connection and try again.");
    retryBtn.hidden = false;
  } finally {
    loader.style.display = "none";
    isFetching = false;
  }
}

// ---- Event wiring ----
const storedTheme = localStorage.getItem('selected-theme') || 'default';
themeSelect.value = storedTheme;
applyTheme(storedTheme);

// Support SEO/SearchAction: /?q=tesla pre-fills search
try {
  const qFromUrl = new URLSearchParams(window.location.search).get("q");
  if (qFromUrl && searchInput) searchInput.value = qFromUrl;
} catch {
  // ignore
}

themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
searchInput.addEventListener("input", () => filterArticles());
sortSelect.addEventListener("change", () => filterArticles());
bookmarksOnlyToggle.addEventListener("change", () => filterArticles());

categorySelect.addEventListener("change", () => {
  bookmarksOnlyToggle.checked = false;
  fetchNews({ category: categorySelect.value, force: true });
});

retryBtn.addEventListener("click", () => fetchNews({ category: categorySelect.value, force: true }));

// SEO quick-links: jump to feed + switch category
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-set-category]");
  if (!a) return;
  const cat = a.getAttribute("data-set-category");
  if (!cat) return;
  e.preventDefault();
  if (categorySelect) categorySelect.value = cat;
  bookmarksOnlyToggle.checked = false;
  fetchNews({ category: cat, force: true });
  newsContainer?.focus?.({ preventScroll: true });
  if (location.hash !== "#feed") history.replaceState(null, "", "#feed");
});

newsContainer.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const url = btn.dataset.url;
  const article = filteredNews.find(a => a.url === url) || allNews.find(a => a.url === url);

  if (action === "open") {
    if (article) openModal(article);
    else if (url) window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  if (action === "bookmark") {
    const res = toggleBookmark(article || { url });
    btn.classList.toggle("is-active", res.saved);
    btn.setAttribute("aria-pressed", res.saved ? "true" : "false");
    btn.setAttribute("aria-label", res.saved ? "Remove bookmark" : "Save bookmark");
    btn.setAttribute("title", res.saved ? "Saved" : "Save");
    if (bookmarksOnlyToggle.checked) filterArticles();
    showStatus(res.saved ? "Saved to your list." : "Removed from saved.");
    setTimeout(() => showStatus(""), 1400);
    return;
  }

  if (action === "share") {
    await shareUrl(url, article?.headline);
  }
});

// Modal interactions
if (modalEl) {
  modalEl.addEventListener("click", async (e) => {
    const closeTarget = e.target.closest("[data-modal-close]");
    if (closeTarget) {
      closeModal();
      return;
    }
  });

  modalBookmarkBtn?.addEventListener("click", () => {
    if (!currentModalArticle) return;
    const res = toggleBookmark(currentModalArticle);
    modalBookmarkBtn.classList.toggle("is-active", res.saved);
    modalBookmarkBtn.setAttribute("aria-pressed", res.saved ? "true" : "false");
    modalBookmarkBtn.setAttribute("aria-label", res.saved ? "Remove bookmark" : "Save bookmark");
    modalBookmarkBtn.setAttribute("title", res.saved ? "Saved" : "Save");
    if (bookmarksOnlyToggle.checked) filterArticles();
    showStatus(res.saved ? "Saved to your list." : "Removed from saved.");
    setTimeout(() => showStatus(""), 1400);
  });

  modalShareBtn?.addEventListener("click", async () => {
    if (!currentModalArticle?.url) return;
    await shareUrl(currentModalArticle.url, currentModalArticle.headline);
  });

  document.addEventListener("keydown", (e) => {
    if (!isModalOpen()) return;
    if (e.key === "Escape") closeModal();
  });
}

newsContainer.addEventListener("error", (e) => {
  const img = e.target;
  if (img && img.tagName === "IMG") {
    const fallback = img.getAttribute("data-fallback") || FALLBACK_IMAGE;
    if (img.src !== fallback) img.src = fallback;
  }
}, true);

homeBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

function updateBackToTopVisibility() {
  // show earlier so it’s actually discoverable on smaller screens
  if (window.scrollY > 250) homeBtn.classList.add("is-visible");
  else homeBtn.classList.remove("is-visible");
}

window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
window.addEventListener("resize", updateBackToTopVisibility, { passive: true });
updateBackToTopVisibility();

// ---- Weather ----
function fetchWeather(lat, lon) {
  if (!WEATHER_API_KEY) {
    const isVite = Boolean(VITE_ENV && (VITE_ENV.DEV || VITE_ENV.MODE));
    weatherContainer.textContent = isVite
      ? "Weather: missing VITE_WEATHER_API_KEY in .env"
      : "Weather: API key not configured";
    return;
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${encodeURIComponent(WEATHER_API_KEY)}&units=metric`;
  fetch(url)
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    .then(displayWeather)
    .catch((error) => {
      console.error("Error fetching weather data:", error);
      weatherContainer.textContent = "Weather unavailable right now.";
    });
}

function displayWeather(data) {
  const temperature = data?.main?.feels_like;
  const description = data?.weather?.[0]?.description || "Weather";
  const city = data?.name || "";
  const region = data?.sys?.country || "";
  const iconCode = data?.weather?.[0]?.icon;
  const iconUrl = iconCode ? `https://openweathermap.org/img/wn/${iconCode}@2x.png` : "";

  weatherContainer.innerHTML = `
    ${iconUrl ? `<img src="${iconUrl}" alt="${escapeHtml(description)}" id="weather-icon" loading="lazy" decoding="async">` : ""}
    <span>${typeof temperature === "number" ? `${Math.round(temperature)}°C` : ""}</span>
    <span>${escapeHtml(description)}${description ? "," : ""}</span>
    <span>${escapeHtml(city)}</span>
    <span>${escapeHtml(region)}</span>
  `;
}

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
    () => { weatherContainer.textContent = "Enable location to show local weather."; },
    { timeout: 7000 }
  );
} else {
  weatherContainer.textContent = "Geolocation not supported in this browser.";
}

setupObserver();
fetchNews({ category: categorySelect.value, force: true });
setInterval(() => fetchNews({ category: categorySelect.value }), 5 * 60 * 1000);
