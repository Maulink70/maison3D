// Synchronisation PC ↔ tablette (étape 3) : la disposition de chaque variante, les vues enregistrées et les mesures
// sont gardées dans Airtable (par n8n, api.js). À l'ouverture, la variante affichée est chargée du serveur (sans compte :
// « Actuel », en lecture seule). Chaque modification (évènement « disposition » de sauvegarde.js) est envoyée 2 s après
// la dernière, avec les lignes du journal (historique.js) : seuls les éléments qui diffèrent de la version du serveur
// partent, n8n les fusionne élément par élément (deux personnes qui bougent des meubles différents ne s'écrasent pas).
// Hors connexion, les changements attendent sur l'appareil (clé maison3d-attente) et partent au retour du réseau ; la
// dernière disposition reste aussi dans le navigateur (diolly3d-v1), copie de secours. Les changements faits ailleurs
// sont repris au retour sur la page (focus) et toutes les 2 min tant qu'on s'en sert (version de la variante).
import {app, $} from './app.js';
import {appel, connecte, moi} from './api.js';
import {lireDisposition, appliquerDisposition} from './sauvegarde.js';
import {leJournal, changerJournal} from './historique.js';
import {lesVues, remplacerVues} from './cameras.js';
import {lesMesures, remplacerMesures} from './mesure.js';
import {etatEnregistrement} from './compte.js';
import {egaux, normaliser} from './etats.js';

const CACHE='maison3d-cache', ATTENTE='maison3d-attente', DELAI=2000, FUSION=1500, VEILLE=120000;
let variantes=[], courante=null, base={}, version=0, pret=false;
let attente={variante:null,changements:{},ops:[],envoye:{}};   // envoye : t de la dernière ligne du journal envoyée, par variante
let envoi=null, minuterie=0, relance=0, actif=Date.now(), modifAvant=false, connus={vues:[],mesures:[]};
const lire=(k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)||'null')??d; }catch{ return d; } };
const ecrire=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch{} };
const garderAttente=()=>ecrire(ATTENTE,attente);
const garderCache=()=>ecrire(CACHE,{variantes,courante,version,connus});
// éléments qui diffèrent entre deux dispositions (null = revenu à son état d'origine, ou objet ajouté retiré) ;
// état complet (etats.js) : position, rotation, masqué, couleur, taille, matières, objet ajouté, sol et murs
function difference(de,vers){
  const ch={};
  for(const n of new Set([...Object.keys(de),...Object.keys(vers)])){ const a=de[n], b=vers[n];
    if(!b){ if(a) ch[n]=null; } else if(!a||!egaux(n,a,b)) ch[n]=normaliser(n,b); }
  return ch;
}
const appliquerSur=(d,ch)=>{ const r={...d}; for(const [n,e] of Object.entries(ch)){ if(e===null) delete r[n]; else r[n]=e; } return r; };
const enAttente=()=>Object.keys(attente.changements).length>0||attente.ops.length>0||lignesAEnvoyer(true).length>0;

// « Base » (demande de Mauro du 10 octobre 2026) : la maquette telle qu'au départ, toujours en tête des variantes, ni
// modifiable, ni renommable, ni supprimable ; pas stockée dans Airtable (sa disposition est vide : tout à sa place d'origine)
export const BASE=Object.freeze({id:'base',nom:'Base',disposition:{},version:0,fixe:true});
export const lesVariantes=()=>[BASE,...variantes];
export const varianteCourante=()=>courante===BASE.id?BASE:variantes.find(v=>v.id===courante)||null;

