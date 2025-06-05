// service-worker.js - TreeScript Editor オフライン対応版

const CACHE_NAME = 'treescript-editor-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// インストールイベント - 初回アクセス時にリソースをキャッシュ
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: All files cached');
        // すぐにアクティブ化
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('Service Worker: Cache failed', err);
      })
  );
});

// アクティベートイベント - 古いキャッシュの削除
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Claiming clients');
        // すべてのクライアントを即座に制御下に置く
        return self.clients.claim();
      })
  );
});

// フェッチイベント - リクエストの処理
self.addEventListener('fetch', event => {
  // Chrome拡張機能関連のリクエストは無視
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // キャッシュにあればそれを返す
        if (response) {
          console.log('Service Worker: Fetching from cache:', event.request.url);
          return response;
        }

        // キャッシュになければネットワークから取得を試みる
        console.log('Service Worker: Fetching from network:', event.request.url);
        
        return fetch(event.request)
          .then(response => {
            // 有効なレスポンスでない場合はそのまま返す
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // レスポンスをクローンしてキャッシュに保存
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // 同一オリジンのリソースのみキャッシュ
                if (event.request.url.startsWith(self.location.origin)) {
                  cache.put(event.request, responseToCache);
                }
              });

            return response;
          })
          .catch(err => {
            console.error('Service Worker: Fetch failed:', err);
            // オフライン時はindex.htmlを返す（SPAの場合）
            return caches.match('./index.html');
          });
      })
      .catch(err => {
        console.error('Service Worker: Match failed:', err);
      })
  );
});

// バックグラウンド同期（将来の拡張用）
self.addEventListener('sync', event => {
  console.log('Service Worker: Sync event', event);
  if (event.tag === 'sync-documents') {
    event.waitUntil(syncDocuments());
  }
});

// プッシュ通知（将来の拡張用）
self.addEventListener('push', event => {
  console.log('Service Worker: Push event', event);
  
  const options = {
    body: event.data ? event.data.text() : '新しい更新があります',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification('TreeScript Editor', options)
  );
});

// 通知クリック処理
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification click', event);
  
  event.notification.close();
  event.waitUntil(
    clients.openWindow('./')
  );
});

// キャッシュのバージョン管理とアップデート通知
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// ドキュメント同期関数（将来の実装用）
async function syncDocuments() {
  console.log('Service Worker: Syncing documents...');
  // ここにクラウド同期のロジックを実装
  return Promise.resolve();
}

// エラーハンドリング
self.addEventListener('error', event => {
  console.error('Service Worker Error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('Service Worker Unhandled Rejection:', event.reason);
});

// Service Workerの状態をログ出力
console.log('Service Worker: Script loaded');