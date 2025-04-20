// Cache name and version
const CACHE_NAME = 'monster-survivors-cache-v2';
const STATIC_CACHE = 'monster-survivors-static-v2';
const DYNAMIC_CACHE = 'monster-survivors-dynamic-v2';
const GAME_ASSETS_CACHE = 'monster-survivors-game-assets-v2';

// Static resources to pre-cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/robots.txt',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'
];

// Game related resources
const GAME_ASSETS = [
  // Add actual game resources here when available
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon.png'
];

// Cache size limit
const DYNAMIC_CACHE_LIMIT = 50;

// Install Service Worker and cache required resources
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker...');
  event.waitUntil(
    Promise.all([
      // Cache static resources
      caches.open(STATIC_CACHE)
        .then(cache => {
          console.log('[Service Worker] Pre-caching static assets');
          return cache.addAll(STATIC_ASSETS);
        }),
      
      // Cache game resources
      caches.open(GAME_ASSETS_CACHE)
        .then(cache => {
          console.log('[Service Worker] Pre-caching game assets');
          return cache.addAll(GAME_ASSETS);
        })
    ])
    .then(() => {
      console.log('[Service Worker] Successfully pre-cached resources');
      return self.skipWaiting(); // Activate new Service Worker immediately
    })
  );
});

// Clean up old cache versions
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker...');
  
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, GAME_ASSETS_CACHE];
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (!currentCaches.includes(cacheName)) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Successfully cleaned up old caches');
        return self.clients.claim(); // Control uncontrolled clients
      })
  );
});

// Limit the size of dynamic cache
const trimCache = (cacheName, maxItems) => {
  caches.open(cacheName)
    .then(cache => {
      return cache.keys()
        .then(keys => {
          if (keys.length > maxItems) {
            cache.delete(keys[0]) // Delete the oldest item
              .then(() => trimCache(cacheName, maxItems)); // Recursively check until cache size is appropriate
          }
        });
    });
};

// Determine if the request is for a static resource
const isStaticAsset = (url) => {
  const staticUrlPatterns = [
    '/index.html',
    '/manifest.json',
    '/robots.txt',
    'cdn.tailwindcss.com',
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    '/icons/'
  ];
  
  return staticUrlPatterns.some(pattern => url.includes(pattern));
};

// Determine if the request is for a game resource
const isGameAsset = (url) => {
  return url.includes('/game/') || url.includes('/assets/');
};

// Determine the cache strategy for the request
const getCacheStrategy = (request) => {
  const url = request.url;
  
  // API requests always go to the network
  if (url.includes('/api/')) {
    return 'network-only';
  }
  
  // Static resources are prioritized
  if (isStaticAsset(url)) {
    return 'cache-first';
  }
  
  // Game resources are prioritized
  if (isGameAsset(url)) {
    return 'cache-first';
  }
  
  // Other resources use network-first strategy
  return 'network-first';
};

// Handle network requests
self.addEventListener('fetch', (event) => {
  // Skip requests that don't support caching
  if (event.request.method !== 'GET') {
    return;
  }
  
  const strategy = getCacheStrategy(event.request);
  
  if (strategy === 'cache-first') {
    // Cache first, suitable for static resources
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request)
            .then(response => {
              if (!response || response.status !== 200) {
                return response;
              }
              
              const clonedResponse = response.clone();
              const cacheName = isGameAsset(event.request.url) ? GAME_ASSETS_CACHE : STATIC_CACHE;
              
              caches.open(cacheName)
                .then(cache => cache.put(event.request, clonedResponse));
                
              return response;
            });
        })
    );
  } else if (strategy === 'network-first') {
    // Network first, suitable for content that changes frequently
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200) {
            return caches.match(event.request);
          }
          
          const clonedResponse = response.clone();
          
          caches.open(DYNAMIC_CACHE)
            .then(cache => {
              cache.put(event.request, clonedResponse);
              trimCache(DYNAMIC_CACHE, DYNAMIC_CACHE_LIMIT);
            });
            
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  } else {
    // Network direct, no caching result
    event.respondWith(fetch(event.request));
  }
});

// Background sync functionality, used for saving user operations when offline
self.addEventListener('sync', event => {
  console.log('[Service Worker] Background Syncing', event);
  
  if (event.tag === 'sync-game-progress') {
    event.waitUntil(
      // Read and send game progress data stored in IndexedDB
      // Example code, actual implementation needs to be modified according to the specific game progress storage method
      // syncGameProgress()
    );
  }
});

// Handle push notifications
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Notification received', event);
  
  let data = { title: 'New Message', content: 'Something new happened!', openUrl: '/' };
  
  if (event.data) {
    data = JSON.parse(event.data.text());
  }
  
  const options = {
    body: data.content,
    icon: 'icons/icon-96x96.png',
    badge: 'icons/icon-72x72.png',
    data: {
      url: data.openUrl
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  const action = event.action;
  const url = notification.data.url;
  
  notification.close();
  
  if (action === 'confirm') {
    // User clicked the confirm button
    console.log('[Service Worker] Notification confirmed');
  } else {
    // User clicked the notification itself
    event.waitUntil(
      clients.matchAll()
        .then(allClients => {
          let chatClient = allClients.find(client => {
            return client.visibilityState === 'visible';
          });
          
          if (chatClient) {
            chatClient.navigate(url);
            chatClient.focus();
          } else {
            clients.openWindow(url);
          }
        })
    );
  }
}); 