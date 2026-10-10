// Compte (étape 3) : bouton rond en bout de barre. Sans compte : formulaire de connexion (nom et mot de passe, retenus
// sur l'appareil : on ne les retape pas) ; on visite la variante « Actuel » sans pouvoir modifier. Connecté : nom,
// état de l'enregistrement (envoyé, en cours, hors connexion), changer le mot de passe, se déconnecter.
// Une pastille sur le bouton dit l'état : verte = tout est enregistré, orange = envoi en attente, grise = hors connexion.
import {$} from './app.js';
import {appel, connecte, moi, ouvrirSession, fermerSession} from './api.js';
import {nommer} from './icones.js';
import {caler} from './calques.js';

let etat={code:'local',texte:''}, suite=null;   // suite : ce qu'on voulait faire (passer en Éditer) avant de se connecter
const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };

// état de l'enregistrement, donné par synchro.js
export function etatEnregistrement(code,texte){
  etat={code,texte}; const b=$('compte'); if(!b) return;
  b.dataset.etat=connecte()?code:'';
  if($('cx-etat')) $('cx-etat').textContent=texte;
}
// demande de connexion (par exemple en touchant « Éditer » sans compte)
export function demanderConnexion(raison,ensuite){ suite=ensuite||null; ouvrir(true,raison); }

function ouvrir(oui,raison){
  const m=$('compte-menu'); m.hidden=!oui; $('compte').setAttribute('aria-expanded',String(oui));
  if(!oui){ if(connecte()) suite=null; return; } construire(raison); caler(m);
  setTimeout(()=>{ const i=m.querySelector('input'); if(i&&!connecte()) i.focus(); });
}
function construire(raison){
  const m=$('compte-menu'); m.replaceChildren(el('div',{class:'menu-titre'},'Compte'));
  if(!connecte()){
    const f=el('form',{class:'cx-form',autocomplete:'on'});
    if(raison) f.append(el('p',{class:'cx-raison'},raison));
    const n=el('input',{type:'text',id:'cx-nom',name:'username',autocomplete:'username',autocapitalize:'none',spellcheck:'false',required:''});
    const p=el('input',{type:'password',id:'cx-mdp',name:'password',autocomplete:'current-password',required:''});
    const ln=el('label',{for:'cx-nom'},'Nom'), lp=el('label',{for:'cx-mdp'},'Mot de passe');
    const ok=el('button',{type:'submit',class:'btn primary',id:'cx-ok'},'Se connecter'), err=el('p',{class:'cx-erreur',role:'alert',id:'cx-erreur'});
    f.append(ln,n,lp,p,ok,err,el('p',{class:'cx-note'},'Sans compte, on peut visiter l’appartement (variante « Actuel ») mais pas le modifier.'));
    f.onsubmit=async e=>{ e.preventDefault(); err.textContent=''; ok.disabled=true; ok.textContent='Connexion…';
      const r=await appel('connexion',{identifiant:n.value,motDePasse:p.value});
      ok.disabled=false; ok.textContent='Se connecter';
      if(r.ok){ const s=suite; suite=null; ouvrirSession(r.jeton,r.nom); ouvrir(false); s?.(); }
      else err.textContent=r.horsLigne?'Pas de connexion au serveur : vérifiez Internet et réessayez.':(r.erreur||'Connexion impossible');
    };
    m.append(f); return;
  }
  const qui=el('p',{class:'cx-qui'}); qui.append('Connecté : ',el('b',{},moi()));
  m.append(qui,el('p',{class:'cx-etat',id:'cx-etat',role:'status'},etat.texte||'…'));
  const bm=el('button',{type:'button',id:'cx-mdp-ouvrir'},'Changer mon mot de passe');
  const f=el('form',{class:'cx-form',id:'cx-mdp-form',hidden:''});
  const champ=(id,lib,auto)=>{ const i=el('input',{type:'password',id,autocomplete:auto,required:''}); f.append(el('label',{for:id},lib),i); return i; };
  const a=champ('cx-ancien','Mot de passe actuel','current-password'), nv=champ('cx-nouveau','Nouveau mot de passe (6 caractères au moins)','new-password'), cf=champ('cx-confirme','Nouveau mot de passe, encore une fois','new-password');
  const ok=el('button',{type:'submit',class:'btn primary'},'Enregistrer le mot de passe'), msg=el('p',{class:'cx-erreur',role:'alert'});
  f.append(ok,msg);
  bm.onclick=()=>{ f.hidden=!f.hidden; if(!f.hidden) a.focus(); };
  f.onsubmit=async e=>{ e.preventDefault(); msg.textContent='';
    if(nv.value.length<6){ msg.textContent='Le nouveau mot de passe doit faire au moins 6 caractères.'; return; }
    if(nv.value!==cf.value){ msg.textContent='Les deux nouveaux mots de passe ne sont pas pareils.'; return; }
    ok.disabled=true; const r=await appel('motdepasse',{ancien:a.value,nouveau:nv.value}); ok.disabled=false;
    if(r.ok){ f.reset(); f.hidden=true; msg.textContent=''; m.querySelector('.cx-etat').textContent='Mot de passe changé.'; }
    else msg.textContent=r.horsLigne?'Pas de connexion au serveur : réessayez plus tard.':(r.erreur||'Impossible de changer le mot de passe');
  };
  const sortir=el('button',{type:'button',id:'cx-sortir'},'Se déconnecter');
  sortir.onclick=()=>{ fermerSession(); ouvrir(false); };
  m.append(bm,f,sortir);
}
function majBouton(){ const b=$('compte'); nommer(b,connecte()?'Compte : '+moi():'Se connecter'); b.dataset.etat=connecte()?etat.code:''; b.classList.toggle('connecte',connecte()); }

// Écran d'entrée (étape 3) : sans compte, on ne voit que lui ; entrer() lance le chargement de la maquette.
// Se déconnecter (ou un jeton refusé par n8n) recharge la page : on revient à cet écran.
export function initPorte(entrer){
  const p=$('porte'), f=$('porte-form'), ok=$('porte-ok'), err=$('porte-erreur');
  addEventListener('compte',()=>{ if(!connecte()) location.reload(); });
  if(connecte()){ entrer(); return; }
  p.hidden=false; $('loading').hidden=true; setTimeout(()=>$('porte-nom').focus());
  f.onsubmit=async e=>{ e.preventDefault(); err.textContent=''; ok.disabled=true; ok.textContent='Connexion…';
    const r=await appel('connexion',{identifiant:$('porte-nom').value,motDePasse:$('porte-mdp').value});
    ok.disabled=false; ok.textContent='Entrer';
    if(!r.ok){ err.textContent=r.horsLigne?'Pas de connexion au serveur : vérifiez Internet et réessayez.':(r.erreur||'Connexion impossible'); return; }
    p.hidden=true; $('loading').hidden=false; ouvrirSession(r.jeton,r.nom); entrer(); };
}

export function initCompte(){
  const b=$('compte'), m=$('compte-menu');
  b.onclick=e=>{ e.stopPropagation(); ouvrir(m.hidden); };
  addEventListener('pointerdown',e=>{ if(!m.hidden&&!m.contains(e.target)&&!b.contains(e.target)) ouvrir(false); });
  m.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape'){ ouvrir(false); b.focus(); } });
  addEventListener('compte',()=>{ majBouton(); if(!m.hidden) construire(); });
  majBouton();
}
