/* =========================================================
   MULAGO ETERNAL LIFE SONGBOOK
   BIBLE READER
   Offline-first English NKJV + Luganda Bible
   ========================================================= */


/* =========================================================
   BIBLE CONFIGURATION
   ========================================================= */

const BIBLE_STORAGE = {
  database: 'melgc-bible-db',
  version: 1,
  store: 'bibles',
  dataVersion: '2026-09-12-v1'
};

const BIBLE_FILES = {
  en: 'bible-en.json',
  lg: 'bible-lg.json'
};

const BIBLE_NAMES = {
  en: 'English Bible',
  lg: 'Luganda Bible'
};


/* =========================================================
   BIBLE STATE
   ========================================================= */

const bibleState = {

  data: {
    en: null,
    lg: null
  },

  loading: {
    en: false,
    lg: false
  },

  loadedFrom: {
    en: null,
    lg: null
  },

  lang: null,

  bookIndex: 0,

  chapterIndex: 0,

  search: '',

  mode: 'languages'
};


/* =========================================================
   DOM HELPER
   ========================================================= */

const bible$ =
  selector => document.querySelector(selector);


/* =========================================================
   HTML ESCAPING
   ========================================================= */

function bibleEsc(value) {

  return String(value ?? '').replace(
    /[&<>"']/g,

    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char])
  );
}


/*
 * Bible text may contain <em> and <i>.
 * Allow only those two formatting tags.
 */
function bibleSafeText(value) {

  return bibleEsc(value)
    .replace(
      /&lt;(\/?)em&gt;/gi,
      '<$1em>'
    )
    .replace(
      /&lt;(\/?)i&gt;/gi,
      '<$1i>'
    );
}


/* =========================================================
   INDEXEDDB
   ========================================================= */

let bibleDBPromise = null;


function bibleOpenDB() {

  if (bibleDBPromise) {
    return bibleDBPromise;
  }

  bibleDBPromise =
    new Promise((resolve, reject) => {

      if (!('indexedDB' in window)) {

        reject(
          new Error(
            'IndexedDB is not available.'
          )
        );

        return;
      }

      const request =
        indexedDB.open(
          BIBLE_STORAGE.database,
          BIBLE_STORAGE.version
        );


      request.onupgradeneeded =
        event => {

          const db =
            event.target.result;

          if (
            !db.objectStoreNames.contains(
              BIBLE_STORAGE.store
            )
          ) {

            db.createObjectStore(
              BIBLE_STORAGE.store,
              {
                keyPath: 'lang'
              }
            );
          }
        };


      request.onsuccess =
        event => {

          const db =
            event.target.result;

          resolve(db);
        };


      request.onerror =
        () => {

          reject(
            request.error ||
            new Error(
              'Could not open Bible database.'
            )
          );
        };
    });

  return bibleDBPromise;
}


/* =========================================================
   READ BIBLE FROM INDEXEDDB
   ========================================================= */

async function bibleIDBGet(lang) {

  try {

    const db =
      await bibleOpenDB();

    return await new Promise(
      (resolve, reject) => {

        const transaction =
          db.transaction(
            BIBLE_STORAGE.store,
            'readonly'
          );

        const store =
          transaction.objectStore(
            BIBLE_STORAGE.store
          );

        const request =
          store.get(lang);


        request.onsuccess =
          () => {

            const record =
              request.result;

            if (
              !record ||
              record.version !==
                BIBLE_STORAGE.dataVersion
            ) {

              resolve(null);

              return;
            }

            resolve(record.data);
          };


        request.onerror =
          () => {

            reject(
              request.error ||
              new Error(
                'Could not read Bible from IndexedDB.'
              )
            );
          };
      }
    );

  } catch (error) {

    console.warn(
      '[Bible] IndexedDB read unavailable:',
      error
    );

    return null;
  }
}


/* =========================================================
   SAVE BIBLE TO INDEXEDDB
   ========================================================= */

