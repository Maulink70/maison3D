// Toucher dans la vue 3D (selon Visite / Éditer), sélection et modification des meubles, liste du panneau
import * as THREE from 'three';
import {app, $, css, fmt} from './app.js';
import {CAT_LABEL} from './config.js';
import {save} from './sauvegarde.js';
import {glisserVers} from './visite.js';
import {basculerPorte, basculerElement, ouvrantsDe} from './portes.js';
import {dansIsolement} from './isoler.js';
import {estLampe, soirOuNuit, basculerLampe, marquerLampe, majPanneauLampe} from './lampes.js';
import {majApparence, appliquerEtat, origineDe} from './etats.js';
import {surfaceChoisie, surfaceEn, choisirSurface} from './revetements.js';
import {matieresOuvertes, choisirPartie} from './objets.js';
import {aimanter, reglerAimant} from './aimant.js';

const rc=new THREE.Raycaster();

// Premier élément visible sous le doigt (en tenant compte des plans de coupe)
export function viser(x,y){
  const {canvas,camera,renderer,model}=app;
  const r=canvas.getBoundingClientRect();
  rc.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),camera); rc.far=Infinity;
  return rc.intersectObjects([model],true).find(h=>renderer.clippingPlanes.every(pl=>pl.distanceToPoint(h.point)>=0)&&visibleChain(h.object)&&dansIsolement(h.point));   // pièce isolée : rien autour
}
function visibleChain(o){ while(o){ if(!o.visible) return false; o=o.parent;} return true; }

// Toucher bref. Visite : une porte s'ouvre ou se ferme, le sol fait avancer (1re personne), le reste ne réagit pas.
// Éditer : un meuble est sélectionné ; le sol désélectionne, ou fait avancer s'il n'y a pas de sélection.
export function toucher(e){
  const h=viser(e.clientX,e.clientY);
  if(!app.edition){
    const lampe=app.items[h?.object.userData.item];
    if(h?.object.userData.porte) basculerPorte(h.object.userData.porte);
    else if(lampe&&estLampe(lampe)&&soirOuNuit()) basculerLampe(lampe);   // le soir, toucher une lampe l'allume ou l'éteint
    else if(h&&app.mode==='walk') glisserVers(h.point);
    return;
  }
  const name=h?.object.userData.item;
  if(name&&!app.items[name].hidden){ if(app.selected?.name===name&&matieresOuvertes()) choisirPartie(h.object); else select(name); return; }
  // sols et murs (étape 4) : liste « Sols et murs » ouverte ou une surface déjà choisie : toucher choisit le sol ou les murs
  if(h&&(surfaceChoisie()||$('sm').open)){ const s=surfaceEn(h); if(s){ choisirSurface(s); return; } }
  if(app.selected){ select(null); return; }
  if(surfaceChoisie()){ choisirSurface(null); return; }
  if(h&&app.mode==='walk') glisserVers(h.point);
}

const deg=r=>{ let a=Math.round(r*180/Math.PI)%360; if(a>180) a-=360; if(a<=-180) a+=360; return a; };
export function majAngle(){ if(!app.selected) return; const a=deg(app.selected.g.rotation.y); $('t-angle').value=a; $('t-angle-num').value=a; }
// Rotation libre (livraison 11) : crans de 15° pour la poignée (3D et plan) et le curseur, désactivables (mémorisés)
const CRANS='maison3d-crans', PAS=Math.PI/12;
try{ app.crans=localStorage.getItem(CRANS)!=='non'; }catch{ app.crans=true; }
export const cranter=a=>app.crans?Math.round(a/PAS)*PAS:a;
// après la poignée 3D : angle autour de la verticale seulement, lu dans l'ordre YXZ (sinon, au-delà de 90°, three.js
// le range en x = z = 180°), éventuellement cranté
function apresPoignee(){ const it=app.selected; if(!it||app.tc.getMode()!=='rotate') return;
  const y=new THREE.Euler().setFromQuaternion(it.g.quaternion,'YXZ').y; it.g.rotation.set(0,cranter(y),0); majAngle(); }
function modeOutil(m){ const {tc}=app;
  if(!app.selected||!m||(tc.object&&tc.getMode()===m)){ tc.detach(); m=null; }
  else { tc.setMode(m); tc.showX=tc.showZ=m==='translate'; tc.showY=m==='rotate'; tc.attach(app.selected.g); }
  $('t-move').textContent=m==='translate'?'Terminer le déplacement':app.mode==='plan'?'Glissez-le sur le plan':'Déplacer';
  $('t-poignee').textContent=m==='rotate'?'Terminer la rotation':app.mode==='plan'?'Tournez-le par sa poignée':'Tourner à la main';
  $('t-poignee').setAttribute('aria-pressed',String(m==='rotate')); }
