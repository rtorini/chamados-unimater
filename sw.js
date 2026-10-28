// Aumente o número da versão sempre que atualizar o app, para forçar a troca do cache.
var VERSAO = 'chamados-v5';
var ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(ARQUIVOS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(nomes.filter(function (n) { return n !== VERSAO; }).map(function (n) { return caches.delete(n); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  // Só mexe em arquivos do próprio app; consulta ao Apps Script e Forms passam direto.
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Rede primeiro (pega a versão nova), cache como reserva se estiver sem internet.
  e.respondWith(
    fetch(req).then(function (resp) {
      var copia = resp.clone();
      caches.open(VERSAO).then(function (c) { c.put(req, copia); });
      return resp;
    }).catch(function () {
      return caches.match(req).then(function (r) { return r || caches.match('./index.html'); });
    })
  );
});

// ---------- Notificações push da equipe ----------
// O servidor envia só dados; quem monta e mostra a notificação é este arquivo.
self.addEventListener('push', function (event) {
  var dados = {};
  try {
    var p = event.data ? event.data.json() : {};
    // Aceita os formatos possíveis do Firebase: {data:{...}}, {notification:{...}} ou campos soltos
    dados = (p && p.data) ? p.data : ((p && p.notification) ? p.notification : (p || {}));
  } catch (e) {
    dados = { titulo: 'Chamados de manutenção', corpo: event.data ? event.data.text() : '' };
  }

  var titulo = dados.titulo || dados.title || 'Chamados de manutenção';
  var opcoes = {
    body: dados.corpo || dados.body || '',
    icon: 'icons/icon-192.png',
    tag: dados.tag || 'chamado',
    renotify: true,
    data: { url: dados.url || './?equipe=1' }
  };

  event.waitUntil(Promise.all([
    self.registration.showNotification(titulo, opcoes),
    // Se o app estiver aberto, avisa para atualizar a lista na hora
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (janelas) {
      janelas.forEach(function (j) { j.postMessage({ tipo: 'push', dados: dados }); });
    })
  ]));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var alvo = (event.notification.data && event.notification.data.url) || './?equipe=1';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (janelas) {
      for (var i = 0; i < janelas.length; i++) {
        if ('focus' in janelas[i]) {
          janelas[i].postMessage({ tipo: 'abrir-equipe' });
          return janelas[i].focus();
        }
      }
      return self.clients.openWindow(alvo);
    })
  );
});