async function bibleIDBPut(
  lang,
  data
) {

  try {

    const db =
      await bibleOpenDB();

    await new Promise(
      (resolve, reject) => {

        const transaction =
          db.transaction(
            BIBLE_STORAGE.store,
            'readwrite'
          );

        const store =
          transaction.objectStore(
            BIBLE_STORAGE.store
          );


        store.put({
          lang: lang,

          version:
            BIBLE_STORAGE.dataVersion,

          savedAt:
            Date.now(),

          data: data
        });


        transaction.oncomplete =
          () => resolve();


        transaction.onerror =
          () => {

            reject(
              transaction.error ||
              new Error(
                'Could not save Bible.'
              )
            );
          };


        transaction.onabort =
          () => {

            reject(
              transaction.error ||
              new Error(
                'Bible database transaction aborted.'
              )
            );
          };
      }
    );

    console.log(
      `[Bible] Saved ${lang} Bible to IndexedDB.`
    );

    return true;

  } catch (error) {

    console.warn(
      '[Bible] Could not save to IndexedDB:',
      error
    );

    return false;
  }
}


/* =========================================================
   DELETE OLD BIBLE DATA
   ========================================================= */

async function bibleIDBDelete(lang) {

  try {

    const db =
      await bibleOpenDB();

    await new Promise(
      (resolve, reject) => {

        const transaction =
          db.transaction(
            BIBLE_STORAGE.store,
            'readwrite'
          );

        const store =
          transaction.objectStore(
            BIBLE_STORAGE.store
          );

        store.delete(lang);

        transaction.oncomplete =
          () => resolve();

        transaction.onerror =
          () => reject(
            transaction.error
          );
      }
    );

  } catch (error) {

    console.warn(
      '[Bible] Could not delete cached Bible:',
      error
    );
  }
}


/* =========================================================
   VALIDATE BIBLE DATA
   ========================================================= */

function bibleValidate(data, lang) {

  if (
    !data ||
    !Array.isArray(data.books)
  ) {

    throw new Error(
      `${BIBLE_NAMES[lang]} data is invalid.`
    );
  }


  if (data.books.length === 0) {

    throw new Error(
      `${BIBLE_NAMES[lang]} contains no books.`
    );
  }


  for (
    let bookIndex = 0;
    bookIndex < data.books.length;
    bookIndex++
  ) {

    const book =
      data.books[bookIndex];

    if (
      !book ||
      !Array.isArray(book.chapters)
    ) {

      throw new Error(
        `${BIBLE_NAMES[lang]} contains an invalid book.`
      );
    }
  }


  return true;
}


/* =========================================================
   READ BIBLE FROM CACHE STORAGE
   ========================================================= */

async function bibleCacheGet(lang) {

  try {

    if (!('caches' in window)) {
      return null;
    }

    const file =
      BIBLE_FILES[lang];

    const url =
      new URL(
        file,
        document.baseURI
      ).href;


    const response =
      await caches.match(url);


    if (!response) {
      return null;
    }


    if (!response.ok) {
      return null;
    }


    const data =
      await response.json();


    bibleValidate(
      data,
      lang
    );


    console.log(
      `[Bible] Loaded ${lang} Bible from Cache Storage.`
    );


    return data;

  } catch (error) {

    console.warn(
      '[Bible] Cache Storage read failed:',
      error
    );

    return null;
  }
}


/* =========================================================
   NETWORK DOWNLOAD
   ========================================================= */

async function bibleNetworkGet(lang) {

  const file =
    BIBLE_FILES[lang];

  const url =
    new URL(
      file,
      document.baseURI
    ).href;


  console.log(
    `[Bible] Downloading ${lang} Bible:`,
    url
  );


  const response =
    await fetch(
      url,
      {
        cache: 'no-cache'
      }
    );


  if (!response.ok) {

    throw new Error(
      `${file} returned HTTP ` +
      `${response.status} ` +
      `${response.statusText}`
    );
  }


  const data =
    await response.json();


  bibleValidate(
    data,
    lang
  );


  console.log(
    `[Bible] Downloaded ${lang} Bible successfully.`
  );


  return data;
}


/* =========================================================
   MAIN OFFLINE-FIRST LOADER
   ========================================================= */