// ---------- état affiché (pastille du compte, bas du panneau) ----------
function dire(code,texte){
  etatEnregistrement(code,texte);
  if(connecte()&&$('save-state')) $('save-state').textContent=texte;
  dispatchEvent(new CustomEvent('variantes'));
}
function majEtat(horsLigne){
  if(!connecte()){ dire('local','Visite sans compte : connectez-vous pour modifier.'); return; }
  const nom=varianteCourante()?.nom||'';
  if(horsLigne) dire('hors','Hors connexion : les changements partiront au retour du réseau.');
  else if(envoi||enAttente()) dire('envoi','Enregistrement…');
  else dire('ok',nom?'Tout est enregistré (« '+nom+' »).':'Tout est enregistré.');
}

// ---------- chargement ----------
// lignes du journal local pas encore envoyées (on attend la fin de la fusion d'un geste : 1,5 s)
function lignesAEnvoyer(toutes){
  const {journal,pos}=leJournal(), depuis=attente.envoye[courante]||0, lim=Date.now()-FUSION;
  return journal.slice(0,pos).filter(l=>l.t>depuis&&(toutes||l.t<lim));
}
function vueVersServeur(v){ const {id,nom,...reglage}=v; return {id:String(id),nom,reglage,ordre:lesVues().indexOf(v)}; }
function vueDuServeur(s){ return {...(s.reglage||{}),id:/^\d+$/.test(s.id)?+s.id:s.id,nom:s.nom}; }
const mesureVersServeur=q=>({id:String(q.t),a:q.a,b:q.b});
const mesureDuServeur=s=>({a:s.a,b:s.b,t:/^\d+$/.test(s.id)?+s.id:s.id});

export async function charger(){
  const r=await appel('charger');
  if(!r.ok){ majEtat(r.horsLigne); return false; }
  variantes=r.variantes||[];
  if(!variantes.length){ majEtat(); return false; }
  const voulu=connecte()?(lire(CACHE,{}).courante||courante):null;
  const v=voulu===BASE.id?BASE:variantes.find(x=>x.id===voulu)||variantes[0];
  if(v.id!==courante){ courante=v.id; changerJournal(courante); }
  if(connecte()){
    // vues et mesures : la liste du serveur, plus celles faites ici et pas encore envoyées (ou d'avant les comptes)
    // une vue ou une mesure déjà vue sur le serveur et qui n'y est plus a été supprimée ailleurs : on ne la renvoie pas
    const vusV=new Set(connus.vues), vusM=new Set(connus.mesures);
    const ids=new Set((r.vues||[]).map(s=>String(s.id))), locales=lesVues().filter(q=>!ids.has(String(q.id))&&!vusV.has(String(q.id)));
    remplacerVues([...(r.vues||[]).sort((a,b)=>a.ordre-b.ordre).map(vueDuServeur),...locales]);
    for(const q of locales) if(!attente.ops.some(o=>o.type==='vue'&&o.vue.id===String(q.id))) attente.ops.push({type:'vue',op:'enregistrer',vue:vueVersServeur(q)});
    const idm=new Set((r.mesures||[]).map(s=>String(s.id))), mloc=lesMesures().filter(q=>!idm.has(String(q.t))&&!vusM.has(String(q.t)));
    const supprimees=new Set(attente.ops.filter(o=>o.type==='mesure'&&o.op==='supprimer').map(o=>o.id));
    remplacerMesures([...(r.mesures||[]).map(mesureDuServeur).filter(q=>!supprimees.has(String(q.t))),...mloc]);
    for(const q of mloc) if(!attente.ops.some(o=>o.type==='mesure'&&o.mesure?.id===String(q.t))) attente.ops.push({type:'mesure',op:'ajouter',mesure:mesureVersServeur(q)});
    connus={vues:[...ids],mesures:[...idm]};
    if(attente.envoye[v.id]===undefined) attente.envoye[v.id]=Date.now();   // le journal d'avant la connexion reste sur cet appareil
  }
  base=v.disposition||{}; version=v.version||0;
  const ici=lireDisposition();
  if(v.fixe){   // Base : rien à envoyer, tout à sa place d'origine
    if(Object.keys(difference(ici,base)).length) appliquerDisposition(base);
    attente.changements={}; attente.variante=v.id;
  } else if(connecte()&&((attente.variante===v.id&&Object.keys(attente.changements).length)||modifAvant)){
    attente.changements=difference(base,ici);   // changements faits ici, pas encore envoyés : on les garde et on les envoie
  } else if(connecte()&&version===0&&Object.keys(ici).length&&!lire('maison3d-migre',false)){
    attente.variante=v.id; attente.changements=difference(base,ici); ecrire('maison3d-migre',true);   // première connexion : la disposition de ce navigateur devient « Actuel »
  } else {
    if(Object.keys(difference(ici,base)).length){
      if(!lire('diolly3d-v1-avant-synchro',null)) ecrire('diolly3d-v1-avant-synchro',ici);   // copie de secours de la disposition d'avant les comptes
      appliquerDisposition(base);
    }
    attente.changements={}; attente.variante=v.id;
  }
  pret=true; modifAvant=false; garderCache(); garderAttente(); majEtat();
  if(enAttente()) planifier(300);
  return true;
}

