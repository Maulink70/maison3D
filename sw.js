// Application installable (étape 2) : service worker de Maison3D.
// - Modèle 3D (modele/), polices du PDF (polices/), icônes et bibliothèques à version fixe (jsDelivr, Google Fonts) :
//   gardés dans le cache après le premier chargement (ouverture bien plus rapide ensuite, sur la tablette surtout).
//   Si le modèle change un jour, changer MODELE ci-dessous (le cache est alors refait).
// - Page, code et styles : toujours pris sur le réseau (dernière version publiée), le cache ne sert que hors connexion.
// Pas de mode hors ligne complet (choix de Mauro) : sans réseau, la page déjà vue s'ouvre avec ce qui est en cache.
const MODELE='maison3d-modele-1', CODE='maison3d-code-1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  for(const k of await caches.keys()) if(k!==MODELE&&k!==CODE&&k!=='maison3d-fichiers') await caches.delete(k);   // fichiers des objets ajoutés (fichiers.js) : gardés
  await self.clients.claim();
})()));
const fixe=u=>(u.origin===self.location.origin&&/\/(modele|polices|icones)\//.test(u.pathname))||u.hostname==='cdn.jsdelivr.net'||u.hostname==='fonts.gstatic.com';
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET'||r.headers.has('range')) return;
  const u=new URL(r.url);
  if(fixe(u)){ e.respondWith(caches.open(MODELE).then(async c=>{
    const deja=await c.match(r); if(deja) return deja;
    const rep=await fetch(r); if(rep.ok&&(rep.type==='basic'||rep.type==='cors')) c.put(r,rep.clone()); return rep; })); return; }
  if(u.origin===self.location.origin) e.respondWith(fetch(r).then(rep=>{
    if(rep.ok&&rep.type==='basic'){ const copie=rep.clone(); caches.open(CODE).then(c=>c.put(r,copie)); } return rep;
  }).catch(()=>caches.match(r).then(c=>c||Response.error())));
});