async function loadBibleData(lang) {

  /*
   * Already in memory.
   */
  if (
    bibleState.data[lang]
  ) {

    return bibleState.data[lang];
  }


  /*
   * Prevent two simultaneous downloads
   * of the same Bible.
   */
  if (
    bibleState.loading[lang]
  ) {

    return new Promise(
      resolve => {

        const check =
          setInterval(() => {

            if (
              !bibleState.loading[lang]
            ) {

              clearInterval(check);

              resolve(
                bibleState.data[lang]
              );
            }

          }, 100);
      }
    );
  }


  bibleState.loading[lang] = true;


  try {

    /*
     * =====================================================
     * 1. IndexedDB
     * =====================================================
     *
     * This is our primary offline storage.
     */

    const stored =
      await bibleIDBGet(lang);


    if (stored) {

      bibleValidate(
        stored,
        lang
      );

      bibleState.data[lang] =
        stored;

      bibleState.loadedFrom[lang] =
        'IndexedDB';

      console.log(
        `[Bible] ${lang} loaded offline from IndexedDB.`
      );

      return stored;
    }


    /*
     * =====================================================
     * 2. Cache Storage
     * =====================================================
     *
     * The service worker may already have
     * the JSON cached.
     */

    const cached =
      await bibleCacheGet(lang);


    if (cached) {

      bibleState.data[lang] =
        cached;

      bibleState.loadedFrom[lang] =
        'Cache Storage';


      /*
       * Move the cached Bible into IndexedDB
       * so future loads are faster.
       */

      await bibleIDBPut(
        lang,
        cached
      );


      return cached;
    }


    /*
     * =====================================================
     * 3. NETWORK
     * =====================================================
     */

    const downloaded =
      await bibleNetworkGet(lang);


    bibleState.data[lang] =
      downloaded;

    bibleState.loadedFrom[lang] =
      'Network';


    /*
     * Save permanently for offline use.
     */

    await bibleIDBPut(
      lang,
      downloaded
    );


    return downloaded;


  } finally {

    bibleState.loading[lang] =
      false;
  }
}


/* =========================================================
   STATUS MESSAGE
   ========================================================= */

function bibleSetStatus(
  message
) {

  const elements = [
    bible$('#bibleStatus'),
    bible$('#bibleLoadingStatus')
  ];

  elements.forEach(
    element => {

      if (element) {
        element.textContent =
          message;
      }
    }
  );
}


/* =========================================================
   LANGUAGE
   ========================================================= */

function bibleLanguage(lang) {

  const data =
    bibleState.data[lang];


  if (!data) {

    console.error(
      '[Bible] No data for:',
      lang
    );

    return;
  }


  bibleState.lang =
    lang;

  bibleState.bookIndex =
    0;

  bibleState.chapterIndex =
    0;

  bibleState.search =
    '';


  const title =
    bible$('#bibleBooksTitle');

  const subtitle =
    bible$('#bibleBooksSub');


  if (title) {

    title.textContent =
      BIBLE_NAMES[lang];
  }


  if (subtitle) {

    subtitle.textContent =
      lang === 'en'
        ? (
          data.translation ||
          'New King James Version'
        )
        : 'Luganda Bible';
  }


  const search =
    bible$('#bibleSearch');


  if (search) {
    search.value = '';
  }


  bibleRenderBooks();

  bibleShow(
    'bibleBooks'
  );


  bibleSetStatus(
    bibleState.loadedFrom[lang] ===
      'Network'
      ? 'Available offline'
      : 'Available offline'
  );
}


/* =========================================================
   SHOW VIEW
   ========================================================= */

function bibleShow(id) {

  document
    .querySelectorAll(
      '.bible-view'
    )
    .forEach(
      view => {

        view.classList.toggle(
          'active',
          view.id === id
        );
      }
    );


  bibleState.mode =
    id;
}


/* =========================================================
   HOME
   ========================================================= */

function bibleHome() {

  bibleState.lang =
    null;

  bibleState.bookIndex =
    0;

  bibleState.chapterIndex =
    0;

  bibleState.search =
    '';


  const search =
    bible$('#bibleSearch');

  if (search) {
    search.value = '';
  }


  bibleShow(
    'bibleLanguages'
  );
}


/* =========================================================
   RENDER BOOKS
   ========================================================= */