// ---------- envoi ----------
function planifier(ms=DELAI){ clearTimeout(minuterie); minuterie=setTimeout(envoyer,ms); }
async function envoyer(){
  if(!connecte()||!pret) return;
  if(envoi) return envoi.then(()=>planifier(300));
  envoi=(async()=>{
    majEtat();
    // 1. vues et mesures, dans l'ordre
    while(attente.ops.length){
      const o=attente.ops[0];
      const r=o.type==='vue'?await appel('vue',o.op==='supprimer'?{op:'supprimer',id:o.id}:{op:'enregistrer',vue:o.vue})
        :await appel('mesure',o.op==='ajouter'?{op:'ajouter',mesure:o.mesure}:o.op==='supprimer'?{op:'supprimer',id:o.id}:{op:'toutEffacer'});
      if(r.horsLigne) return false;
      if(!r.ok&&!connecte()) return false;
      attente.ops.shift(); garderAttente();   // refusé pour une autre raison : on n'insiste pas
    }
    // 2. la disposition de la variante affichée (la Base ne se modifie pas)
    if(attente.variante!==courante||courante===BASE.id){ attente.changements={}; if(courante===BASE.id){ garderAttente(); return true; } }
    const ch={...attente.changements}, lignes=lignesAEnvoyer(false);
    if(!Object.keys(ch).length&&!lignes.length) return true;
    const avant=version;
    const r=await appel('enregistrer',{variante:courante,changements:ch,historique:lignes.map(l=>({t:l.t,texte:l.texte,ch:l.ch}))});
    if(r.horsLigne) return false;
    if(!r.ok){
      if(r.code===409||r.code===404){ attente.changements={}; garderAttente(); await charger(); }   // variante supprimée ailleurs
      return true;
    }
    base=appliquerSur(base,ch); version=r.version;
    if(lignes.length) attente.envoye[courante]=Math.max(...lignes.map(l=>l.t));
    attente.changements=difference(base,lireDisposition());   // ce qui a bougé pendant l'envoi
    const v=varianteCourante(); if(v){ v.version=version; v.modifieePar=r.modifieePar; v.modifieeLe=r.modifieeLe; v.disposition=base; }
    garderAttente(); garderCache();
    if(version!==avant+1) await charger();   // quelqu'un d'autre a enregistré entre-temps : on reprend la version fusionnée
    return true;
  })();
  const ok=await envoi; envoi=null;
  clearTimeout(relance);
  if(!ok){ majEtat(true); relance=setTimeout(envoyer,30000); return; }
  majEtat();
  if(enAttente()) planifier(lignesAEnvoyer(true).length>lignesAEnvoyer(false).length?FUSION:DELAI);
}
// changement fait ici (déplacer, tourner, masquer, recolorer, annuler…) : on le prépare et on l'envoie bientôt
function surDisposition(e){
  if(e.detail?.distant||!connecte()||courante===BASE.id) return;
  if(!pret||!courante){ modifAvant=true; return; }   // modifié avant la fin du premier chargement : gardé, envoyé ensuite
  attente.variante=courante; attente.changements=difference(base,lireDisposition());
  garderAttente(); majEtat(); planifier();
}

