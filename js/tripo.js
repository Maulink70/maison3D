// Vrai modèle 3D d'après une photo, par Tripo (étape 4, choix de Mauro du 10 octobre 2026 : une photo collée sur un
// volume n'est juste que de face). La photo part au workflow n8n « Maison3D Tripo » (clé Tripo dans n8n, jamais dans la
// page), qui crée la tâche image-to-model chez Tripo ; le site suit la progression toutes les 4 s (8 min au plus) et reçoit
// le modèle GLB, ouvert ensuite dans la fenêtre d'import 3D (dimensions, allègement, envoi). Chaque modèle consomme des
// crédits Tripo : le panneau photo demande confirmation avant, en montrant le solde.
import {connecte} from './api.js';

const TRIPO='https://n8n.srv1123557.hstgr.cloud/webhook/maison3d-tripo';
const jeton=()=>{ try{ return JSON.parse(localStorage.getItem('maison3d-compte')||'null')?.jeton||''; }catch{ return ''; } };
const dataURL=b=>new Promise((ok,ko)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result)); r.onerror=ko; r.readAsDataURL(b); });
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const envoyer=corps=>fetch(TRIPO,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({...corps,jeton:jeton()}),cache:'no-store'});
async function poster(corps){
  try{ const r=await envoyer(corps); if(r.status===404) return {ok:false,absent:true}; return await r.json(); }
  catch{ return {ok:false,horsLigne:true}; }
}
const message=r=>r.absent?'Tripo n’est pas encore branché (clé Tripo à enregistrer dans n8n).':r.horsLigne?'Pas de connexion au serveur : réessayez quand le réseau revient.':(r.erreur||'Tripo n’a pas répondu.');

// crédits restants chez Tripo (affichés dans la confirmation)
export async function soldeTripo(){
  if(!connecte()) return {erreur:'Connectez-vous pour utiliser Tripo.'};
  const r=await poster({action:'solde'}); return r.ok?{solde:r.solde}:{erreur:message(r)};
}
// photo (blob png ou jpeg) → {blob: modèle GLB, credits} ou {erreur} ; progres(pourcentage, statut) pendant l'attente
export async function creer3D(blob,progres=()=>{}){
  if(!connecte()) return {erreur:'Connectez-vous pour utiliser Tripo.'};
  const d=await poster({action:'demarrer',image:await dataURL(blob)});
  if(!d.ok||!d.tache) return {erreur:message(d)};
  progres(0,'queued');
  const fin=Date.now()+480000;
  while(Date.now()<fin){
    await pause(4000);
    let r; try{ r=await envoyer({action:'suivre',tache:d.tache}); }catch{ continue; }   // réseau coupé un instant : on réessaie
    if(r.ok&&!/json/i.test(r.headers.get('content-type')||'')) return {blob:await r.blob(),credits:+r.headers.get('x-tripo-credits')||null};
    let s; try{ s=await r.json(); }catch{ return {erreur:'Réponse de Tripo illisible.'}; }
    if(!s.ok) return {erreur:message(s)};
    if(s.etat==='echec') return {erreur:'Tripo n’a pas réussi'+(s.raison?' : '+s.raison:'')+'.'};
    progres(+s.progres||0,s.statut||'');
  }
  return {erreur:'Tripo met trop de temps : réessayez plus tard.'};
}