function bibleRenderBooks() {

  const data =
    bibleState.data[
      bibleState.lang
    ];


  if (!data) {
    return;
  }


  const query =
    bibleState.search
      .trim()
      .toLowerCase();


  const box =
    bible$('#bibleBookList');


  if (!box) {
    return;
  }


  const books =
    data.books;


  const oldTestament =
    books.slice(
      0,
      39
    );


  const newTestament =
    books.slice(
      39
    );


  const groups = [
    [
      'Old Testament',
      oldTestament,
      0
    ],
    [
      'New Testament',
      newTestament,
      39
    ]
  ];


  box.innerHTML =
    groups.map(
      group => {

        const label =
          group[0];

        const list =
          group[1];

        const offset =
          group[2];


        const filtered =
          list
            .map(
              (book, index) => ({
                book,
                index:
                  index + offset
              })
            )
            .filter(
              item =>
                !query ||
                String(
                  item.book.name || ''
                )
                .toLowerCase()
                .includes(query)
            );


        if (
          filtered.length === 0
        ) {
          return '';
        }


        return `
          <div class="bible-testament">

            <h3>
              ${label}
            </h3>

            ${filtered.map(
              item => `
                <button
                  class="bible-book-row"
                  data-index="${item.index}"
                  type="button"
                >

                  <span
                    class="bible-book-icon"
                  >
                    📖
                  </span>

                  <span>

                    <b>
                      ${bibleEsc(
                        item.book.name
                      )}
                    </b>

                    <small>
                      ${
                        Array.isArray(
                          item.book.chapters
                        )
                          ? item.book.chapters.length
                          : 0
                      }
                      chapters
                    </small>

                  </span>

                  <span>
                    ›
                  </span>

                </button>
              `
            ).join('')}

          </div>
        `;
      }
    ).join('') ||
    '<div class="empty">No Bible books found.</div>';


  box
    .querySelectorAll(
      '.bible-book-row'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () =>
            bibleOpenBook(
              Number(
                button.dataset.index
              )
            )
        );
      }
    );
}


/* =========================================================
   OPEN BOOK
   ========================================================= */

function bibleOpenBook(
  index
) {

  const data =
    bibleState.data[
      bibleState.lang
    ];


  if (
    !data ||
    !data.books[index]
  ) {
    return;
  }


  const book =
    data.books[index];


  bibleState.bookIndex =
    index;

  bibleState.chapterIndex =
    0;


  const title =
    bible$('#bibleChaptersTitle');

  const subtitle =
    bible$('#bibleChaptersSub');


  if (title) {
    title.textContent =
      book.name;
  }


  if (subtitle) {

    subtitle.textContent =
      `${book.chapters.length} chapters`;
  }


  const box =
    bible$('#bibleChapterList');


  if (!box) {
    return;
  }


  box.innerHTML =
    book.chapters
      .map(
        (chapter, index) => `
          <button
            class="bible-chapter"
            data-index="${index}"
            type="button"
          >
            ${bibleEsc(
              chapter.chapter ??
              index + 1
            )}
          </button>
        `
      )
      .join('');


  bibleShow(
    'bibleChapters'
  );


  box
    .querySelectorAll(
      '.bible-chapter'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () =>
            bibleOpenChapter(
              Number(
                button.dataset.index
              )
            )
        );
      }
    );
}


/* =========================================================
   OPEN CHAPTER
   ========================================================= */

function bibleOpenChapter(
  index
) {

  const data =
    bibleState.data[
      bibleState.lang
    ];


  if (!data) {
    return;
  }


  const book =
    data.books[
      bibleState.bookIndex
    ];


  if (!book) {
    return;
  }


  const chapter =
    book.chapters[index];


  if (!chapter) {
    return;
  }


  bibleState.chapterIndex =
    index;


  const title =
    bible$('#bibleReaderTitle');


  if (title) {

    title.textContent =
      `${book.name} ${chapter.chapter}`;
  }


  const box =
    bible$('#bibleReaderBody');


  if (!box) {
    return;
  }


  box.innerHTML =
    (chapter.verses || [])
      .map(
        verse => {

          /*
           * Support heading objects used by
           * some Bible JSON structures.
           */
          if (
            verse &&
            verse.type === 'heading'
          ) {

            return `
              <div class="bible-heading">
                ${bibleEsc(
                  verse.text ||
                  verse.heading ||
                  ''
                )}
              </div>
            `;
          }


          let heading = '';


          if (
            verse &&
            verse.heading
          ) {

            heading = `
              <div class="bible-heading">
                ${bibleEsc(
                  verse.heading
                )}
              </div>
            `;
          }


          return `
            ${heading}

            <div class="bible-verse">

              <sup>
                ${bibleEsc(
                  verse.verse ??
                  verse.number ??
                  ''
                )}
              </sup>

              <span>
                ${bibleSafeText(
                  verse.text ||
                  ''
                )}
              </span>

            </div>
          `;
        }
      )
      .join('');


  const reader =
    bible$('#bibleReader');


  if (reader) {

    reader.classList.add(
      'open'
    );

    reader.setAttribute(
      'aria-hidden',
      'false'
    );

    reader.scrollTo(
      0,
      0
    );
  }
}