// ---------- reprise des changements faits ailleurs ----------
async function verifier(complet){
  if(!pret||document.hidden||envoi) return;
  if(complet||!connecte()){ if(!enAttente()) await charger(); return; }
  const r=await appel('etat'); if(!r.ok){ if(r.horsLigne) majEtat(true); return; }
  const v=(r.variantes||[]).find(x=>x.id===courante);
  const noms=(r.variantes||[]).map(x=>x.id+x.nom).join(), connus=variantes.map(x=>x.id+x.nom).join();
  if(noms!==connus||(courante!==BASE.id&&(!v||v.version>version))){ if(enAttente()) await envoyer(); else await charger(); }
}

// ---------- changer de variante (variantes.js) ----------
export async function afficherVariante(id){
  if(id===courante) return true;
  if(enAttente()){ await envoyer(); if(enAttente()) return false; }   // hors connexion : on ne quitte pas une variante dont les changements ne sont pas partis
  const v=id===BASE.id?BASE:variantes.find(x=>x.id===id); if(!v) return false;
  courante=id; changerJournal(id); base=v.disposition||{}; version=v.version||0;
  attente.variante=id; attente.changements={};
  appliquerDisposition(base); garderCache(); garderAttente(); majEtat();
  verifier(true);   // la version du serveur peut être plus récente
  return true;
}
export function nouvelleListe(liste){ variantes=liste.filter(v=>!v.fixe); garderCache(); majEtat(); }

export function initSynchro(){
  const a=lire(ATTENTE,null); if(a&&typeof a==='object') attente={variante:a.variante||null,changements:a.changements||{},ops:Array.isArray(a.ops)?a.ops:[],envoye:a.envoye||{}};
  const c=lire(CACHE,null); if(c){ variantes=c.variantes||[]; courante=c.courante||null; version=c.version||0; base=varianteCourante()?.disposition||{}; connus=c.connus||connus; }
  addEventListener('disposition',surDisposition);
  addEventListener('vues-change',e=>{ if(!connecte()) return; const {op,vue}=e.detail;
    attente.ops=attente.ops.filter(o=>!(o.type==='vue'&&(o.vue?.id||o.id)===String(vue.id)&&o.op==='enregistrer'));
    attente.ops.push(op==='supprimer'?{type:'vue',op,id:String(vue.id)}:{type:'vue',op,vue:vueVersServeur(vue)}); garderAttente(); planifier(500); });
  addEventListener('mesures-change',e=>{ if(!connecte()) return; const {op,mesure}=e.detail;
    if(op==='toutEffacer') attente.ops=attente.ops.filter(o=>o.type!=='mesure');
    attente.ops.push(op==='ajouter'?{type:'mesure',op,mesure:mesureVersServeur(mesure)}:op==='supprimer'?{type:'mesure',op,id:String(mesure.t)}:{type:'mesure',op}); garderAttente(); planifier(500); });
  addEventListener('compte',()=>{ if(!connecte()){ attente={variante:null,changements:{},ops:[],envoye:attente.envoye}; garderAttente(); } if(app.mobilierPret) charger(); else majEtat(); });
  addEventListener('online',()=>planifier(200));
  for(const t of ['pointerdown','keydown']) addEventListener(t,()=>{ actif=Date.now(); },true);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) verifier(true); else if(enAttente()) envoyer(); });
  setInterval(()=>{ if(Date.now()-actif<5*60000) verifier(false); },VEILLE);
}
// appelé quand les meubles sont chargés (main.js) : la variante affichée vient du serveur
export function demarrerSynchro(){ if(courante) changerJournal(courante); majEtat(); charger(); }
