// Variantes nommées (étape 3) : bouton « Variantes » en tête de barre. Depuis le 11 octobre 2026 (Mauro : le nom de la
// variante rendait le bouton trop long), c'est une disquette avec la pastille de l'enregistrement automatique (verte :
// tout est enregistré) ; le nom de la variante affichée est sous « Appart. Diolly » (#brand-variante).
// Bases (11 octobre 2026, choix de Mauro : 1a, 2a, 3a + masquer) : la Base d'origine (maquette de départ) est intouchable ;
// « En faire une base » (⤴, deux touchers) copie une variante en base, verrouillée (on ne la modifie pas, on y crée des
// variantes), renommable, masquable, supprimable avec ses variantes (deux touchers ; récupérable dans Airtable, case
// « Supprimée »). Menu : liste déroulante « Base » (choisir une base l'affiche), la base et ses variantes seulement (menu
// court même avec beaucoup de variantes), « Montrer les bases masquées », « Comparer avec » (liste par base), tableau des
// meubles, « Créer » (copie de la variante affichée, dans sa base). Toucher une variante l'affiche ; ✎ renommer ;
// × supprimer (deux touchers). Liste commune à tous les comptes.
import {ouvrirTableau} from './tableau.js';
import {$} from './app.js';
import {appel, connecte} from './api.js';
import {lesVariantes, varianteCourante, afficherVariante, nouvelleListe, verrouillee, groupeDe, BASE} from './synchro.js';
import {lireDisposition} from './sauvegarde.js';
import {nommer} from './icones.js';
import {caler} from './calques.js';
import {demanderConnexion, etatActuel} from './compte.js';
import {comparer} from './comparer.js';