/* =========================================================
   CHAPTER NAVIGATION
   ========================================================= */

function bibleMove(
  delta
) {

  const data =
    bibleState.data[
      bibleState.lang
    ];


  if (!data) {
    return;
  }


  const book =
    data.books[
      bibleState.bookIndex
    ];


  if (!book) {
    return;
  }


  const nextChapter =
    bibleState.chapterIndex +
    delta;


  /*
   * Same book.
   */
  if (
    nextChapter >= 0 &&
    nextChapter <
      book.chapters.length
  ) {

    bibleOpenChapter(
      nextChapter
    );

    return;
  }


  /*
   * Previous book.
   */
  if (
    delta < 0 &&
    bibleState.bookIndex > 0
  ) {

    bibleState.bookIndex--;

    const previousBook =
      data.books[
        bibleState.bookIndex
      ];


    bibleOpenChapter(
      previousBook.chapters.length - 1
    );

    return;
  }


  /*
   * Next book.
   */
  if (
    delta > 0 &&
    bibleState.bookIndex <
      data.books.length - 1
  ) {

    bibleState.bookIndex++;

    bibleOpenChapter(
      0
    );
  }
}


/* =========================================================
   CLOSE READER
   ========================================================= */

function bibleCloseReader() {

  const reader =
    bible$('#bibleReader');


  if (!reader) {
    return;
  }


  reader.classList.remove(
    'open'
  );


  reader.setAttribute(
    'aria-hidden',
    'true'
  );
}


/* =========================================================
   SEARCH
   ========================================================= */

function bibleSearch() {

  const query =
    bibleState.search
      .trim()
      .toLowerCase();


  if (!query) {

    bibleRenderBooks();

    return;
  }


  const data =
    bibleState.data[
      bibleState.lang
    ];


  if (!data) {
    return;
  }


  const hits = [];


  data.books.forEach(
    (book, bookIndex) => {

      book.chapters.forEach(
        (chapter, chapterIndex) => {

          (chapter.verses || [])
            .forEach(
              verse => {

                if (
                  verse.type ===
                  'heading'
                ) {
                  return;
                }


                const text =
                  String(
                    verse.text || ''
                  );


                if (
                  text
                    .toLowerCase()
                    .includes(query)
                ) {

                  hits.push({
                    book,
                    bookIndex,
                    chapter,
                    chapterIndex,
                    verse
                  });
                }
              }
            );
        }
      );
    }
  );


  const bookHits =
    data.books
      .map(
        (book, index) => ({
          book,
          index
        })
      )
      .filter(
        item =>
          String(
            item.book.name || ''
          )
          .toLowerCase()
          .includes(query)
      );


  const box =
    bible$('#bibleBookList');


  if (!box) {
    return;
  }


  let html = '';


  if (bookHits.length) {

    html += `
      <div class="bible-testament">

        <h3>
          Books
        </h3>

        ${bookHits.map(
          item => `
            <button
              class="bible-book-row"
              data-index="${item.index}"
              type="button"
            >

              <span
                class="bible-book-icon"
              >
                📖
              </span>

              <span>

                <b>
                  ${bibleEsc(
                    item.book.name
                  )}
                </b>

                <small>
                  ${item.book.chapters.length}
                  chapters
                </small>

              </span>

              <span>
                ›
              </span>

            </button>
          `
        ).join('')}

      </div>
    `;
  }


  /*
   * Limit results shown to keep the UI responsive.
   */
  const limitedHits =
    hits.slice(
      0,
      100
    );


  if (limitedHits.length) {

    html += `
      <div class="bible-testament">

        <h3>
          Verse results
          (${hits.length})
        </h3>

        ${limitedHits.map(
          hit => `
            <button
              class="bible-search-result"
              data-bi="${hit.bookIndex}"
              data-ci="${hit.chapterIndex}"
              type="button"
            >

              <b>
                ${bibleEsc(
                  hit.book.name
                )}
                ${bibleEsc(
                  hit.chapter.chapter
                )}
                :
                ${bibleEsc(
                  hit.verse.verse ??
                  hit.verse.number ??
                  ''
                )}
              </b>

              <span>
                ${bibleSafeText(
                  hit.verse.text
                )}
              </span>

            </button>
          `
        ).join('')}

      </div>
    `;
  }


  box.innerHTML =
    html ||
    '<div class="empty">No Bible results found.</div>';


  box
    .querySelectorAll(
      '.bible-book-row'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () =>
            bibleOpenBook(
              Number(
                button.dataset.index
              )
            )
        );
      }
    );


  box
    .querySelectorAll(
      '.bible-search-result'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            bibleState.bookIndex =
              Number(
                button.dataset.bi
              );

            bibleOpenChapter(
              Number(
                button.dataset.ci
              )
            );
          }
        );
      }
    );
}


