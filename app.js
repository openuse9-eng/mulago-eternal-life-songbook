/* =========================
   MULAGO ETERNAL LIFE SONGBOOK
   Final app.js
   ========================= */

const state = {
  en: [],
  lg: [],
  favorites: JSON.parse(localStorage.getItem("favorites") || "[]"),
  currentLang: "en",
  currentIndex: 0,
  fontSize: localStorage.getItem("fontSize") || "normal"
};

/* ---------- Utilities ---------- */

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function saveFavorites() {
  localStorage.setItem("favorites", JSON.stringify(state.favorites));
}

function getHymnId(lang, hymn) {
  return `${lang}-${hymn.number ?? hymn.id ?? hymn.title}`;
}

function isFavorite(lang, hymn) {
  return state.favorites.includes(getHymnId(lang, hymn));
}

function toggleFavorite(lang, hymn) {
  const id = getHymnId(lang, hymn);

  if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter(item => item !== id);
  } else {
    state.favorites.push(id);
  }

  saveFavorites();
  renderList(lang, $("searchInput")?.value || "");
  renderFavorites();
}

/* ---------- Lyrics formatting ---------- */

function cleanLine(line) {
  return String(line ?? "")
    .replace(/[{}]/g, "")
    .replace(/\r/g, "")
    .trim();
}

function isSectionHeading(line) {
  return /^(CHORUS|BRIDGE|REFRAIN|VERSE|VAMP|TAG|INTRO|CODA|PRE[- ]?CHORUS)\s*:?[.!]*$/i.test(
    cleanLine(line)
  );
}

function sectionName(line) {
  const text = cleanLine(line);

  if (/^PRE[- ]?CHORUS/i.test(text)) return "PRE-CHORUS";

  return text
    .replace(/:?[.!]*$/, "")
    .trim()
    .toUpperCase();
}

function sectionClass(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function formatLyrics(hymn) {
  let lyrics = hymn?.lyrics ?? hymn?.text ?? hymn?.content ?? "";

  if (Array.isArray(lyrics)) {
    lyrics = lyrics.join("\n");
  }

  lyrics = String(lyrics)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const lines = lyrics
    .split("\n")
    .map(cleanLine);

  const sections = [];
  let current = {
    name: "",
    type: "stanza",
    lines: []
  };

  function pushCurrent() {
    if (current.lines.length) {
      sections.push({
        name: current.name,
        type: current.type,
        lines: [...current.lines]
      });
    }
  }

  lines.forEach(line => {
    if (!line) {
      if (current.lines.length) {
        current.lines.push("");
      }
      return;
    }

    if (isSectionHeading(line)) {
      pushCurrent();

      const name = sectionName(line);

      current = {
        name,
        type: sectionClass(name),
        lines: []
      };

      return;
    }

    current.lines.push(line);
  });

  pushCurrent();

  if (!sections.length && lines.some(Boolean)) {
    sections.push({
      name: "",
      type: "stanza",
      lines: lines.filter(Boolean)
    });
  }

  return sections
    .map(section => {
      const text = section.lines
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      if (!text) return "";

      const heading = section.name
        ? `<div class="lyric-heading">${escapeHtml(section.name)}</div>`
        : "";

      return `
        <div class="lyric-section ${escapeHtml(section.type)}">
          ${heading}
          <div class="stanza">${escapeHtml(text)}</div>
        </div>
      `;
    })
    .join("");
}

function getFirstLine(hymn) {
  let lyrics = hymn?.lyrics ?? hymn?.text ?? hymn?.content ?? "";

  if (Array.isArray(lyrics)) {
    lyrics = lyrics.join("\n");
  }

  const lines = String(lyrics)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);

  for (const line of lines) {
    if (!isSectionHeading(line)) {
      if (!/^(KEY|KEY:|TIME|TEMPO|CAPO)\b/i.test(line)) {
        return line;
      }
    }
  }

  return "";
}

/* ---------- Hymn list ---------- */

