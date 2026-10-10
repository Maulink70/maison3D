// Caméras mémorisées (livraison 12) : bouton « Vues ▾ » : enregistrer le point de vue actuel sous un nom (maquette,
// 1re personne ou plan, avec le niveau, et le style du plan), y revenir en un toucher (retour animé en maquette et sur
// le plan ; en 1re personne, on y est aussitôt), renommer, supprimer (deux touchers). Gardées dans ce navigateur
// (clé maison3d-cameras) jusqu'aux comptes de l'étape 3.
import {app, $, champVisite} from './app.js';
import {ETAGE_FLOOR} from './config.js';
import {setMode, setLevel} from './vues.js';
import {etatVisite, reprendreVisite} from './visite.js';
import {vuePlan, allerVuePlan, niveauDuPlan, style as styleDuPlan, stylePlan} from './plan.js';
import {animerVers} from './aller.js';
import {caler} from './calques.js';
import {pieceEn} from './pieces.js';

const CLE='maison3d-cameras';
let vues=[], aSupprimer=null, enEdition=null;
function garder(){ try{ localStorage.setItem(CLE,JSON.stringify(vues)); }catch{} }
function relire(){ try{ vues=(JSON.parse(localStorage.getItem(CLE)||'[]')||[]).filter(v=>v&&v.nom&&v.mode); }catch{ vues=[]; } }
export const lesVues=()=>vues;
// partage (étape 3) : chaque changement est annoncé (synchro.js l'envoie à n8n) ; la liste du serveur remplace la locale
const annoncer=(op,v)=>dispatchEvent(new CustomEvent('vues-change',{detail:{op,vue:v}}));
export function remplacerVues(liste){ vues=liste.filter(v=>v&&v.nom&&v.mode); garder(); if(!$('vues-menu').hidden) majListe(); }

const NIV={all:'tout',rez:'rez',etage:'étage'};
function description(v){
  if(v.mode==='walk') return '1re personne · '+(v.walk.y>ETAGE_FLOOR-0.8?'étage':'rez');
  if(v.mode==='plan') return 'Plan '+(v.plan.style==='reel'?'réaliste':'d’architecte')+' · '+NIV[v.plan.niveau];
  return 'Maquette · '+(NIV[v.level]||'tout');
}
// nom proposé : la pièce regardée (ou où l'on est), et la vue
function nomPropose(){
  if(app.mode==='plan') return 'Plan '+(niveauDuPlan()==='etage'?'de l’étage':'du rez');
  const c=app.mode==='walk'?app.camera.position:app.orbit.target, n=app.mode==='walk'?(c.y>ETAGE_FLOOR+0.5?'etage':'rez'):app.level==='etage'?'etage':'rez';
  const p=pieceEn(c.x,c.z,n); return (p?p.nom:'Vue')+(app.mode==='walk'?' (1re personne)':' (maquette)');
}
export function enregistrer(nom){
  const v={id:Date.now(),nom:(nom||'').trim()||nomPropose(),mode:app.mode,level:app.level};
  if(app.mode==='walk') v.walk=etatVisite();
  else if(app.mode==='plan') v.plan={...vuePlan(),niveau:niveauDuPlan(),style:styleDuPlan};
  else v.orbit={p:app.camera.position.toArray(),t:app.orbit.target.toArray()};
  vues.push(v); garder(); majListe(); annoncer('enregistrer',v); return v;
}
export function revenir(id){
  const v=vues.find(q=>q.id===id); if(!v) return;
  if(v.mode==='walk'){
    if(app.mode!=='walk'){ app.level=v.walk.y>ETAGE_FLOOR-0.8?'etage':'rez'; setMode('walk'); }
    reprendreVisite(v.walk); if(v.walk.fov){ app.fovVisite=v.walk.fov; champVisite(); }
  } else if(v.mode==='plan'){
    stylePlan(v.plan.style);
    if(app.mode!=='plan'){ app.level=v.plan.niveau; setMode('plan'); }
    else if(niveauDuPlan()!==v.plan.niveau) setLevel(v.plan.niveau,false);
    allerVuePlan(v.plan);
  } else {
    if(app.mode!=='orbit'){ app.level=v.level||'all'; setMode('orbit'); }
    if(app.level!==v.level) setLevel(v.level||'all',false);
    animerVers(v.orbit.p,v.orbit.t);   // après le changement de niveau, qui arrête les animations en cours
  }
}
function renommer(id,nom){ const v=vues.find(q=>q.id===id); if(v&&nom.trim()){ v.nom=nom.trim(); garder(); annoncer('enregistrer',v); } enEdition=null; majListe(); }
function supprimer(id){ const v=vues.find(q=>q.id===id); vues=vues.filter(q=>q.id!==id); aSupprimer=null; garder(); majListe(); if(v) annoncer('supprimer',v); }

