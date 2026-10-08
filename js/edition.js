// Toucher dans la vue 3D (selon Visite / Éditer), sélection et modification des meubles, liste du panneau
import * as THREE from 'three';
import {app, $, css, fmt} from './app.js';
import {CAT_LABEL} from './config.js';
import {save} from './sauvegarde.js';
import {glisserVers} from './visite.js';
import {basculerPorte, porteDe} from './portes.js';

const rc=new THREE.Raycaster();

// Premier élément visible sous le doigt (en tenant compte des plans de coupe)
export function viser(x,y){
  const {canvas,camera,renderer,model}=app;
  const r=canvas.getBoundingClientRect();
  rc.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),camera); rc.far=Infinity;
  return rc.intersectObjects([model],true).find(h=>renderer.clippingPlanes.every(pl=>pl.distanceToPoint(h.point)>=0)&&visibleChain(h.object));
}
function visibleChain(o){ while(o){ if(!o.visible) return false; o=o.parent;} return true; }

// Toucher bref. Visite : une porte s'ouvre ou se ferme, le sol fait avancer (1re personne), le reste ne réagit pas.
// Éditer : un meuble est sélectionné ; le sol désélectionne, ou fait avancer s'il n'y a pas de sélection.
export function toucher(e){
  const h=viser(e.clientX,e.clientY);
  if(!app.edition){
    if(h?.object.userData.porte) basculerPorte(h.object.userData.porte);
    else if(h&&app.mode==='walk') glisserVers(h.point);
    return;
  }
  const name=h?.object.userData.item;
  if(name&&!app.items[name].hidden){ select(name); return; }
  if(app.selected){ select(null); return; }
  if(h&&app.mode==='walk') glisserVers(h.point);
}

const deg=r=>{ let a=Math.round(r*180/Math.PI)%360; if(a>180) a-=360; if(a<=-180) a+=360; return a; };
function majAngle(){ if(!app.selected) return; const a=deg(app.selected.g.rotation.y); $('t-angle').value=a; $('t-angle-num').value=a; }
function majPorte(){ const p=app.selected&&porteDe(app.selected.name); $('t-porte').hidden=!p; if(p) $('t-porte').textContent=p.cible?'Fermer la porte':'Ouvrir la porte'; }

export function select(name){
  const {scene,tc,items}=app;
  if(app.selBox){scene.remove(app.selBox);app.selBox=null;} tc.detach();
  app.selected=name?items[name]:null;
  $('sel').hidden=!app.selected;
  for(const r of document.querySelectorAll('.row')) r.classList.toggle('sel',r.dataset.n===name);
  if(!app.selected) return;
  const it=app.selected;
  $('sel-cat').textContent=CAT_LABEL[it.meta.c]+' · '+it.lvl;
  $('sel-name').textContent=it.meta.l;
  $('sel-dims').textContent='L '+fmt(it.size.x)+' × P '+fmt(it.size.z)+' × H '+fmt(it.size.y)+' m';
  $('t-color').value=it.color||'#ffffff';
  $('t-hide').textContent=it.hidden?'Afficher':'Masquer';
  app.selBox=new THREE.BoxHelper(it.g,new THREE.Color(css('--accent')||'#2c5a86')); scene.add(app.selBox);
  $('t-move').textContent='Déplacer'; $('t-move').classList.add('primary');
  majAngle(); majPorte();
  openSheet(true);
  document.querySelector('.row.sel')?.scrollIntoView({block:'nearest'});
}

export function paint(it,hex){
  it.color=hex;
  for(const m of it.mats){
    if(m.userData.vitre) continue;
    if(!m.userData.orig){ m.userData.orig=m.material; m.material=m.material.clone(); }
    if(hex){ m.material.color.set(hex); } else { m.material.color.copy(m.userData.orig.color); }
  }
}
export function setHidden(it,h){ it.hidden=h; it.g.visible=!h; const row=document.querySelector('.row[data-n="'+CSS.escape(it.name)+'"]'); if(row){row.classList.toggle('off',h); row.querySelector('.eye').textContent=h?'Afficher':'Masquer';} }
export function resetItem(it){ it.g.position.copy(it.home); it.g.rotation.set(0,0,0); paint(it,null); setHidden(it,false); }