function renderList(lang, query = "") {
  const container =
    lang === "en"
      ? $("englishList") || $("hymnListEn") || $("englishHymns")
      : $("lugandaList") || $("hymnListLg") || $("lugandaHymns");

  if (!container) return;

  const hymns = state[lang] || [];
  const q = String(query).trim().toLowerCase();

  const filtered = hymns.filter(hymn => {
    if (!q) return true;

    const number = String(hymn.number ?? hymn.id ?? "");
    const title = String(hymn.title ?? hymn.name ?? "");
    const lyrics = String(
      hymn.lyrics ?? hymn.text ?? hymn.content ?? ""
    );

    return (
      number.toLowerCase().includes(q) ||
      title.toLowerCase().includes(q) ||
      lyrics.toLowerCase().includes(q)
    );
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        No hymns found.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((hymn, filteredIndex) => {
      const number = hymn.number ?? hymn.id ?? filteredIndex + 1;
      const title = hymn.title ?? hymn.name ?? "Untitled hymn";
      const preview = getFirstLine(hymn);
      const favorite = isFavorite(lang, hymn);

      return `
        <div class="hymn-row english-row"
             data-lang="${escapeHtml(lang)}"
             data-index="${escapeHtml(filteredIndex)}">

          <div class="num">${escapeHtml(number)}</div>

          <div class="row-main">
            <div class="row-title">${escapeHtml(title)}</div>
            <div class="row-preview">${escapeHtml(preview)}</div>
          </div>

          <button
            class="row-fav"
            type="button"
            aria-label="${favorite ? "Remove from favorites" : "Add to favorites"}"
            data-fav-lang="${escapeHtml(lang)}"
            data-fav-id="${escapeHtml(getHymnId(lang, hymn))}">
            ${favorite ? "★" : "☆"}
          </button>
        </div>
      `;
    })
    .join("");

  container.querySelectorAll(".hymn-row").forEach(row => {
    row.addEventListener("click", event => {
      if (event.target.closest(".row-fav")) return;

      const index = Number(row.dataset.index);
      const hymn = filtered[index];

      if (hymn) {
        openHymn(lang, hymn);
      }
    });
  });

  container.querySelectorAll(".row-fav").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();

      const hymn = (state[lang] || []).find(
        item => getHymnId(lang, item) === button.dataset.favId
      );

      if (hymn) {
        toggleFavorite(lang, hymn);
      }
    });
  });
}

/* ---------- Favorites ---------- */