/* =========================================================
   LOAD A LANGUAGE
   ========================================================= */

async function bibleSelectLanguage(
  lang
) {

  const button =
    lang === 'en'
      ? bible$('#bibleEnglish')
      : bible$('#bibleLuganda');


  if (button) {
    button.disabled = true;
  }


  bibleSetStatus(
    `Loading ${BIBLE_NAMES[lang]}...`
  );


  try {

    await loadBibleData(
      lang
    );


    bibleLanguage(
      lang
    );


    console.log(
      `[Bible] ${lang} ready.`
    );


  } catch (error) {

    console.error(
      `[Bible] ${lang} failed:`,
      error
    );


    const offline =
      !navigator.onLine;


    alert(
      `${BIBLE_NAMES[lang]} could not be loaded.\n\n` +

      (
        offline
          ? 'You are offline and this Bible has not yet been downloaded to this device.'
          : error.message
      ) +

      '\n\nConnect to the internet once, open this Bible, and it will then be available offline.'
    );


  } finally {

    if (button) {
      button.disabled = false;
    }

    bibleSetStatus('');
  }
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

(function initBible() {


  /*
   * Open Bible from home screen.
   */
  const card =
    bible$(
      '.home-card[data-screen="bible"]'
    );


  if (card) {

    card.addEventListener(
      'click',
      () => {

        bibleShow(
          'bibleLanguages'
        );
      }
    );
  }


  /*
   * Main back button.
   */
  const back =
    bible$('#bibleBack');


  if (back) {

    back.addEventListener(
      'click',
      () => {

        if (
          typeof showScreen ===
          'function'
        ) {

          showScreen(
            'home'
          );
        }

        bibleHome();
      }
    );
  }


  /*
   * English.
   */
  const english =
    bible$('#bibleEnglish');


  if (english) {

    english.addEventListener(
      'click',
      () =>
        bibleSelectLanguage(
          'en'
        )
    );
  }


  /*
   * Luganda.
   */
  const luganda =
    bible$('#bibleLuganda');


  if (luganda) {

    luganda.addEventListener(
      'click',
      () =>
        bibleSelectLanguage(
          'lg'
        )
    );
  }


  /*
   * Books back.
   */
  const booksBack =
    bible$('#bibleBooksBack');


  if (booksBack) {

    booksBack.addEventListener(
      'click',
      bibleHome
    );
  }


  /*
   * Chapters back.
   */
  const chaptersBack =
    bible$('#bibleChaptersBack');


  if (chaptersBack) {

    chaptersBack.addEventListener(
      'click',
      () => {

        bibleState.mode =
          'books';

        bibleShow(
          'bibleBooks'
        );
      }
    );
  }


  /*
   * Search.
   */
  const search =
    bible$('#bibleSearch');


  if (search) {

    search.addEventListener(
      'input',
      event => {

        bibleState.search =
          event.target.value;

        bibleSearch();
      }
    );
  }


  /*
   * Close reader.
   */
  const close =
    bible$('#closeBibleReader');


  if (close) {

    close.addEventListener(
      'click',
      bibleCloseReader
    );
  }


  /*
   * Previous chapter.
   */
  const previous =
    bible$('#prevBibleChapter');


  if (previous) {

    previous.addEventListener(
      'click',
      () =>
        bibleMove(-1)
    );
  }


  /*
   * Next chapter.
   */
  const next =
    bible$('#nextBibleChapter');


  if (next) {

    next.addEventListener(
      'click',
      () =>
        bibleMove(1)
    );
  }


  /*
   * DO NOT preload the Bibles.
   *
   * This is intentional.
   *
   * They will be loaded only when the user
   * actually chooses English or Luganda.
   */

  console.log(
    '[Bible] Offline-first Bible system ready.'
  );

})();