// Liste rangée par étage (celui où l'on se trouve d'abord), puis mobilier / portes et fenêtres, par ordre alphabétique
export function buildList(){
  const box=$('list'); box.innerHTML='';
  const niveaux=app.level==='etage'?['Étage','Rez']:['Rez','Étage'];
  for(const lvl of niveaux){
    const t=document.createElement('div'); t.className='level-title'; t.textContent=lvl; box.appendChild(t);
    for(const cat of ['meuble','ouverture']){
      const its=Object.values(app.items).filter(i=>i.lvl===lvl&&i.meta.c===cat).sort((a,b)=>a.meta.l.localeCompare(b.meta.l,'fr'));
      if(!its.length) continue;
      const c=document.createElement('div'); c.className='eyebrow group-title'; c.textContent=CAT_LABEL[cat]; box.appendChild(c);
      for(const it of its){
        const row=document.createElement('div'); row.className='row'+(it.hidden?' off':'')+(app.selected===it?' sel':''); row.dataset.n=it.name;
        const b=document.createElement('button'); b.className='name'; b.textContent=it.meta.l; b.onclick=()=>{ if(it.hidden) setHidden(it,false); select(it.name); save(); };
        const eye=document.createElement('button'); eye.className='eye'; eye.textContent=it.hidden?'Afficher':'Masquer';
        eye.setAttribute('aria-label',(it.hidden?'Afficher ':'Masquer ')+it.meta.l);
        eye.onclick=()=>{ setHidden(it,!it.hidden); if(app.selected===it&&it.hidden) select(null); save(); };
        row.append(b,eye); box.appendChild(row);
      }
    }
  }
}

// Panneau (feuille en bas sur téléphone)
const mq=matchMedia('(max-width:760px)');
export function openSheet(open){ $('panel').hidden=!open; $('toggle-panel').setAttribute('aria-expanded',String(open)); document.body.classList.toggle('sheet-open',open&&mq.matches); }
export function petitEcran(){ return mq.matches; }

export function initEdition(){
  const {tc}=app;
  tc.addEventListener('dragging-changed',e=>{app.orbit.enabled=!e.value&&app.mode==='orbit'; app.gizmoDrag=e.value; if(!e.value) save();});
  tc.addEventListener('objectChange',()=>{ if(app.selBox) app.selBox.update(); });
  $('t-move').onclick=()=>{ if(!app.selected) return;
    if(tc.object){ tc.detach(); $('t-move').textContent='Déplacer'; }
    else { tc.attach(app.selected.g); $('t-move').textContent='Terminer le déplacement'; }
  };
  const tourner=a=>{ if(!app.selected) return; app.selected.g.rotation.y=a*Math.PI/180; app.selBox&&app.selBox.update(); majAngle(); save(); };
  $('t-rotl').onclick=()=>app.selected&&tourner(deg(app.selected.g.rotation.y)+90);
  $('t-rotr').onclick=()=>app.selected&&tourner(deg(app.selected.g.rotation.y)-90);
  $('t-angle').oninput=e=>tourner(+e.target.value);
  $('t-angle-num').onchange=e=>{ const a=Number(String(e.target.value).replace(',','.')); if(Number.isFinite(a)) tourner(deg(a*Math.PI/180)); else majAngle(); };
  $('t-porte').onclick=()=>{ const p=app.selected&&porteDe(app.selected.name); if(p){ basculerPorte(p); majPorte(); } };
  $('t-color').oninput=e=>{ if(!app.selected) return; paint(app.selected,e.target.value); save(); };
  $('t-color-clear').onclick=()=>{ if(!app.selected) return; paint(app.selected,null); $('t-color').value='#ffffff'; save(); };
  $('t-hide').onclick=()=>{ if(!app.selected) return; const it=app.selected; setHidden(it,!it.hidden); select(null); save(); };
  $('t-reset').onclick=()=>{ if(!app.selected) return; resetItem(app.selected); app.selBox&&app.selBox.update(); majAngle(); save(); };
  $('t-close').onclick=()=>select(null);
  $('toggle-panel').onclick=()=>openSheet($('panel').hidden);
  addEventListener('niveau',()=>{ if(app.mobilierPret) buildList(); });
  if(mq.matches) openSheet(false);
}