function renderFavorites() {
  const container =
    $("favoritesList") ||
    $("favouritesList") ||
    $("favoriteList");

  if (!container) return;

  const items = [];

  ["en", "lg"].forEach(lang => {
    (state[lang] || []).forEach(hymn => {
      if (isFavorite(lang, hymn)) {
        items.push({ lang, hymn });
      }
    });
  });

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        No favorite hymns yet.
      </div>
    `;
    return;
  }

  container.innerHTML = items
    .map(({ lang, hymn }) => {
      const number = hymn.number ?? hymn.id ?? "";
      const title = hymn.title ?? hymn.name ?? "Untitled hymn";
      const preview = getFirstLine(hymn);

      return `
        <div class="hymn-row english-row"
             data-fav-lang="${escapeHtml(lang)}"
             data-fav-id="${escapeHtml(getHymnId(lang, hymn))}">

          <div class="num">${escapeHtml(number)}</div>

          <div class="row-main">
            <div class="row-title">${escapeHtml(title)}</div>
            <div class="row-preview">${escapeHtml(preview)}</div>
          </div>

          <button
            class="row-fav"
            type="button"
            aria-label="Remove from favorites">
            ★
          </button>
        </div>
      `;
    })
    .join("");

  container.querySelectorAll(".hymn-row").forEach(row => {
    row.addEventListener("click", event => {
      const lang = row.dataset.favLang;
      const hymn = (state[lang] || []).find(
        item => getHymnId(lang, item) === row.dataset.favId
      );

      if (!event.target.closest(".row-fav") && hymn) {
        openHymn(lang, hymn);
      }
    });
  });

  container.querySelectorAll(".row-fav").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();

      const row = button.closest(".hymn-row");
      const lang = row.dataset.favLang;

      const hymn = (state[lang] || []).find(
        item => getHymnId(lang, item) === row.dataset.favId
      );

      if (hymn) {
        toggleFavorite(lang, hymn);
      }
    });
  });
      }
/* ---------- Reader ---------- */

function renderCurrentHymn() {
  const reader = $("reader");
  if (!reader) return;

  const hymns = state[state.currentLang] || [];
  const hymn = hymns[state.currentIndex];

  if (!hymn) return;

  const title = hymn.title ?? hymn.name ?? "Untitled hymn";
  const number = hymn.number ?? hymn.id ?? "";

  const article = reader.querySelector("article") || reader;

  article.innerHTML = `
    <div class="reader-header">
      <div class="reader-number">
        ${escapeHtml(number)}
      </div>

      <h2>${escapeHtml(title)}</h2>

      <button
        id="readerFav"
        class="reader-fav"
        type="button"
        aria-label="Favorite hymn">
        ${isFavorite(state.currentLang, hymn) ? "★" : "☆"}
      </button>
    </div>

    <div class="lyrics">
      ${formatLyrics(hymn)}
    </div>
  `;

  const favButton = $("readerFav");

  if (favButton) {
    favButton.addEventListener("click", () => {
      toggleFavorite(state.currentLang, hymn);
      renderCurrentHymn();
    });
  }

  const readerTitle = $("readerTitle");
  if (readerTitle) {
    readerTitle.textContent = title;
  }

  const readerNumber = $("readerNumber");
  if (readerNumber) {
    readerNumber.textContent = number;
  }

  applyFont();
}

function openHymn(lang, hymn) {
  const hymns = state[lang] || [];
  const index = hymns.indexOf(hymn);

  state.currentLang = lang;
  state.currentIndex = index >= 0 ? index : 0;

  renderCurrentHymn();

  const reader = $("reader");

  if (reader) {
    reader.classList.add("open");
    reader.removeAttribute("hidden");
  }

  document.body.classList.add("reader-open");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function closeReader() {
  const reader = $("reader");

  if (reader) {
    reader.classList.remove("open");

    if (reader.hasAttribute("hidden") === false) {
      reader.setAttribute("hidden", "");
    }
  }

  document.body.classList.remove("reader-open");
}

function previousHymn() {
  const hymns = state[state.currentLang] || [];

  if (!hymns.length) return;

  state.currentIndex--;

  if (state.currentIndex < 0) {
    state.currentIndex = hymns.length - 1;
  }

  renderCurrentHymn();
}

function nextHymn() {
  const hymns = state[state.currentLang] || [];

  if (!hymns.length) return;

  state.currentIndex++;

  if (state.currentIndex >= hymns.length) {
    state.currentIndex = 0;
  }

  renderCurrentHymn();
}

/* ---------- Font size ---------- */

function applyFont() {
  const reader = $("reader");

  if (!reader) return;

  reader.classList.remove(
    "font-small",
    "font-normal",
    "font-large"
  );

  if (state.fontSize === "small") {
    reader.classList.add("font-small");
  } else if (state.fontSize === "large") {
    reader.classList.add("font-large");
  } else {
    reader.classList.add("font-normal");
  }
}

function setFontSize(size) {
  if (!["small", "normal", "large"].includes(size)) {
    size = "normal";
  }

  state.fontSize = size;
  localStorage.setItem("fontSize", size);

  applyFont();
}

/* ---------- Sermons ---------- */

function renderSermons() {
  const container =
    $("sermonsList") ||
    $("sermonList") ||
    $("sermons");

  if (!container) return;

  const sermons =
    Array.isArray(window.sermons)
      ? window.sermons
      : [];

  if (!sermons.length) {
    container.innerHTML = `
      <div class="empty-state">
        No sermons available.
      </div>
    `;
    return;
  }

  container.innerHTML = sermons
    .map((sermon, index) => {
      const title =
        typeof sermon === "string"
          ? sermon
          : sermon.title ?? `Sermon ${index + 1}`;

      return `
        <div class="sermon-row">
          ${escapeHtml(title)}
        </div>
      `;
    })
    .join("");
}

/* ---------- Search ---------- */

function setupSearch() {
  const input = $("searchInput");

  if (!input) return;

  input.addEventListener("input", () => {
    const query = input.value;

    renderList("en", query);
    renderList("lg", query);
  });
}

/* ---------- Language / tabs ---------- */

function showLanguage(lang) {
  const english =
    $("englishSection") ||
    $("englishHymnsSection") ||
    $("english");

  const luganda =
    $("lugandaSection") ||
    $("lugandaHymnsSection") ||
    $("luganda");

  if (english) {
    english.classList.toggle("active", lang === "en");
    english.hidden = lang !== "en";
  }

  if (luganda) {
    luganda.classList.toggle("active", lang === "lg");
    luganda.hidden = lang !== "lg";
  }

  document
    .querySelectorAll("[data-lang-tab]")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.langTab === lang
      );
    });
}

function setupLanguageTabs() {
  document
    .querySelectorAll("[data-lang-tab]")
    .forEach(button => {
      button.addEventListener("click", () => {
        showLanguage(button.dataset.langTab);
      });
    });
}

/* ---------- Buttons ---------- */

function setupButtons() {
  const closeButton =
    $("closeReader") ||
    $("readerClose") ||
    $("close");

  if (closeButton) {
    closeButton.addEventListener("click", closeReader);
  }

  const previous =
    $("prevHymn") ||
    $("previousHymn") ||
    $("prev");

  if (previous) {
    previous.addEventListener("click", previousHymn);
  }

  const next =
    $("nextHymn") ||
    $("next");

  if (next) {
    next.addEventListener("click", nextHymn);
  }

  const small =
    $("fontDown") ||
    $("fontSmall");

  if (small) {
    small.addEventListener("click", () => {
      setFontSize("small");
    });
  }

  const normal =
    $("fontNormal") ||
    $("fontReset");

  if (normal) {
    normal.addEventListener("click", () => {
      setFontSize("normal");
    });
  }

  const large =
    $("fontUp") ||
    $("fontLarge");

  if (large) {
    large.addEventListener("click", () => {
      setFontSize("large");
    });
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeReader();
    }

    if (event.key === "ArrowLeft") {
      previousHymn();
    }

    if (event.key === "ArrowRight") {
      nextHymn();
    }
  });
}

/* ---------- Data loading ---------- */

async function loadJson(url) {
  const response = await fetch(url, {
    cache: "no-cache"
  });

  if (!response.ok) {
    throw new Error(
      `Unable to load ${url}: ${response.status}`
    );
  }

  return response.json();
}

function normalizeHymns(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.hymns)) {
    return data.hymns;
  }

  if (Array.isArray(data?.songs)) {
    return data.songs;
  }

  return [];
}

async function load() {
  try {
    const [englishData, lugandaData] =
      await Promise.all([
        loadJson("hymns-en.json"),
        loadJson("hymns-lg.json")
      ]);

    state.en = normalizeHymns(englishData);
    state.lg = normalizeHymns(lugandaData);

    renderList("en", "");
    renderList("lg", "");
    renderFavorites();
    renderSermons();

    applyFont();
    showLanguage("en");

  } catch (error) {
    console.error("Songbook loading error:", error);

    const message = document.createElement("div");

    message.className = "load-error";

    message.textContent =
      "Unable to load the hymn books. Please refresh the page.";

    document.body.prepend(message);
  }
}

/* ---------- Start application ---------- */

document.addEventListener("DOMContentLoaded", () => {
  setupSearch();
  setupLanguageTabs();
  setupButtons();
  load();
});