function majPorte(){ const l=app.selected?ouvrantsDe(app.selected.name):[]; $('t-porte').hidden=!l.length; if(!l.length) return;
  const quoi=l[0].def.fenetre?'la fenêtre':'la porte'; $('t-porte').textContent=(l.some(p=>!p.cible)?'Ouvrir ':'Fermer ')+quoi; }

export function select(name){
  const {scene,tc,items}=app;
  if(app.selBox){scene.remove(app.selBox);app.selBox=null;} tc.detach();
  app.selected=name?items[name]:null;
  if(app.selected&&surfaceChoisie()) choisirSurface(null);
  $('sel').hidden=!app.selected;
  for(const r of document.querySelectorAll('.row')) r.classList.toggle('sel',r.dataset.n===name);
  if(!app.selected){ dispatchEvent(new CustomEvent('selection')); return; }
  const it=app.selected;
  $('sel-cat').textContent=(it.ajout?'Objet ajouté':CAT_LABEL[it.meta.c])+' · '+it.lvl;
  $('sel-name').textContent=it.meta.l;
  $('sel-dims').textContent='L '+fmt(it.size.x)+' × P '+fmt(it.size.z)+' × H '+fmt(it.size.y)+' m';
  $('t-color').value=it.color||'#ffffff';
  $('t-hide').textContent=it.hidden?'Afficher':'Masquer';
  app.selBox=new THREE.BoxHelper(it.g,new THREE.Color(css('--accent')||'#2c5a86')); scene.add(app.selBox);
  // sur le plan, on déplace en faisant glisser le meuble et on le tourne par sa poignée (pas de poignée 3D)
  modeOutil(null); $('t-move').disabled=$('t-poignee').disabled=app.mode==='plan';
  majAngle(); majPorte(); majPanneauLampe();
  openSheet(true);
  document.querySelector('.row.sel')?.scrollIntoView({block:'nearest'});
  dispatchEvent(new CustomEvent('selection'));   // nom, dimensions, matières (objets.js)
}

// couleur générale de l'objet (les matières choisies partie par partie gardent leur motif, prennent cette couleur)
export function paint(it,hex){ it.color=hex||null; majApparence(it); }
export function setHidden(it,h){ it.hidden=h; it.g.visible=!h; const row=document.querySelector('.row[data-n="'+CSS.escape(it.name)+'"]'); if(row){row.classList.toggle('off',h); row.querySelector('.eye').textContent=h?'Afficher':'Masquer';} }
// tout l'élément à son état d'origine (place, rotation, couleur, taille, matières, affiché)
export function resetItem(it){ if(!it.ajout) appliquerEtat(it,origineDe(it.name)); }

// Liste rangée par étage (celui où l'on se trouve d'abord), puis mobilier / portes et fenêtres, par ordre alphabétique.
// Filtres : niveau (Tout / Rez / Étage) et recherche sur le nom (sans tenir compte des accents ni des majuscules).
// Reconstruite au chargement, au changement d'étage et à chaque ajout ou retrait de meuble (évènement « meubles »).
const filtre={niveau:'tout',texte:''};
const sansAccent=t=>t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function buildList(){
  const box=$('list'); box.innerHTML='';
  const ordre=app.level==='etage'?['Étage','Rez']:['Rez','Étage'];
  const niveaux=filtre.niveau==='rez'?['Rez']:filtre.niveau==='etage'?['Étage']:ordre;
  const cherche=sansAccent(filtre.texte.trim());
  let total=0;
  for(const lvl of niveaux){
    const blocs=[];
    for(const cat of ['meuble','ouverture']){
      const its=Object.values(app.items).filter(i=>i.lvl===lvl&&i.meta.c===cat&&(!cherche||sansAccent(i.meta.l).includes(cherche)))
        .sort((a,b)=>a.meta.l.localeCompare(b.meta.l,'fr'));
      if(its.length) blocs.push([cat,its]);
    }
    if(!blocs.length) continue;
    const t=document.createElement('div'); t.className='level-title'; t.textContent=lvl; box.appendChild(t);
    for(const [cat,its] of blocs){
      const c=document.createElement('div'); c.className='eyebrow group-title'; c.textContent=CAT_LABEL[cat]; box.appendChild(c);
      for(const it of its){
        total++;
        const row=document.createElement('div'); row.className='row'+(it.hidden?' off':'')+(app.selected===it?' sel':'')+(it.ajout?' ajout':''); row.dataset.n=it.name;
        const b=document.createElement('button'); b.className='name'; b.textContent=it.meta.l; b.onclick=()=>{ if(it.hidden) setHidden(it,false); select(it.name); save(); };
        const eye=document.createElement('button'); eye.className='eye'; eye.textContent=it.hidden?'Afficher':'Masquer';
        eye.setAttribute('aria-label',(it.hidden?'Afficher ':'Masquer ')+it.meta.l);
        eye.onclick=()=>{ setHidden(it,!it.hidden); if(app.selected===it&&it.hidden) select(null); save(); };
        row.append(b,eye); box.appendChild(row);
      }
    }
  }
  if(!total){ const v=document.createElement('div'); v.className='attente'; v.textContent=cherche?'Aucun meuble ne correspond à « '+filtre.texte.trim()+' ».':'Aucun meuble.'; box.appendChild(v); }
}
function filtrerNiveau(n){ filtre.niveau=n; for(const k of ['tout','rez','etage']) $('f-'+k).setAttribute('aria-pressed',String(k===n)); buildList(); }

