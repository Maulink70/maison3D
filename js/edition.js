// Sélection et modification des meubles, liste du panneau
import * as THREE from 'three';
import {app, $, css, fmt} from './app.js';
import {CAT_LABEL} from './config.js';
import {save} from './sauvegarde.js';

const rc=new THREE.Raycaster();

export function pick(e){
  const {canvas,camera,renderer,model,items}=app;
  const r=canvas.getBoundingClientRect();
  const p=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
  rc.setFromCamera(p,camera); rc.far=Infinity;
  const hits=rc.intersectObjects([model],true).filter(h=>renderer.clippingPlanes.every(pl=>pl.distanceToPoint(h.point)>=0)&&visibleChain(h.object));
  const h=hits[0]; const name=h&&h.object.userData.item;
  if(name&&!items[name].hidden) select(name); else select(null);
}
function visibleChain(o){ while(o){ if(!o.visible) return false; o=o.parent;} return true; }

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

export function buildList(){
  const box=$('list'); box.innerHTML='';
  for(const cat of ['meuble','ouverture']){
    const t=document.createElement('div'); t.className='eyebrow group-title'; t.textContent=CAT_LABEL[cat]; box.appendChild(t);
    const its=Object.values(app.items).filter(i=>i.meta.c===cat).sort((a,b)=>a.lvl.localeCompare(b.lvl,'fr')*-1||a.meta.l.localeCompare(b.meta.l,'fr'));
    for(const it of its){
      const row=document.createElement('div'); row.className='row'+(it.hidden?' off':''); row.dataset.n=it.name;
      const b=document.createElement('button'); b.className='name'; b.textContent=it.meta.l; b.onclick=()=>{ if(it.hidden) setHidden(it,false); select(it.name); save(); };
      const lv=document.createElement('span'); lv.className='lvl'; lv.textContent=it.lvl;
      const eye=document.createElement('button'); eye.className='eye'; eye.textContent=it.hidden?'Afficher':'Masquer';
      eye.setAttribute('aria-label',(it.hidden?'Afficher ':'Masquer ')+it.meta.l);
      eye.onclick=()=>{ setHidden(it,!it.hidden); if(app.selected===it&&it.hidden) select(null); save(); };
      row.append(b,lv,eye); box.appendChild(row);
    }
  }
}

// Panneau (feuille en bas sur téléphone)
const mq=matchMedia('(max-width:760px)');
export function openSheet(open){ $('panel').hidden=!open; $('toggle-panel').setAttribute('aria-expanded',String(open)); document.body.classList.toggle('sheet-open',open&&mq.matches); }

export function initEdition(){
  const {tc}=app;
  tc.addEventListener('dragging-changed',e=>{app.orbit.enabled=!e.value&&app.mode==='orbit'; app.gizmoDrag=e.value; if(!e.value) save();});
  tc.addEventListener('objectChange',()=>{ if(app.selBox) app.selBox.update(); });
  $('t-move').onclick=()=>{ if(!app.selected) return;
    if(tc.object){ tc.detach(); $('t-move').textContent='Déplacer'; }
    else { tc.attach(app.selected.g); $('t-move').textContent='Terminer le déplacement'; }
  };
  const rot=d=>{ if(!app.selected) return; app.selected.g.rotation.y+=d*Math.PI/2; app.selBox&&app.selBox.update(); save(); };
  $('t-rotl').onclick=()=>rot(1); $('t-rotr').onclick=()=>rot(-1);
  $('t-color').oninput=e=>{ if(!app.selected) return; paint(app.selected,e.target.value); save(); };
  $('t-color-clear').onclick=()=>{ if(!app.selected) return; paint(app.selected,null); $('t-color').value='#ffffff'; save(); };
  $('t-hide').onclick=()=>{ if(!app.selected) return; const it=app.selected; setHidden(it,!it.hidden); select(null); save(); };
  $('t-reset').onclick=()=>{ if(!app.selected) return; resetItem(app.selected); app.selBox&&app.selBox.update(); save(); };
  $('t-close').onclick=()=>select(null);
  $('toggle-panel').onclick=()=>openSheet($('panel').hidden);
  if(mq.matches) openSheet(false);
}
