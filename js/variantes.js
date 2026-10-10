// Variantes nommées (étape 3) : bouton « Variantes » en tête de barre, avec le nom de la variante affichée. Le menu
// liste les variantes (qui l'a modifiée en dernier, et quand) ; toucher une variante l'affiche. Connecté : créer une
// variante (copie de celle affichée), renommer (✎), supprimer (×, deux touchers ; elle reste récupérable dans Airtable,
// case « Supprimée »). Sans compte : « Actuel » seulement. Liste commune à tous les comptes.
import {$} from './app.js';
import {appel, connecte} from './api.js';
import {lesVariantes, varianteCourante, afficherVariante, nouvelleListe} from './synchro.js';
import {lireDisposition} from './sauvegarde.js';
import {nommer} from './icones.js';
import {caler} from './calques.js';
import {demanderConnexion} from './compte.js';
import {comparer} from './comparer.js';

let enEdition=null, aSupprimer=null, message='';
const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
const quand=t=>{ if(!t) return ''; const d=new Date(t); if(isNaN(d)) return '';
  const j=d.toDateString()===new Date().toDateString()?'aujourd’hui':'le '+d.toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
  return j+' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); };
const dire=(t)=>{ message=t; majMenu(); };

function majBouton(){
  const b=$('variantes'), v=varianteCourante(); if(!b) return;
  b.querySelector('.ib-texte').textContent=v?v.nom:'Actuel';
  nommer(b,'Variante affichée : '+(v?v.nom:'Actuel')+(connecte()?' (changer, créer, renommer)':''));
}
function majMenu(){
  const m=$('variantes-menu'); if(m.hidden) return;
  m.replaceChildren(el('div',{class:'menu-titre'},'Variantes'));
  const liste=lesVariantes(), cour=varianteCourante();
  if(!liste.length) m.append(el('p',{class:'vide'},'Chargement des variantes…'));
  for(const v of liste){
    const li=el('div',{class:'vue','data-variante':v.id});
    if(enEdition===v.id){
      const i=el('input',{type:'text',value:v.nom,'aria-label':'Nouveau nom de la variante',maxlength:'60'}), ok=el('button',{type:'button',class:'petit'},'OK');
      ok.onclick=()=>renommer(v,i.value);
      i.onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter') renommer(v,i.value); if(e.key==='Escape'){ enEdition=null; majMenu(); } };
      li.append(i,ok); m.append(li); setTimeout(()=>{ i.focus(); i.select(); }); continue;
    }
    const b=el('button',{type:'button',class:'aller-vue'}); if(cour&&v.id===cour.id) b.setAttribute('aria-current','true');
    b.append(el('span',{},v.nom),el('span',{class:'m2'},v.modifieePar?v.modifieePar+', '+quand(v.modifieeLe):''));
    b.onclick=async()=>{ if(cour&&v.id===cour.id){ ouvrir(false); return; }
      dire('Chargement de « '+v.nom+' »…'); const ok=await afficherVariante(v.id);
      if(ok){ message=''; ouvrir(false); } else dire('Les derniers changements ne sont pas encore partis (hors connexion) : réessayez quand le réseau revient.'); };
    li.append(b);
    if(connecte()){
      const r=el('button',{type:'button',class:'petit','aria-label':'Renommer '+v.nom,title:'Renommer'},'✎'); r.onclick=()=>{ enEdition=v.id; aSupprimer=null; majMenu(); };
      const s=el('button',{type:'button',class:'petit'+(aSupprimer===v.id?' danger':''),'aria-label':'Supprimer '+v.nom,title:'Supprimer'},aSupprimer===v.id?'Supprimer ?':'×');
      if(liste.length<2) s.disabled=true;
      s.onclick=()=>{ if(aSupprimer===v.id) supprimer(v); else { aSupprimer=v.id; majMenu(); setTimeout(()=>{ if(aSupprimer===v.id){ aSupprimer=null; majMenu(); } },4000); } };
      li.append(r,s);
    }
    m.append(li);
  }
  // comparer la variante affichée avec une autre (barre ou fondu, comparer.js)
  const autres=liste.filter(v=>!cour||v.id!==cour.id);
  if(autres.length){
    const g=el('div',{class:'menu-groupe'}); g.append(el('div',{class:'menu-titre'},'Comparer « '+(cour?cour.nom:'Actuel')+' » avec'));
    for(const v of autres){ const b=el('button',{type:'button','data-comparer':v.id}); b.append(el('span',{},v.nom),el('span',{class:'m2'},'barre ou fondu'));
      b.onclick=()=>{ ouvrir(false); comparer(v.id); }; g.append(b); }
    m.append(g);
  }
  if(connecte()){
    const f=el('div',{class:'vue-form'}), i=el('input',{type:'text',id:'variante-nom','aria-label':'Nom de la nouvelle variante',maxlength:'60',placeholder:'Projet '+liste.length});
    const b=el('button',{type:'button',class:'btn primary',id:'variante-creer'},'Créer');
    b.title='Nouvelle variante : copie de « '+(cour?cour.nom:'Actuel')+' »';
    const creer_=()=>creer((i.value||'').trim()||i.placeholder);
    b.onclick=creer_; i.onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter') creer_(); if(e.key==='Escape'){ ouvrir(false); $('variantes').focus(); } };
    f.append(i,b);
    const pied=el('div',{class:'menu-pied'}); pied.append(el('p',{},'« Créer » copie la variante affichée (« '+(cour?cour.nom:'Actuel')+' ») sous un nouveau nom.'),f);
    m.append(pied);
  } else {
    const p=el('div',{class:'menu-pied'}), c=el('button',{type:'button',class:'btn'},'Se connecter');
    c.onclick=()=>{ ouvrir(false); demanderConnexion('Connectez-vous pour créer et modifier des variantes.'); };
    p.append(el('p',{},'Sans compte, on voit la variante « Actuel ».'),c); m.append(p);
  }
  if(message) m.append(el('p',{class:'cx-erreur',role:'status'},message));
}
async function creer(nom){
  dire('Création de « '+nom+' »…');
  const liste=lesVariantes(), ordre=liste.reduce((m,v)=>Math.max(m,v.ordre||0),0)+1;
  const disposition=lireDisposition();
  const r=await appel('variante',{op:'creer',nom,disposition,ordre});
  if(!r.ok){ dire(r.horsLigne?'Hors connexion : réessayez quand le réseau revient.':(r.erreur||'Création impossible')); return; }
  nouvelleListe([...liste,{...r.variante,disposition}]);
  await afficherVariante(r.variante.id); ouvrir(false);   // la nouvelle variante est affichée (nom sur le bouton)
}
async function renommer(v,nom){
  nom=(nom||'').trim(); enEdition=null; if(!nom||nom===v.nom){ majMenu(); return; }
  const r=await appel('variante',{op:'renommer',id:v.id,nom});
  if(!r.ok){ dire(r.horsLigne?'Hors connexion : réessayez quand le réseau revient.':(r.erreur||'Impossible de renommer')); return; }
  nouvelleListe(lesVariantes().map(x=>x.id===v.id?{...x,nom}:x)); message=''; majMenu();
}
async function supprimer(v){
  aSupprimer=null; const r=await appel('variante',{op:'supprimer',id:v.id});
  if(!r.ok){ dire(r.horsLigne?'Hors connexion : réessayez quand le réseau revient.':(r.erreur||'Suppression impossible')); return; }
  const reste=lesVariantes().filter(x=>x.id!==v.id);
  if(varianteCourante()?.id===v.id){ nouvelleListe(lesVariantes()); await afficherVariante(reste[0].id); }
  nouvelleListe(reste); message=''; majMenu();
}
function ouvrir(oui){ const m=$('variantes-menu'); m.hidden=!oui; $('variantes').setAttribute('aria-expanded',String(oui)); if(!oui){ enEdition=null; aSupprimer=null; message=''; return; } majMenu(); caler(m); }

export function initVariantes(){
  const b=$('variantes'), m=$('variantes-menu');
  b.onclick=e=>{ e.stopPropagation(); ouvrir(m.hidden); };
  addEventListener('pointerdown',e=>{ if(!m.hidden&&!m.contains(e.target)&&!b.contains(e.target)) ouvrir(false); });
  m.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.stopPropagation(); ouvrir(false); b.focus(); } });
  addEventListener('variantes',()=>{ majBouton(); majMenu(); });
  addEventListener('compte',()=>{ majBouton(); majMenu(); });
  majBouton();
}
