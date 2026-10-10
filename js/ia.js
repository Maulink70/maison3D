// Nettoyage d'une photo par l'IA (étape 4, livraison 2), sur demande seulement (Mauro) : la photo part au workflow n8n
// « Maison3D IA », qui la confie à kie.ai (Nano Banana Pro, clé kie.ai dans n8n, jamais dans la page) avec la consigne
// de ne garder que le meuble, entier, sur fond blanc uni. Deux temps : demarrer (renvoie la tâche) puis suivre (toutes
// les 4 s, jusqu'à 3 min) ; l'image nettoyée revient en data URL. Chaque appel consomme des crédits : le panneau photo
// demande confirmation avant.
import {connecte} from './api.js';

const IA='https://n8n.srv1123557.hstgr.cloud/webhook/maison3d-ia';
const jeton=()=>{ try{ return JSON.parse(localStorage.getItem('maison3d-compte')||'null')?.jeton||''; }catch{ return ''; } };
const dataURL=b=>new Promise((ok,ko)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result)); r.onerror=ko; r.readAsDataURL(b); });
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function poster(corps){
  try{ const r=await fetch(IA,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({...corps,jeton:jeton()}),cache:'no-store'});
    if(r.status===404) return {ok:false,absent:true};
    return await r.json(); }
  catch{ return {ok:false,horsLigne:true}; }
}
const message=r=>r.absent?'Le nettoyage par l’IA n’est pas encore branché (clé kie.ai à enregistrer dans n8n).':r.horsLigne?'Pas de connexion au serveur : réessayez quand le réseau revient.':(r.erreur||'Le nettoyage a échoué.');

export async function nettoyerPhoto(blob,quoi=''){
  if(!connecte()) return {erreur:'Connectez-vous pour utiliser l’IA.'};
  const d=await poster({action:'demarrer',image:await dataURL(blob),quoi:String(quoi||'').slice(0,60)});
  if(!d.ok||!d.tache) return {erreur:message(d)};
  const fin=Date.now()+180000;
  while(Date.now()<fin){
    await pause(4000);
    const s=await poster({action:'suivre',tache:d.tache});
    if(!s.ok) return {erreur:message(s)};
    if(s.etat==='fini'&&s.image){ try{ return {blob:await (await fetch(s.image)).blob()}; }catch{ return {erreur:'Image nettoyée illisible.'}; } }
    if(s.etat==='echec') return {erreur:'L’IA n’a pas réussi'+(s.raison?' : '+s.raison:'')+'.'};
  }
  return {erreur:'L’IA met trop de temps : réessayez un peu plus tard.'};
}
