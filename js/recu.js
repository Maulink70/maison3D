// Produit envoyé depuis une boutique (étape 5, livraison 3 ; liste « Produits » depuis le 11 octobre 2026) : sur la
// tablette, l'application installée apparaît dans « Partager » d'Android (manifeste, share_target) ; sur PC, le favori
// « Envoyer à Maison3D » (produits.js) ouvre Maison3D sur la même adresse. Le lien du produit arrive dans l'adresse
// (?lien=…&texte=…&titre=… : beaucoup d'applis mettent le lien dans le texte ; img=… : la photo vue par le favori dans la
// page). Une fois la maquette chargée, le produit est ajouté à la liste « Produits » (n8n lit la page : photo, nom,
// dimensions), qui s'ouvre dessus : « Essayer en photo », « Mettre en 3D ».
import {extraireLien} from './boutiques.js';
import {ajouterRecu} from './produits.js';

let recu=null;
export function initRecu(){
  const q=new URLSearchParams(location.search); if(!['lien','texte','titre'].some(k=>q.has(k))) return;
  const img=q.get('img')||'';
  recu={lien:extraireLien(q.get('lien'))||extraireLien(q.get('texte'))||extraireLien(q.get('titre')),titre:(q.get('titre')||'').slice(0,150),img:/^https?:\/\//.test(img)?img.slice(0,2000):''};
  try{ history.replaceState(null,'',location.pathname); }catch{}   // l'adresse redevient propre (pas de nouvel ajout au rechargement)
}
export async function traiterRecu(){
  if(!recu) return; const r=recu; recu=null;
  await ajouterRecu(r);
}
