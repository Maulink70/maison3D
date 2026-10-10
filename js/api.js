// Comptes et données partagées (étape 3) : le site ne parle qu'à n8n (workflow « Maison3D API »), qui vérifie la
// personne puis lit et écrit dans la base Airtable « Maison3D ». Aucune clé dans la page : seulement le jeton signé
// rendu par n8n à la connexion (valable un an, gardé sur l'appareil, clé maison3d-compte).
// Requêtes en text/plain : pas de requête préalable du navigateur (CORS), n8n lit le texte comme du JSON.
export const API='https://n8n.srv1123557.hstgr.cloud/webhook/maison3d';
const CLE='maison3d-compte';
let compte=null;
try{ compte=JSON.parse(localStorage.getItem(CLE)||'null'); }catch{ compte=null; }
if(!compte||!compte.jeton||!compte.nom) compte=null;

export const connecte=()=>!!compte;
export const moi=()=>compte?compte.nom:null;
export function ouvrirSession(jeton,nom){ compte={jeton,nom}; try{ localStorage.setItem(CLE,JSON.stringify(compte)); }catch{} dispatchEvent(new CustomEvent('compte')); }
export function fermerSession(){ compte=null; try{ localStorage.removeItem(CLE); }catch{} dispatchEvent(new CustomEvent('compte')); }

// Appel à n8n : renvoie la réponse ({ok:true,…} ou {ok:false,erreur,code}) ; une coupure réseau donne
// {ok:false,horsLigne:true}. Un jeton refusé (401 sur une action réservée) ferme la session.
export async function appel(action,donnees={}){
  const corps={action,...donnees}; if(compte) corps.jeton=compte.jeton;
  let r;
  try{
    const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(),30000);
    const rep=await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(corps),signal:ctl.signal,cache:'no-store'});
    clearTimeout(t);
    r=await rep.json();
  }catch(e){ return {ok:false,horsLigne:true,erreur:'Pas de connexion au serveur'}; }
  if(!r||typeof r!=='object') return {ok:false,erreur:'Réponse illisible du serveur'};
  if(!r.ok&&r.code===401&&compte&&action!=='connexion'&&action!=='motdepasse'){ fermerSession(); r.sessionFermee=true; }
  return r;
}