let enEdition=null, aSupprimer=null, aBaser=null, message='', choixComparer=null, montrerMasquees=false;
const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
const quand=t=>{ if(!t) return ''; const d=new Date(t); if(isNaN(d)) return '';
  const j=d.toDateString()===new Date().toDateString()?'aujourd’hui':'le '+d.toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
  return j+' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); };
let messageOk=false;
const dire=(t,ok=false)=>{ message=t; messageOk=ok; majMenu(); };
const HORS='Hors connexion : réessayez quand le réseau revient.';

// les bases (Base d'origine en tête) et les variantes d'une base
const lesBases=()=>lesVariantes().filter(v=>v.id===BASE.id||v.estBase);
const variantesDe=g=>lesVariantes().filter(v=>!verrouillee(v)&&groupeDe(v)===g);
const modifiables=()=>lesVariantes().filter(v=>!verrouillee(v));
const nomBase=g=>lesVariantes().find(v=>v.id===g)?.nom||BASE.nom;
const ordreSuivant=()=>lesVariantes().filter(v=>!v.fixe).reduce((m,v)=>Math.max(m,v.ordre||0),0)+1;

function majBouton(){
  const b=$('variantes'), v=varianteCourante(), nom=v?v.nom:'Actuel'; if(!b) return;
  $('brand-variante').textContent=nom;
  const g=groupeDe(v), dans=v&&!verrouillee(v)&&g!==BASE.id?' (base « '+nomBase(g)+' »)':'';
  const e=etatActuel(), etat=!connecte()?'':verrouillee(v)?' · base, non modifiable':e.code==='ok'?' · tout est enregistré':e.code==='envoi'?' · enregistrement…':e.code==='hors'?' · hors connexion, envoi au retour du réseau':'';
  nommer(b,'Variantes (enregistrement automatique) : « '+nom+' »'+dans+' affichée'+etat);
}

// une ligne : la base ou une de ses variantes
function ligne(v,cour){
  const li=el('div',{class:'vue'+(verrouillee(v)?' var-base':' var-enfant'),'data-variante':v.id});
  if(enEdition===v.id){
    const i=el('input',{type:'text',value:v.nom,'aria-label':'Nouveau nom','maxlength':'60'}), ok=el('button',{type:'button',class:'petit'},'OK');
    ok.onclick=()=>renommer(v,i.value);
    i.onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter') renommer(v,i.value); if(e.key==='Escape'){ enEdition=null; majMenu(); } };
    li.append(i,ok); setTimeout(()=>{ i.focus(); i.select(); }); return li;
  }
  const affichee=cour&&v.id===cour.id, n=v.estBase?variantesDe(v.id).length:0;
  const qui=v.modifieePar?'modifiée par '+v.modifieePar+', '+quand(v.modifieeLe):'';
  const info=v.id===BASE.id?'maquette d’origine, intouchable':v.estBase?['base verrouillée',v.masquee?'masquée':'',n+' variante'+(n>1?'s':'')].filter(Boolean).join(' · '):qui;
  const b=el('button',{type:'button',class:'aller-vue'}); if(affichee) b.setAttribute('aria-current','true');
  b.append(el('span',{},v.nom),el('span',{class:'m2'},affichee?'affichée'+(info?' · '+info:''):info));
  b.onclick=async()=>{ if(affichee){ ouvrir(false); return; }
    dire('Chargement de « '+v.nom+' »…',true); const ok=await afficherVariante(v.id);
    if(ok){ message=''; ouvrir(false); } else dire('Les derniers changements ne sont pas encore partis (hors connexion) : réessayez quand le réseau revient.'); };
  li.append(b);
  if(!connecte()||v.id===BASE.id) return li;   // la Base d'origine : ni renommer, ni masquer, ni supprimer
  const petit=(texte,nom,f,classe='')=>{ const x=el('button',{type:'button',class:'petit'+classe,'aria-label':nom,title:nom},texte); x.onclick=f; return x; };
  const armer=(cle,id)=>{ if(cle==='s') aSupprimer=id; else aBaser=id; majMenu(); setTimeout(()=>{ if(cle==='s'&&aSupprimer===id){ aSupprimer=null; majMenu(); } if(cle==='b'&&aBaser===id){ aBaser=null; majMenu(); } },4000); };
  li.append(petit('✎','Renommer '+v.nom,()=>{ enEdition=v.id; aSupprimer=aBaser=null; majMenu(); }));
  if(v.estBase){
    li.append(petit(v.masquee?'Afficher':'Masquer',(v.masquee?'Ne plus masquer':'Masquer')+' la base '+v.nom,()=>masquer(v),' texte'));
    li.append(petit(aSupprimer===v.id?(n?'Supprimer (+'+n+') ?':'Supprimer ?'):'×','Supprimer la base '+v.nom+(n?' et ses '+n+' variante'+(n>1?'s':''):''),
      ()=>{ if(aSupprimer===v.id) supprimerBase(v); else armer('s',v.id); },aSupprimer===v.id?' danger':''));
  } else {
    li.append(petit(aBaser===v.id?'En base ?':'⤴','En faire une base (copie de « '+v.nom+' »)',()=>{ if(aBaser===v.id) faireBase(v); else armer('b',v.id); },aBaser===v.id?' danger texte':''));
    const s=petit(aSupprimer===v.id?'Supprimer ?':'×','Supprimer '+v.nom,()=>{ if(aSupprimer===v.id) supprimer(v); else armer('s',v.id); },aSupprimer===v.id?' danger':'');
    if(modifiables().length<2) s.disabled=true;   // la dernière variante modifiable reste
    li.append(s);
  }
  return li;
}

function majMenu(){
  const m=$('variantes-menu'); if(m.hidden) return;
  m.replaceChildren(el('div',{class:'menu-titre'},'Variantes'));
  const cour=varianteCourante(), g=groupeDe(cour), bloquee=verrouillee(cour);
  // enregistrement automatique : chaque changement part tout seul dans la variante affichée
  const e=etatActuel(); if(connecte()) m.append(el('p',{class:'var-etat','data-etat':bloquee?'':e.code},bloquee?'« '+(cour?.nom||'')+' » est une base : elle ne se modifie pas. « Créer » en fait une variante à modifier.':
    (e.code==='ok'?'✓ ':'')+(e.texte||'…')+(e.code==='ok'?' Chaque changement s’enregistre tout seul.':'')));
  const bases=lesBases(), cachees=bases.filter(b=>b.masquee);
  // choisir une base (l'afficher) : seulement s'il y a d'autres bases que celle d'origine
  if(bases.length>1){
    const f=el('div',{class:'vue-form var-comparer'}), s=el('select',{id:'base-choix','aria-label':'Base'});
    for(const b of bases) if(!b.masquee||montrerMasquees||b.id===g) s.append(el('option',{value:b.id},b.nom+(b.masquee?' (masquée)':'')));
    s.value=g; s.onkeydown=ev=>ev.stopPropagation();
    s.onchange=async()=>{ dire('Chargement de « '+nomBase(s.value)+' »…',true); const ok=await afficherVariante(s.value); dire(ok?'':'Les derniers changements ne sont pas encore partis (hors connexion) : réessayez quand le réseau revient.'); };
    f.prepend(el('span',{class:'var-label'},'Base')); f.append(s); m.append(f);
    if(cachees.length){ const c=el('label',{class:'case var-masquees'}), i=el('input',{type:'checkbox'}); i.checked=montrerMasquees;
      i.onchange=()=>{ montrerMasquees=i.checked; majMenu(); }; c.append(i,document.createTextNode(' Montrer les bases masquées ('+cachees.length+')')); m.append(c); }
  }
  // la base de la variante affichée, puis ses variantes
  const base=lesVariantes().find(v=>v.id===g)||BASE, liste=variantesDe(g);
  m.append(ligne(base,cour)); for(const v of liste) m.append(ligne(v,cour));
  if(!liste.length) m.append(el('p',{class:'var-note'},'Aucune variante dans cette base : « Créer » en ajoute une.'));
  // comparer la variante affichée avec une autre (barre ou fondu, comparer.js) : liste déroulante, rangée par base
  const autres=lesVariantes().filter(v=>!cour||v.id!==cour.id);
  if(autres.length){
    const gr=el('div',{class:'menu-groupe'}); gr.append(el('div',{class:'menu-titre'},'Comparer « '+(cour?cour.nom:'Actuel')+' » avec'));
    const f=el('div',{class:'vue-form var-comparer'}), s=el('select',{id:'variante-comparer','aria-label':'Variante à comparer'}), b=el('button',{type:'button',class:'btn primary',id:'variante-comparer-ok'},'Comparer');
    for(const ba of bases){ if(ba.masquee&&!montrerMasquees&&ba.id!==g) continue;
      const og=el('optgroup',{label:ba.nom}); for(const v of [ba,...variantesDe(ba.id)]) if(!cour||v.id!==cour.id) og.append(el('option',{value:v.id},v.nom+(v===ba?' (base)':'')));
      if(og.children.length) s.append(og); }
    if([...s.options].some(o=>o.value===choixComparer)) s.value=choixComparer;
    s.onchange=()=>{ choixComparer=s.value; }; s.onkeydown=ev=>ev.stopPropagation();
    b.onclick=()=>{ if(!s.value) return; choixComparer=s.value; ouvrir(false); comparer(s.value); };
    f.append(s,b); gr.append(f,el('p',{class:'var-note'},'Barre à glisser ou fondu entre les deux.')); m.append(gr);
  }
  // tableau des meubles de la variante affichée (tableau.js)
  const t=el('button',{type:'button',id:'variante-tableau'}); t.append(el('span',{},'Tableau des meubles de « '+(cour?cour.nom:'Actuel')+' »'),el('span',{class:'m2'},'dimensions, matières, liens · Excel'));
  t.onclick=()=>{ ouvrir(false); ouvrirTableau(true); }; const gt=el('div',{class:'menu-groupe'}); gt.append(t); m.append(gt);
  if(connecte()){
    const f=el('div',{class:'vue-form'}), i=el('input',{type:'text',id:'variante-nom','aria-label':'Nom de la nouvelle variante',maxlength:'60',placeholder:'Projet '+(modifiables().length+1)});
    const b=el('button',{type:'button',class:'btn primary',id:'variante-creer'},'Créer');
    b.title='Nouvelle variante : copie de « '+(cour?cour.nom:'Actuel')+' »';
    const creer_=()=>creer((i.value||'').trim()||i.placeholder);
    b.onclick=creer_; i.onkeydown=ev=>{ ev.stopPropagation(); if(ev.key==='Enter') creer_(); if(ev.key==='Escape'){ ouvrir(false); $('variantes').focus(); } };
    f.append(i,b);
    const pied=el('div',{class:'menu-pied'}); pied.append(el('p',{},'« Créer » copie « '+(cour?cour.nom:'Actuel')+' » sous un nouveau nom, dans la base « '+nomBase(g)+' ». ⤴ fait d’une variante une nouvelle base (copie).'),f);
    m.append(pied);
  } else {
    const p=el('div',{class:'menu-pied'}), c=el('button',{type:'button',class:'btn'},'Se connecter');
    c.onclick=()=>{ ouvrir(false); demanderConnexion('Connectez-vous pour créer et modifier des variantes.'); };
    p.append(el('p',{},'Sans compte, on voit la variante « Actuel ».'),c); m.append(p);
  }
  if(message) m.append(el('p',{class:messageOk?'var-note var-ok':'cx-erreur',role:'status'},message));
}
// nouvelle variante : copie de celle affichée, dans sa base
async function creer(nom){
  dire('Création de « '+nom+' »…',true);
  const liste=lesVariantes().filter(v=>!v.fixe), disposition=lireDisposition(), g=groupeDe(varianteCourante());
  const r=await appel('variante',{op:'creer',nom,disposition,ordre:ordreSuivant(),base:g===BASE.id?'':g});
  if(!r.ok){ dire(r.horsLigne?HORS:(r.erreur||'Création impossible')); return; }
  nouvelleListe([...liste,{base:g===BASE.id?'':g,...r.variante,disposition}]);
  await afficherVariante(r.variante.id); ouvrir(false);   // la nouvelle variante est affichée
}
// « En faire une base » (choix 2a) : une copie de la variante devient une base ; la variante reste où elle est
async function faireBase(v){
  aBaser=null; dire('Création de la base « '+v.nom+' »…',true);
  const cour=varianteCourante(), disposition=cour&&v.id===cour.id?lireDisposition():v.disposition||{};
  const r=await appel('variante',{op:'creer',nom:v.nom,disposition,ordre:ordreSuivant(),estBase:true,base:''});
  if(!r.ok){ dire(r.horsLigne?HORS:(r.erreur||'Création impossible')); return; }
  nouvelleListe([...lesVariantes().filter(x=>!x.fixe),{estBase:true,base:'',...r.variante,disposition}]);
  const ok=await afficherVariante(r.variante.id);
  dire(ok?'Base « '+v.nom+' » créée (copie de la variante, qui reste dans sa base). « Créer » y ajoute des variantes ; ✎ pour la renommer.':'Base créée : elle s’affichera quand les derniers changements seront partis.',true);
}
async function renommer(v,nom){
  nom=(nom||'').trim(); enEdition=null; if(!nom||nom===v.nom){ majMenu(); return; }
  const r=await appel('variante',{op:'renommer',id:v.id,nom});
  if(!r.ok){ dire(r.horsLigne?HORS:(r.erreur||'Impossible de renommer')); return; }
  nouvelleListe(lesVariantes().map(x=>x.id===v.id?{...x,nom}:x)); message=''; majMenu();
}
async function masquer(b){
  const r=await appel('variante',{op:'masquer',id:b.id,masquee:!b.masquee});
  if(!r.ok){ dire(r.horsLigne?HORS:(r.erreur||'Impossible de masquer la base')); return; }
  nouvelleListe(lesVariantes().map(x=>x.id===b.id?{...x,masquee:!b.masquee}:x)); message=''; majMenu();
}
// supprimer une variante : si elle est affichée, on passe d'abord à sa base
async function supprimer(v){
  aSupprimer=null;
  if(varianteCourante()?.id===v.id&&!await afficherVariante(groupeDe(v))){ dire('Les derniers changements ne sont pas encore partis (hors connexion) : réessayez quand le réseau revient.'); return; }
  const r=await appel('variante',{op:'supprimer',id:v.id});
  if(!r.ok){ dire(r.horsLigne?HORS:(r.erreur||'Suppression impossible')); return; }
  nouvelleListe(lesVariantes().filter(x=>x.id!==v.id&&!x.fixe)); message=''; majMenu();
}
// supprimer une base et ses variantes (choix 3a, deux touchers ; récupérables dans Airtable) : si l'une est affichée,
// on passe d'abord à la Base d'origine
async function supprimerBase(b){
  aSupprimer=null; const ids=[b.id,...variantesDe(b.id).map(v=>v.id)];
  if(ids.includes(varianteCourante()?.id)&&!await afficherVariante(BASE.id)){ dire('Les derniers changements ne sont pas encore partis (hors connexion) : réessayez quand le réseau revient.'); return; }
  const r=await appel('variante',{op:'supprimer',ids});
  if(!r.ok){ dire(r.horsLigne?HORS:(r.erreur||'Suppression impossible')); return; }
  nouvelleListe(lesVariantes().filter(x=>!ids.includes(x.id)&&!x.fixe)); message=''; majMenu();
}
function ouvrir(oui){ const m=$('variantes-menu'); m.hidden=!oui; $('variantes').setAttribute('aria-expanded',String(oui)); if(!oui){ enEdition=null; aSupprimer=null; aBaser=null; message=''; return; } majMenu(); caler(m); }

export function initVariantes(){
  const b=$('variantes'), m=$('variantes-menu');
  b.onclick=e=>{ e.stopPropagation(); ouvrir(m.hidden); };
  addEventListener('pointerdown',e=>{ if(!m.hidden&&!m.contains(e.target)&&!b.contains(e.target)) ouvrir(false); });
  m.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.stopPropagation(); ouvrir(false); b.focus(); } });
  addEventListener('variantes',()=>{ majBouton(); majMenu(); });
  addEventListener('compte',()=>{ majBouton(); majMenu(); });
  // Éditer refusé sur une base (vues.js) : le menu s'ouvre et explique
  addEventListener('base-verrouillee',()=>{ ouvrir(true); dire('« '+(varianteCourante()?.nom||'')+' » est une base : elle ne se modifie pas. Créez-en une variante (« Créer ») pour la modifier.'); });
  majBouton();
}