// ---------- menu ----------
const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
function majListe(){
  const l=$('vues-liste'); l.replaceChildren();
  if(!vues.length){ l.append(el('p',{class:'vide'},'Aucune vue enregistrée.')); return; }
  for(const v of vues){
    const li=el('div',{class:'vue','data-vue':String(v.id)});
    if(enEdition===v.id){
      const i=el('input',{type:'text',value:v.nom,'aria-label':'Nouveau nom de la vue',maxlength:'60'}), ok=el('button',{type:'button',class:'petit'},'OK');
      ok.onclick=()=>renommer(v.id,i.value); i.onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter') renommer(v.id,i.value); if(e.key==='Escape'){ enEdition=null; majListe(); } };
      li.append(i,ok); l.append(li); setTimeout(()=>{ i.focus(); i.select(); }); continue;
    }
    const b=el('button',{type:'button',class:'aller-vue'}); b.append(el('span',{},v.nom),el('span',{class:'m2'},description(v)));
    b.onclick=()=>{ ouvrir(false); revenir(v.id); };
    const r=el('button',{type:'button',class:'petit','aria-label':'Renommer '+v.nom,title:'Renommer'},'✎'); r.onclick=()=>{ enEdition=v.id; aSupprimer=null; majListe(); };
    const s=el('button',{type:'button',class:'petit'+(aSupprimer===v.id?' danger':''),'aria-label':'Supprimer '+v.nom,title:'Supprimer'},aSupprimer===v.id?'Supprimer ?':'×');
    s.onclick=()=>{ if(aSupprimer===v.id) supprimer(v.id); else { aSupprimer=v.id; majListe(); setTimeout(()=>{ if(aSupprimer===v.id){ aSupprimer=null; majListe(); } },4000); } };
    li.append(b,r,s); l.append(li);
  }
}
function ouvrir(oui){ const m=$('vues-menu'); m.hidden=!oui; $('vues').setAttribute('aria-expanded',String(oui)); if(!oui) return;
  aSupprimer=null; enEdition=null; $('vue-nom').value=''; $('vue-nom').placeholder=nomPropose(); majListe(); caler(m); }
export function initCameras(){
  relire();
  const m=$('vues-menu');
  m.append(el('div',{class:'menu-titre'},'Vues enregistrées'));
  const f=el('div',{class:'vue-form'}), i=el('input',{type:'text',id:'vue-nom','aria-label':'Nom de la vue',maxlength:'60'}), b=el('button',{type:'button',class:'btn primary',id:'vue-enregistrer'},'Enregistrer cette vue');
  const ajouter=()=>{ enregistrer(i.value); i.value=''; i.placeholder=nomPropose(); };
  b.onclick=ajouter;
  i.onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter') ajouter(); if(e.key==='Escape'){ ouvrir(false); $('vues').focus(); } };
  f.append(i,b); m.append(f,el('div',{id:'vues-liste'}));
  $('vues').onclick=e=>{ e.stopPropagation(); ouvrir(m.hidden); };
  addEventListener('pointerdown',e=>{ if(!m.hidden&&!m.contains(e.target)&&!$('vues').contains(e.target)) ouvrir(false); });
  m.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.stopPropagation(); ouvrir(false); $('vues').focus(); } });
}