// Panneau (feuille en bas sur téléphone)
const mq=matchMedia('(max-width:760px)');
export function openSheet(open){ $('panel').hidden=!open; $('toggle-panel').setAttribute('aria-expanded',String(open)); document.body.classList.toggle('sheet-open',open&&mq.matches); }
export function petitEcran(){ return mq.matches; }

export function initEdition(){
  const {tc}=app;
  tc.addEventListener('dragging-changed',e=>{app.orbit.enabled=!e.value&&app.mode==='orbit'; app.gizmoDrag=e.value;
    if(!e.value){ if(app.selected&&tc.getMode()==='translate') aimanter(app.selected); save(); } });   // aimant : posé sur le meuble en dessous
  $('t-aimant').checked=app.aimant; $('t-aimant').onchange=e=>reglerAimant(e.target.checked);
  tc.addEventListener('objectChange',()=>{ apresPoignee(); if(app.selBox) app.selBox.update(); });
  $('t-move').onclick=()=>modeOutil('translate');
  $('t-poignee').onclick=()=>modeOutil('rotate');
  const majCrans=()=>{ $('t-crans').checked=app.crans; $('t-angle').step=app.crans?'15':'1'; };
  $('t-crans').onchange=e=>{ app.crans=e.target.checked; try{ localStorage.setItem(CRANS,app.crans?'oui':'non'); }catch{} majCrans(); };
  majCrans();
  const tourner=a=>{ if(!app.selected) return; app.selected.g.rotation.y=a*Math.PI/180; app.selBox&&app.selBox.update(); majAngle(); save(); };
  $('t-rotl').onclick=()=>app.selected&&tourner(deg(app.selected.g.rotation.y)+90);
  $('t-rotr').onclick=()=>app.selected&&tourner(deg(app.selected.g.rotation.y)-90);
  $('t-angle').oninput=e=>tourner(+e.target.value);
  $('t-angle-num').onchange=e=>{ const a=Number(String(e.target.value).replace(',','.')); if(Number.isFinite(a)) tourner(deg(a*Math.PI/180)); else majAngle(); };
  $('t-porte').onclick=()=>{ if(app.selected){ basculerElement(app.selected.name); majPorte(); } };
  $('t-lampe').onchange=e=>{ if(app.selected) marquerLampe(app.selected,e.target.checked); };
  $('t-allumer').onclick=()=>{ if(app.selected) basculerLampe(app.selected); };
  $('t-color').oninput=e=>{ if(!app.selected) return; paint(app.selected,e.target.value); save(); };
  $('t-color-clear').onclick=()=>{ if(!app.selected) return; paint(app.selected,null); $('t-color').value='#ffffff'; save(); };
  $('t-hide').onclick=()=>{ if(!app.selected) return; const it=app.selected; setHidden(it,!it.hidden); select(null); save(); };
  // remettre en place : place et rotation d'origine, couleur d'origine, affiché (taille et matières ont leurs propres boutons)
  $('t-reset').onclick=()=>{ const it=app.selected; if(!it) return; it.g.position.copy(it.home); it.g.rotation.set(0,0,0); paint(it,null); setHidden(it,false);
    app.selBox&&app.selBox.update(); majAngle(); $('t-color').value='#ffffff'; save(); };
  $('t-close').onclick=()=>select(null);
  $('toggle-panel').onclick=()=>openSheet($('panel').hidden);
  addEventListener('niveau',()=>{ if(app.mobilierPret) buildList(); });
  addEventListener('meubles',()=>{ if(app.mobilierPret) buildList(); });
  for(const k of ['tout','rez','etage']) $('f-'+k).onclick=()=>filtrerNiveau(k);
  $('f-texte').oninput=e=>{ filtre.texte=e.target.value; if(app.mobilierPret) buildList(); };
  if(mq.matches) openSheet(false);
}
