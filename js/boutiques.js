// Boutiques en ligne (étape 5, livraison 3, choix de Mauro : achats en Suisse) : raccourcis qui ouvrent la boutique sur la
// recherche tapée (nouvel onglet sur PC, appli ou navigateur sur la tablette), et lecture de la page d'un produit par n8n
// (workflow « Maison3D Boutique » : photo principale, nom, dimensions si la page les donne). Une page ne peut pas lire
// une autre boutique elle-même (sécurité des navigateurs). Essais du 10 octobre 2026 (lecture par n8n) : IKEA photo et
// dimensions, Micasa et Anthamatten photo ; Galaxus et Maisons du Monde refusent la lecture par un serveur (copier
// l'image) ; Pfister et Conforama : pages produits non vérifiées, et pas d'adresse de recherche connue (page d'accueil).
const BOUTIQUE='https://n8n.srv1123557.hstgr.cloud/webhook/maison3d-boutique';
const jeton=()=>{ try{ return JSON.parse(localStorage.getItem('maison3d-compte')||'null')?.jeton||''; }catch{ return ''; } };
export const BOUTIQUES=[
  {id:'ikea',nom:'IKEA',recherche:'https://www.ikea.com/ch/fr/search/?q=',lien:'photo et dimensions'},
  {id:'micasa',nom:'Micasa',recherche:'https://www.micasa.ch/fr/search?q=',lien:'photo'},
  {id:'pfister',nom:'Pfister',accueil:'https://www.pfister.ch/fr',lien:'à essayer'},
  {id:'conforama',nom:'Conforama',accueil:'https://www.conforama.ch/fr/',lien:'à essayer'},
  {id:'mdm',nom:'Maisons du Monde',accueil:'https://www.maisonsdumonde.com/CH/fr',lien:'copier l’image'},
  {id:'galaxus',nom:'Galaxus',recherche:'https://www.galaxus.ch/fr/search?q=',lien:'copier l’image'},
  {id:'anthamatten',nom:'Anthamatten (Conthey)',recherche:'https://www.anthamatten.ch/search?q=',lien:'photo'},
];
export const lienRecherche=(b,q)=>b.recherche&&q?b.recherche+encodeURIComponent(q):(b.accueil||b.recherche.replace(/[?#].*$/,''));
// premier lien http(s) d'un texte (partage depuis l'appli d'une boutique : le lien est souvent dans le texte)
export function extraireLien(t){ const m=String(t||'').match(/https?:\/\/[^\s<>"']+/i); return m?m[0].replace(/[.,;)\]]+$/,''):null; }
// lit la page d'un produit : {ok, nom, dims:{L,P,H} (cm), image (data URL), site} ou {ok:false, erreur}
export async function lireProduit(url){
  let r; try{ r=await fetch(BOUTIQUE,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action:'lire',url,jeton:jeton()}),cache:'no-store'}); }
  catch{ return {ok:false,erreur:'Pas de connexion au serveur'}; }
  if(r.status===404) return {ok:false,erreur:'La lecture des boutiques n’est pas encore branchée.'};
  return r.json().catch(()=>({ok:false,erreur:'Réponse illisible'}));
}
