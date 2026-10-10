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
// noms donnés aux modèles lancés depuis cet appareil (la liste des tâches de Tripo n'a que la date et les crédits)
const CLE_NOMS='maison3d-tripo-noms';
const noms=()=>{ try{ return JSON.parse(localStorage.getItem(CLE_NOMS)||'{}')||{}; }catch{ return {}; } };
function noter(tache,nom){
  const n=noms(); n[tache]={n:String(nom||'').slice(0,60),t:Date.now()};
  const garde=Object.entries(n).sort((a,b)=>b[1].t-a[1].t).slice(0,40);
  try{ localStorage.setItem(CLE_NOMS,JSON.stringify(Object.fromEntries(garde))); }catch{}
}
// photo (blob png ou jpeg) → {blob: modèle GLB, credits} ou {erreur} ; progres(pourcentage, statut) pendant l'attente
export async function creer3D(blob,progres=()=>{},nom=''){
  if(!connecte()) return {erreur:'Connectez-vous pour utiliser Tripo.'};
  const d=await poster({action:'demarrer',image:await dataURL(blob)});
  if(!d.ok||!d.tache) return {erreur:message(d)};
  noter(d.tache,nom);
  progres(0,'queued');
  return attendre(d.tache,progres,false);
}
// modèles créés ces derniers jours chez Tripo (liste de Tripo : date, crédits, numéro de tâche), du plus récent au plus ancien :
// un modèle perdu (page fermée, tablette en veille pendant la création, fenêtre refermée sans « Ajouter ») se rouvre ici
export async function recentsTripo(){
  if(!connecte()) return {erreur:'Connectez-vous pour utiliser Tripo.'};
  const r=await poster({action:'recents'}); if(!r.ok) return {erreur:message(r)};
  const n=noms(), quand=q=>{ const d=typeof q==='number'?new Date(q<1e12?q*1000:q):new Date(q||0); return isNaN(d)?null:d; };
  return {taches:(r.taches||[]).map(t=>({...t,quand:quand(t.quand),nom:n[t.id]?.n||''})).sort((a,b)=>(b.quand||0)-(a.quand||0))};
}
// reprendre une tâche Tripo par son numéro → même résultat que creer3D
export async function reprendre3D(tache,progres=()=>{}){
  if(!connecte()) return {erreur:'Connectez-vous pour utiliser Tripo.'};
  return attendre(tache,progres,true);
}
// suivi d'une tâche (toutes les 4 s, 8 min au plus) ; vite : première question tout de suite (tâche reprise)
async function attendre(tache,progres,vite){
  const fin=Date.now()+480000;
  for(let premier=true;Date.now()<fin;premier=false){
    if(!(vite&&premier)) await pause(4000);
    let r; try{ r=await envoyer({action:'suivre',tache}); }catch{ continue; }   // réseau coupé un instant : on réessaie
    if(r.ok&&!/json/i.test(r.headers.get('content-type')||'')) return {blob:await r.blob(),credits:+r.headers.get('x-tripo-credits')||null};
    let s; try{ s=await r.json(); }catch{ return {erreur:'Réponse de Tripo illisible.'}; }
    if(!s.ok) return {erreur:message(s)};
    if(s.etat==='echec') return {erreur:'Tripo n’a pas réussi'+(s.raison?' : '+s.raison:'')+'.'};
    progres(+s.progres||0,s.statut||'');
  }
  return {erreur:'Tripo met trop de temps : réessayez plus tard.'};
}
