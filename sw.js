/* =========================================================
   MULAGO ETERNAL LIFE SONGBOOK
   Service Worker
   ========================================================= */

/*
 * IMPORTANT:
 * Change this version whenever cached files change.
 *
 * This forces browsers that already installed the old
 * service worker to remove the old cache.
 */
const CACHE_NAME = 'melgc-songbook-v11';


/* =========================================================
   FILES TO CACHE
   ========================================================= */

const ASSETS = [

  './',
  './index.html',

  /* CSS */
  './styles.css',
  './bible.css',

  /* JavaScript */
  './app.js',
  './bible.js',

  /* PWA */
  './manifest.webmanifest',

  /* Hymns */
  './hymns-en.json',
  './hymns-lg.json',

  /* Bible */
  './bible-en.json',
  './bible-lg.json',

  /* Images */
  './assets/church-logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];


/* =========================================================
   INSTALL
   ========================================================= */

self.addEventListener(
  'install',
  event => {

    event.waitUntil(

      caches
        .open(CACHE_NAME)
        .then(cache => {

          console.log(
            '[SW] Installing cache:',
            CACHE_NAME
          );

          /*
           * Cache files individually so that one missing
           * optional asset does not prevent everything else
           * from being cached.
           */
          return Promise.all(
            ASSETS.map(
              asset =>
                cache
                  .add(asset)
                  .catch(error => {

                    console.warn(
                      '[SW] Could not cache:',
                      asset,
                      error
                    );

                  })
            )
          );
        })
        .then(() => {

          console.log(
            '[SW] Installation complete.'
          );

          return self.skipWaiting();
        })
    );
  }
);


/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener(
  'activate',
  event => {

    event.waitUntil(

      caches
        .keys()
        .then(keys => {

          return Promise.all(

            keys
              .filter(
                key => key !== CACHE_NAME
              )
              .map(
                key => {

                  console.log(
                    '[SW] Removing old cache:',
                    key
                  );

                  return caches.delete(key);
                }
              )
          );
        })
        .then(() => {

          console.log(
            '[SW] Activated:',
            CACHE_NAME
          );

          return self.clients.claim();
        })
    );
  }
);


/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener(
  'fetch',
  event => {

    const request =
      event.request;

    /*
     * Only handle GET requests.
     */
    if (request.method !== 'GET') {
      return;
    }


    event.respondWith(

      caches
        .match(request)
        .then(cachedResponse => {

          /*
           * If the file is already cached, return it
           * immediately. This gives the app offline support.
           */
          if (cachedResponse) {

            return cachedResponse;
          }


          /*
           * Otherwise request it from the network.
           */
          return fetch(request)
            .then(networkResponse => {

              /*
               * Only cache successful normal responses.
               */
              if (
                networkResponse &&
                networkResponse.status === 200 &&
                networkResponse.type !== 'opaque'
              ) {

                const responseClone =
                  networkResponse.clone();

                caches
                  .open(CACHE_NAME)
                  .then(cache => {

                    cache.put(
                      request,
                      responseClone
                    );
                  });
              }

              return networkResponse;
            })
            .catch(() => {

              /*
               * If offline and nothing is cached,
               * return the main page for navigation requests.
               */
              if (
                request.mode === 'navigate'
              ) {

                return caches.match(
                  './index.html'
                );
              }

              return new Response(
                'Offline',
                {
                  status: 503,
                  statusText: 'Offline'
                }
              );
            });
        })
    );
  }
);
