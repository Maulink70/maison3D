// Assistant « Mauro » (étape 6, 12 octobre 2026, parcours validé par Mauro sur la page https://claude.ai/artifact/FcNuiuaUdyyPRTFPsnNXqU) :
// bouton de la barre (visage de Mauro), panneau sur le côté. Accueil « Ciao, je suis ton assistant, comment puis-je
// t'aider ? » (le buste salue ; écrire « ciao » le refait, pas de mot de réveil à la voix), puis des questions à boutons
// (A visiter, B ajouter, L créer avec l'IA, C remplacer, D modifier, E enlever, F sol ou murs, G essayer sur une photo,
// H mesurer, I imprimer, J projets) ou une demande écrite ou dictée (K : comprise par le workflow n8n « Maison3D
// Assistant », qui remplit ce que la phrase dit déjà). Rien n'est changé avant « Oui, fais-le » (récapitulatif), sauf ce
// que les fenêtres ouvertes par l'assistant font elles-mêmes (catalogue, panneau photo, création par l'IA) ; tout ce que
// fait un parcours devient une seule ligne « Assistant : … » de l'historique, annulée d'un coup.
// « ← Retour » rejoue le parcours sans la dernière réponse et défait ce qui a été changé depuis cette question.
import * as THREE from 'three';
import {app, $} from './app.js';
import {ETAGE_FLOOR} from './config.js';
import {PIECES, pieceEn, surface} from './pieces.js';
import {setMode, setEdition} from './vues.js';
import {allerVers, cadrerObjet} from './aller.js';
import {select, setHidden, viser} from './edition.js';
import {etatDe, normaliser, appliquerEtat} from './etats.js';
import {save} from './sauvegarde.js';
import {annuler, positionJournal, regrouper} from './historique.js';
import {lesAlertes} from './alertes.js';
import {support} from './aimant.js';
import {creerAjout, supprimerAjout} from './ajouts.js';
import {ajouterForme, placeLibre, preparerRemplacement, annulerRemplacement} from './objets.js';
import {FAMILLES, MATIERES, matiere, vignette, partiesDe} from './bibliotheque.js';
import {appliquerSurface, etatSurface} from './revetements.js';
import {FORMES} from './formes_simples.js';
import {lesVariantes, varianteCourante, verrouillee, afficherVariante, groupeDe} from './synchro.js';
import {creerVariante} from './variantes.js';
import {comparer} from './comparer.js';
import {ouvrirTableau} from './tableau.js';
import {toutOuvrir} from './portes.js';
import {lesVues, revenir} from './cameras.js';
import {ajouterMesure} from './mesure.js';
import {lireFichier} from './fichiers.js';
import {lireProduit, extraireLien} from './boutiques.js';
import {chargerProduits} from './produits.js';
import {chargerPhotos, lesPhotos, faireMontage, ouvrirGalerie} from './galerie.js';
import {ouvrirPointsVue} from './pointsliste.js';
import {ouvrirCreer} from './creer.js';
import {ouvrirPhoto, ouvrirPhotoAvec} from './photo.js';
import {ouvrirCatalogue} from './catalogue.js';
import {ouvrirImport} from './import3d.js';
import {imageMeuble} from './impression.js';

const ASSISTANT='https://n8n.srv1123557.hstgr.cloud/webhook/maison3d-assistant';
const ACCUEIL='Ciao, je suis ton assistant, comment puis-je t’aider ?';
const CIAO=/^\s*(ciao|salut|bonjour|hello|coucou|hey)\b[\s!.,]*$/i;
const jeton=()=>{ try{ return JSON.parse(localStorage.getItem('maison3d-compte')||'null')?.jeton||''; }catch{ return ''; } };
async function comprendre(corps){
  let r; try{ r=await fetch(ASSISTANT,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({...corps,jeton:jeton()}),cache:'no-store'}); }
  catch{ return {ok:false,erreur:'Pas de connexion au serveur'}; }
  return r.json().catch(()=>({ok:false,erreur:'Réponse illisible'}));
}

// ---------- petits outils ----------
const el=(t,a={},...c)=>{ const e=document.createElement(t); for(const [k,v] of Object.entries(a)) if(v!=null) e.setAttribute(k,v); e.append(...c.filter(x=>x!=null)); return e; };
const sans=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’']/g,' ');
const cm=m=>Math.round(m*100);
const dimsTexte=d=>d&&d.L?`${d.L} × ${d.P||'?'} × ${d.H||'?'} cm`:'';
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const nivDe=it=>it.lvl==='Étage'?'etage':'rez';
const sol=niv=>niv==='etage'?ETAGE_FLOOR:0;
const meubles=()=>Object.values(app.items).filter(it=>it.meta.c==='meuble'&&!it.essai);
// pièce d'un élément : celle de son centre, sinon la plus proche à moins de 80 cm (renfoncements)
function pieceDe(it){
  const x=it.g.position.x, z=it.g.position.z, niv=nivDe(it); let p=pieceEn(x,z,niv); if(p) return p;
  let best=0.8; for(const q of PIECES.filter(q=>q.niveau===niv)) for(const [x0,z0,x1,z1] of q.rects){ const d=Math.hypot(Math.max(x0-x,0,x-x1),Math.max(z0-z,0,z-z1)); if(d<best){ best=d; p=q; } }
  return p;
}
const nomObjet=it=>it.meta.l+((p=>p?' ('+p.nom.toLowerCase()+')':'')(pieceDe(it)));
// mesures écrites : « 210 × 90 × 80 », « 210x90 », « 2,10 m », « L 210 P 90 H 80 »
function lireDims(t){
  const s=String(t||'').replace(/,/g,'.'), n=[...s.matchAll(/(\d+(?:\.\d+)?)\s*(m(?![a-z])|cm)?/gi)].map(m=>{ let v=+m[1]; if(m[2]?.toLowerCase()==='m'||(!m[2]&&v<=4&&/\./.test(m[1]))) v*=100; return Math.round(v); }).filter(v=>v>0&&v<2000);
  if(!n.length) return null; const nom=/[lp]\s*\d|h\s*\d/i.test(s);
  if(nom){ const g=k=>{ const m=s.match(new RegExp(k+'\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)','i')); return m?Math.round(+m[1]*(+m[1]<=4?100:1)):null; };
    const d={L:g('l'),P:g('p'),H:g('h')}; if(d.L||d.P||d.H) return d; }
  return {L:n[0],P:n[1]||null,H:n[2]||null};
}
const COULEURS=[['bleu nuit','#1f3554'],['bleu clair','#9cc3e6'],['bleu ciel','#9cc3e6'],['vert sauge','#9cab8e'],['vert sapin','#2f5a43'],['vert d eau','#9fc7b5'],['gris clair','#c9cbcc'],['gris fonce','#55595c'],
  ['bordeaux','#6f1f2b'],['rouge','#b0302a'],['rose','#e4a3b0'],['orange','#d9792b'],['jaune','#e3c24a'],['moutarde','#c99a2e'],['vert','#3f7d4e'],['kaki','#6b6a3c'],['bleu','#2f5d9e'],
  ['turquoise','#2a9d9a'],['violet','#6b4c8a'],['aubergine','#4a2a3d'],['marron','#6b4a2e'],['brun','#6b4a2e'],['chocolat','#4a3020'],['beige','#d8c7a8'],['creme','#e9e0cc'],['ecru','#efe8d8'],
  ['blanc','#f2f0ea'],['anthracite','#3b4045'],['gris','#8a8d90'],['noir','#1d1c1c'],['taupe','#8b7d6b'],['cognac','#8a4b22'],['dore','#c9a24a'],['or','#c9a24a'],['argent','#c0c4c8'],['terracotta','#b5643c']];
const MOTS_MATIERE=[['chene clair','chene-clair'],['bois clair','chene-clair'],['bois fonce','wenge'],['wenge','wenge'],['chene','chene'],['noyer','noyer'],['hetre','hetre'],['pin','pin'],['rotin','rotin'],['cannage','rotin'],
  ['velours','velours'],['bouclette','bouclette'],['lin','lin'],['tissu','toile'],['toile','toile'],['simili','simili'],['cuir','cuir'],['laque','laque'],['inox','inox'],['chrome','chrome'],['aluminium','alu'],['alu','alu'],
  ['laiton','laiton'],['cuivre','cuivre'],['metal','metal-noir'],['verre fume','verre-fume'],['verre','verre'],['marbre gris','marbre-gris'],['marbre','marbre'],['granit','granit'],['beton cire','beton-cire'],['beton','beton'],
  ['terrazzo','terrazzo'],['pierre','pierre'],['ceramique','ceramique'],['faience','faience'],['brique','brique'],['parquet clair','parquet-clair'],['parquet fonce','parquet-fonce'],['chevron','chevron'],['parquet','parquet'],
  ['carrelage','carrelage-60'],['tomette','tomettes'],['moquette','moquette'],['vinyle','vinyle'],['plastique','plastique'],['peinture','peinture'],['mat','mat']];
// « cuir rouge » → {i:'cuir', c:'#b0302a'} ; une couleur seule → {c}
function lireAspect(t){
  const s=' '+sans(t)+' ', mot=k=>new RegExp('[^a-z]'+k.replace(/ /g,' +')+'s?[^a-z]').test(s);
  const c=COULEURS.find(([k])=>mot(k))?.[1]||null; let i=MOTS_MATIERE.find(([k])=>mot(k))?.[1]||null;
  if(!i){ const m=MATIERES.find(m=>m.i!=='autre'&&s.includes(' '+sans(m.n)+' ')); if(m) i=m.i; }
  return i||c?{i,c}:null;
}
const texteAspect=a=>a?[a.i?matiere(a.i)?.n:null,a.c?(COULEURS.find(x=>x[1]===a.c)?.[0]||a.c):null].filter(Boolean).join(', '):'';

// ---------- moteur du parcours : questions, rejeu pour « Retour » ----------
class Stop extends Error{}
let debutFait=0, pan=null, fil=null, carte=null, gen=0, attente=null, reponses=[], rejeu=[], flux=null, debut=0, conclusion=null, nettoyages=[], jointe=null, voix=false;
function demander(cle,c){
  if(rejeu.length){ if(rejeu[0].cle===cle){ const r=rejeu.shift(); reponses.push(r); tracer(c,r.rep); return Promise.resolve(r.rep); } rejeu=[]; }
  const g=gen, pos=positionJournal();
  return new Promise((ok,ko)=>{
    attente={c,ko,ok:rep=>{ if(g!==gen) return; attente=null; reponses.push({cle,rep,pos}); tracer(c,rep); ok(rep); }};
    dessiner(c);
  });
}
// étape qui agit (fenêtre ouverte, attente d'un objet, appel au serveur) : gardée pour le rejeu, sans être refaite
async function etape(cle,c,fn){
  if(rejeu.length){ if(rejeu[0].cle===cle){ const r=rejeu.shift(); reponses.push(r); return r.rep; } rejeu=[]; }
  const g=gen, pos=positionJournal();
  const abandon=new Promise((ok,ko)=>{ attente={c,ko,ok:rep=>{ if(g===gen){ attente=null; ok({abandon:rep}); } }}; });
  dessiner(c);
  const rep=await Promise.race([fn(),abandon]); if(g!==gen) throw new Stop();
  attente=null; carte?.remove(); carte=null;
  if(rep&&rep.abandon) return rep;
  reponses.push({cle,rep,pos}); return rep;
}
const verifier=g=>{ if(g!==gen) throw new Stop(); };
function demarrer(f,rj=[],garderFil=false){
  conclure(); gen++; if(attente){ const k=attente.ko; attente=null; k(new Stop()); }
  for(const n of nettoyages.splice(0)) try{ n(); }catch{}
  if(!rj.length) debut=positionJournal();
  reponses=[]; rejeu=rj; flux=f; carte?.remove(); carte=null; if(!garderFil) fil.replaceChildren();
  const g=gen;
  Promise.resolve().then(()=>f()).catch(e=>{ if(e instanceof Stop||g!==gen) return; console.warn(e); dire('Oups, quelque chose n’a pas marché : '+(e?.message||e)); menu(false); });
}
// nouveau parcours à la suite (le fil reste) : le parcours en cours s'arrête là
function nouveau(f){ demarrer(f,[],true); throw new Stop(); }
function retour(){
  if(!reponses.length) return;
  const r=reponses.pop(); while(positionJournal()>r.pos&&annuler());
  conclusion=null; demarrer(flux,reponses.slice());
}
// fin d'un parcours qui a changé la maquette : une seule ligne d'historique
function conclure(){ if(!conclusion) return; const t=conclusion; conclusion=null; debutFait=debut; if(positionJournal()>debut) regrouper(debut,'Assistant : '+t); }
function toutDefaire(d=debut){ conclusion=null; while(positionJournal()>d&&annuler()); }

// ---------- affichage ----------
function msg(qui,t,lignes){
  const m=el('div',{class:'as-msg '+qui}); m.append(el('p',{},t));
  if(lignes?.length){ const u=el('ul'); for(const l of lignes) u.append(el('li',{},l)); m.append(u); }
  fil.append(m); fil.scrollTop=fil.scrollHeight; return m;
}
function dire(t,lignes){ msg('lui',t,lignes); parler(t); }
function tracer(c,rep){
  carte?.remove(); carte=null;
  if(c.titre) msg('lui',c.titre,c.lignes);
  const t=rep?.texte??rep?.l; if(t) msg('moi',t);
}
function dessiner(c){
  carte?.remove(); const k=el('div',{class:'as-carte'+(c.attente?' attente':'')});
  if(c.titre) k.append(el('p',{class:'as-titre'},c.titre));
  if(c.lignes?.length){ const u=el('ul'); for(const l of c.lignes) u.append(el('li',{},l)); k.append(u); }
  if(c.aide) k.append(el('p',{class:'as-aide'},c.aide));
  if(c.cout) k.append(el('p',{class:'as-cout'},c.cout));
  if(c.attente){ k.append(el('span',{class:'as-points','aria-hidden':'true'},el('i'),el('i'),el('i')));
    const sv=el('div',{class:'as-suivi',hidden:''}); sv.append(el('p',{class:'as-suivi-t',role:'status'}),el('span',{class:'ph-barre','aria-hidden':'true'},el('i')),el('p',{class:'as-suivi-temps'})); k.append(sv); }
  if(c.choix?.length){
    const z=el('div',{class:'as-choix'+(c.vign?' vign':c.choix.length>6&&c.choix.every(x=>x.l.length<34&&!x.sous)?' deux':'')});
    for(const ch of c.choix){
      const b=el('button',{type:'button',class:'as-btn'+(ch.prim?' prim':'')+(ch.img?' img':'')});
      if(ch.img) b.append(el('img',{src:ch.img,alt:'',loading:'lazy'}));
      if(ch.teinte) b.append(el('span',{class:'as-teinte',style:'background:'+ch.teinte}));
      b.append(el('span',{class:'as-l'},ch.l)); if(ch.sous) b.append(el('span',{class:'as-sous'},ch.sous));
      b.onclick=()=>{ if(ch.retour){ retour(); return; } if(attente) attente.ok({v:ch.v,l:ch.l}); };
      z.append(b);
    }
    k.append(z);
  }
  const t=$('as-texte'); t.placeholder=c.libre?.ph||'Écris ta demande, ou touche le micro…'; t.dataset.libre=c.libre?'1':'';
  fil.append(k); carte=k;
  fil.scrollTop=Math.min(k.offsetTop-6,fil.scrollHeight-fil.clientHeight);   // le haut de la carte reste visible (et le buste au départ)
  if(fil.firstChild?.classList.contains('as-accueil')&&k.offsetTop+k.offsetHeight<=fil.clientHeight+4) fil.scrollTop=0;
  if(c.titre) parler(c.titre);
  if(c.attente) majSuiviTripo();
  $('as-retour').disabled=!reponses.length;
}
function parler(t){
  if(!voix||!t||!('speechSynthesis' in window)) return;
  try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(t); u.lang='fr-FR'; speechSynthesis.speak(u); }catch{}
}
const ch=(l,v,o={})=>({l,v,...o});

// ---------- accueil et premier choix ----------
const BRANCHES=[['A','Visiter, me promener'],['B','Ajouter un objet'],['L','Créer un objet avec l’IA'],['C','Remplacer un objet'],['D','Modifier un objet'],['E','Enlever un objet'],
  ['F','Changer un sol ou un mur'],['G','Essayer sur une photo de la pièce'],['H','Mesurer, vérifier la place'],['I','Imprimer ou partager'],['J','Mes projets']];
async function accueil(){
  const a=el('div',{class:'as-accueil'}); a.append(el('img',{src:'icones/assistant.webp',alt:'Mauro, ton assistant',class:'as-buste'}),el('p',{class:'as-bulle'},ACCUEIL));
  fil.append(a); parler(ACCUEIL);
  await menu(true);
}
async function menu(premier){
  const r=await demander('q0',{titre:premier?'':'Autre chose ?',aide:'Touche un choix, ou écris (ou dis) ta demande avec tes mots.',libre:null,
    choix:BRANCHES.map(([k,l])=>ch(l,k))});
  await brancher(r.v,{});
}
async function brancher(b,o){
  const f={A:visiter,B:ajouter,L:creerIA,C:remplacerObjet,D:modifier,E:enlever,F:solMur,G:surPhoto,H:mesurer,I:imprimer,J:projets}[b];
  if(f) await f(o); else { dire('Je n’ai pas bien compris. Choisis ce que tu veux faire :'); await menu(false); }
}
async function finir(titre,lignes,plus=[]){
  const r=await demander('fin',{titre,lignes,choix:[...plus,ch('Autre chose','autre')]});
  const p=plus.find(x=>x.v===r.v); conclure();
  nouveau(p?.go||(()=>menu(false)));
}

// ---------- étapes communes ----------
// projet modifiable : une base (Base d'origine ou base créée) ne se modifie pas : copie proposée
async function projet(){
  if(!app.mobilierPret){ dire('La maquette se charge encore : réessaie dans un instant.'); throw new Stop(); }
  const v=varianteCourante(), rejoue=rejeu[0]?.cle==='projet';
  if(!verrouillee(v)&&!rejoue){ if(!app.edition) setEdition(true,false); return; }
  const n=lesVariantes().filter(x=>!x.fixe).length+1, nom='Projet '+n;
  const autres=lesVariantes().filter(x=>!verrouillee(x)&&!x.masquee);
  const r=await demander('projet',{titre:`Tu regardes « ${v?.nom||'Base'} », qui ne se modifie pas. Je fais une copie pour y travailler ?`,
    aide:'La copie garde tout ce qu’il y a dans ce projet ; l’original ne change pas.',
    choix:[ch(`Oui, crée « ${nom} »`,'copie',{prim:true}),...(autres.length?[ch('Non, prends un autre projet','autre')]:[])]});
  const w=r.v==='copie'?null:await demander('projet-choix',{titre:'Dans quel projet ?',choix:autres.map(x=>ch(x.nom,x.id))});
  await etape('projet-fait',{titre:w?'J’ouvre le projet…':`Je crée « ${nom} »…`,attente:true},async()=>{
    if(w) await afficherVariante(w.v); else await creerVariante(nom);
    return varianteCourante()?.id||null;
  });
  if(verrouillee(varianteCourante())){ dire('Je n’ai pas pu ouvrir un projet modifiable (connexion ?). Réessaie dans un moment.'); throw new Stop(); }
  if(!rejoue) debut=positionJournal();   // autre projet, autre journal : le parcours part de là
  setEdition(true,false);
}
async function choisirPiece(cle,titre,o={}){
  const l=PIECES.filter(p=>!o.niveau||p.niveau===o.niveau).filter(o.filtre||(()=>true));
  const r=await demander(cle,{titre,aide:o.aide,choix:l.map(p=>ch(p.nom,p.id,{sous:o.sous?o.sous(p):(p.niveau==='etage'?'étage':'rez')}))});
  return PIECES.find(p=>p.id===r.v);
}
// toucher un objet dans la 3D : le prochain toucher bref de la vue est pour l'assistant (main.js)
function toucherObjet(){
  return new Promise(ok=>{
    app.viseAssistant=(x,y)=>{ const h=viser(x,y); let o=h?.object; while(o&&!app.items[o.name]) o=o.parent; const it=o&&app.items[o.name];
      if(it&&it.meta.c!=='fixe'){ app.viseAssistant=null; ok(it.name); } };
    nettoyages.push(()=>{ app.viseAssistant=null; });
  });
}
function chercherObjets(t){
  const mots=sans(t).split(/[^a-z0-9]+/).filter(m=>m.length>2&&!['les','des','une','sur','dans','pres','avec','mon','mes','celui','celle','qui','est','pour','par','cette'].includes(m));
  if(!mots.length) return [];
  const res=[]; for(const it of Object.values(app.items)){ if(it.meta.c==='fixe'||it.essai) continue;
    const nom=sans(it.meta.l), p=pieceDe(it), pn=p?sans(p.nom):''; let s=0;
    for(const m of mots){ const r=m.slice(0,Math.max(4,m.length-1)); if(nom.split(/[^a-z0-9]+/).some(w=>w.startsWith(r)||r.startsWith(w)&&w.length>3)) s+=2; else if(pn.includes(r)) s+=1; }
    if(s>0) res.push([s-(it.hidden?0.5:0),it]); }
  res.sort((a,b)=>b[0]-a[0]); const top=res[0]?.[0]; return res.filter(x=>x[0]>=top-0.5).map(x=>x[1]);
}
// choisir un objet de la maquette : le toucher, dans la liste par pièce, ou le décrire
async function choisirObjet(cle,question,o={}){
  let nom=o.objet&&app.items[o.objet]?o.objet:null;
  while(true){
    if(!nom){
      const enEdition=app.mode!=='plan';
      const r=await demander(cle,{titre:question,aide:'Touche-le, choisis-le dans une liste, ou décris-le avec tes mots.',libre:{ph:'Ex. « la lampe sur le buffet »'},
        choix:[...(enEdition?[ch('Je le touche dans la 3D','toucher')]:[]),ch('Je le choisis dans la liste','liste'),ch('Je le décris','decrire')]});
      if(r.v==='toucher'){
        nom=await etape(cle+'-t',{titre:'Touche l’objet dans la 3D',aide:'Tourne la vue si besoin, puis touche l’objet une fois.',attente:true,choix:[ch('Plutôt dans la liste','liste')]},toucherObjet);
        if(nom?.abandon){ nom=null; app.viseAssistant=null; }
        if(!nom){ nom=await parListe(cle,o); }
      } else if(r.v==='liste') nom=await parListe(cle,o);
      else { const t=r.texte||(await demander(cle+'-d',{titre:'Décris-le',libre:{ph:'Ex. « la lampe sur le buffet »'},choix:[]})).texte;
        const l=chercherObjets(t);
        if(!l.length){ dire(`Je ne trouve rien qui ressemble à « ${t} ».`); continue; }
        if(l.length===1) nom=l[0].name;
        else { const w=await demander(cle+'-3',{titre:`J’en trouve ${l.length>3?'plusieurs':l.length}. Lequel ?`,choix:[...l.slice(0,6).map(it=>ch(nomObjet(it),it.name)),ch('Aucun de ceux-là','aucun')]});
          if(w.v==='aucun') continue; nom=w.v; } }
    }
    const it=app.items[nom]; if(!it){ nom=null; continue; }
    if(!it.hidden) cadrerObjet(it);
    if(o.sansConfirmer) return it;
    const ok=await demander(cle+'-ok',{titre:`C’est bien « ${nomObjet(it)} » ?`,aide:'La vue se cadre sur lui.',choix:[ch('Oui','oui',{prim:true}),ch('Non, un autre','non')]});
    if(ok.v==='oui') return it;
    nom=null; o={...o,objet:null};
  }
}
async function parListe(cle,o){
  const p=await choisirPiece(cle+'-p','Dans quelle pièce ?',{filtre:q=>meubles().some(it=>!it.hidden===!o.masques&&pieceDe(it)===q),sous:q=>meubles().filter(it=>pieceDe(it)===q&&!it.hidden).length+' objets'});
  const l=meubles().filter(it=>pieceDe(it)===p&&(o.masques?true:!it.hidden)).sort((a,b)=>a.meta.l.localeCompare(b.meta.l,'fr'));
  const r=await demander(cle+'-l',{titre:'Lequel ?',choix:l.map(it=>ch(it.meta.l+(it.hidden?' (masqué)':''),it.name))});
  return r.v;
}
// création Tripo en cours (panneau photo, évènement « tripo-progres ») : l'avancement s'affiche aussi dans la carte où
// l'assistant attend l'objet ; le panneau photo peut être fermé pendant ce temps (Mauro, 13 octobre 2026)
let tripo=null;
addEventListener('tripo-progres',e=>{ tripo=e.detail; majSuiviTripo(); });
function majSuiviTripo(){
  const sv=carte?.querySelector('.as-suivi'); if(!sv) return;
  const d=tripo, voir=!!d&&(d.actif||d.phase==='pret'); sv.hidden=!voir; if(!voir) return;
  sv.querySelector('.as-suivi-t').textContent=d.phase==='pret'?`« ${d.nom} » est prêt : vérifie ses dimensions dans la fenêtre « Fichier 3D », puis touche « Ajouter ».`
    :d.titre+(d.phase==='creation'?' · '+d.p+' %':'')+'. Tu peux fermer le panneau photo : je te tiens au courant ici.';
  const b=sv.querySelector('.ph-barre'); b.querySelector('i').style.width=d.p+'%'; b.classList.toggle('indetermine',d.phase==='envoi'||d.phase==='attente');
  sv.querySelector('.as-suivi-temps').textContent=d.phase==='pret'?'':d.temps;
}
// panneau photo → « L'essayer d'abord sur une photo de la pièce » : le parcours suit le montage au lieu d'attendre un objet
function suivreMontage(ok){ const f=e=>{ removeEventListener('essai-montage',f); ok({montage:e.detail.nom}); }; addEventListener('essai-montage',f); nettoyages.push(()=>removeEventListener('essai-montage',f)); }
// d'où vient le nouvel objet ; renvoie le nom de l'objet ajouté (il est déjà dans la maquette)
const SOURCES=[['forme','Une forme simple','table, armoire, lampe… à tes mesures'],['catalogue','Le catalogue 3D gratuit','Poly Haven, Sketchfab'],['photo','Une photo ou une image','image plate, ou vraie 3D par Tripo'],
  ['lien','Le lien d’un produit','IKEA, Pfister, Conforama…'],['produits','Un de mes produits','ta liste « Produits »'],['ia','Le générer avec l’IA','d’après ta description'],['fichier','Un fichier 3D','.glb, .obj, .fbx…'],['propose','Je ne sais pas, propose-moi','je cherche dans le catalogue']];
async function source(o){
  let s=o.source;
  if(o.image&&!s) s='photo';
  if(!s||!SOURCES.some(x=>x[0]===s)){ const r=await demander('source',{titre:'D’où vient le nouvel objet ?',choix:SOURCES.map(([k,l,sous])=>ch(l,k,{sous}))}); s=r.v; }
  const attendreAjout=(texte,ouvrir)=>etape('ajout-'+s,{titre:texte,aide:'Je t’attends : dès que l’objet est posé, je continue.',attente:true,choix:[ch('Je laisse tomber','stop')]},()=>new Promise(ok=>{
    const f=e=>{ removeEventListener('objet-ajoute',f); ok(e.detail.nom); };
    addEventListener('objet-ajoute',f); nettoyages.push(()=>removeEventListener('objet-ajoute',f)); suivreMontage(ok); ouvrir();
  }));
  let nom;
  if(s==='forme'){
    const f=o.forme&&FORMES[o.forme]?o.forme:(await demander('forme',{titre:'Quel genre d’objet ?',choix:Object.entries(FORMES).map(([k,v])=>ch(v.nom,k))})).v;
    nom=await etape('ajout-forme',{titre:'Je le pose…',attente:true},async()=>{ const it=ajouterForme(f); return it?.name||app.selected?.name||null; });
  } else if(s==='catalogue'||s==='propose'){
    let q=o.description||'';
    if(s==='propose'||!q){ const r=await demander('cat-q',{titre:s==='propose'?'Décris-le en quelques mots':'Que cherches-tu ?',libre:{ph:'Ex. « fauteuil en velours vert »'},choix:q?[ch(q,q)]:[]}); q=r.texte||r.v; }
    nom=await attendreAjout('Choisis le modèle dans le catalogue, puis « Ajouter »',()=>{ ouvrirCatalogue(true); setTimeout(()=>{ const i=document.querySelector('#cat-q'); if(i&&q){ i.value=q; i.form?.requestSubmit(); } },50); });
  } else if(s==='photo'){
    if(o.image) nom=await avecImage(o.image,{nom:o.description,...(o.dims||{})},o);
    else nom=await attendreAjout('Ajoute la photo du meuble dans le panneau photo',()=>ouvrirPhoto(true));
  } else if(s==='lien'){
    let u=o.lien; if(!u){ const r=await demander('lien',{titre:'Colle le lien du produit',libre:{ph:'https://www.ikea.com/ch/fr/p/…'},choix:[]}); u=extraireLien(r.texte||'')||r.texte; }
    const p=await etape('lien-lu',{titre:'Je lis la page du produit…',attente:true},async()=>{ const r=await lireProduit(u); return r.ok&&r.image?{image:r.image,nom:r.nom,dims:r.dims||{},site:r.site,lien:u}:{erreur:r.erreur||'page refusée'}; });
    if(p.erreur){ dire(`Cette boutique refuse la lecture (${p.erreur}) : copie l’image du produit et colle-la dans le panneau photo.`);
      nom=await attendreAjout('Colle l’image dans le panneau photo',()=>ouvrirPhoto(true)); }
    else { dire(`J’ai trouvé « ${p.nom||'le produit'} »${p.dims?.L?', '+dimsTexte(p.dims):''}.`);
      nom=await avecImage(await (await fetch(p.image)).blob(),{nom:p.nom,...p.dims,origine:{produit:true,site:p.site||'boutique',titre:String(p.nom||'Produit').slice(0,80),lien:u}},o); }
  } else if(s==='produits'){
    const l=await etape('produits-lus',{titre:'Je lis ta liste « Produits »…',attente:true},async()=>(await chargerProduits()).map(p=>p.id));
    const prods=(await chargerProduits()).filter(p=>l.includes(p.id));
    if(!prods.length){ dire('Ta liste « Produits » est vide.'); return source({...o,source:null}); }
    const r=await demander('produit',{titre:'Lequel de tes produits ?',vign:true,choix:prods.slice(0,12).map(p=>ch(p.nom,p.id,{img:p.vignette||null,sous:dimsTexte(p)}))});
    const p=prods.find(x=>x.id===r.v);
    const b=await etape('produit-image',{titre:'Je lis son image…',attente:true},async()=>p.image?.id?await lireFichier(p.image.id,p.image.n||1,p.image.type||'image/jpeg'):null);
    if(!b){ dire('L’image du produit n’a pas pu être lue.'); return source({...o,source:null}); }
    nom=await avecImage(b,{nom:p.nom,L:p.L,P:p.P,H:p.H,origine:{produit:true,site:p.boutique||'boutique',titre:String(p.nom||'Produit').slice(0,80),lien:p.lien||''}},o);
  } else if(s==='ia'){
    nom=await attendreAjout('Décris l’objet dans la fenêtre « Créer avec l’IA » (modèle, nombre de propositions), puis choisis « Image plate » ou « Vraie 3D »',
      ()=>ouvrirCreer({description:o.description||'',nom:o.nomObjet||'',dims:o.dims||null}));
  } else if(s==='fichier'){
    nom=await attendreAjout('Choisis le fichier 3D dans la fenêtre d’import, puis « Ajouter »',()=>ouvrirImport(true));
  }
  if(nom?.abandon){ annulerRemplacement(); dire('D’accord, on laisse tomber.'); nouveau(()=>menu(false)); }
  if(nom?.montage){ annulerRemplacement(); await finir('Le montage s’ouvre',[`Choisis la photo de la pièce : « ${nom.montage} » y sera posé à sa taille. Place-le, puis « Lancer le rendu » (les crédits sont demandés avant).`,
    'Si le résultat te plaît, « Mettre en 3D » dans le montage le met ensuite dans la maquette.']); }
  return nom;
}
// une image (photo, produit, lien) : image plate tout de suite ou vraie 3D par Tripo
async function avecImage(blob,info,o){
  const r=await demander('rendu-3d',{titre:'Comment le montrer dans la maquette ?',aide:'L’image plate est prête tout de suite et gratuite, mais n’est juste que de face ; la vraie 3D se voit de tous les côtés.',
    choix:[ch('En image plate (tout de suite, gratuit)','plat',{prim:true}),ch('En vraie 3D (environ 2 min, 20 à 40 crédits Tripo selon les textures)','3d')]});
  const d=o.dims||{}, i={nom:info.nom||'Objet',L:info.L||d.L,P:info.P||d.P,H:info.H||d.H,origine:info.origine};
  return etape('ajout-image',{titre:r.v==='plat'?(i.L&&i.P&&i.H?'Je le pose…':'Complète ses dimensions dans le panneau photo, puis « Ajouter en photo »'):'Dans le panneau photo, choisis les textures et confirme « Oui, créer en 3D » : Tripo crée le modèle (1 à 3 min)',
    aide:'Je t’attends : dès que l’objet est posé, je continue.',attente:true,choix:[ch('Je laisse tomber','stop')]},()=>new Promise(ok=>{
    const f=e=>{ removeEventListener('objet-ajoute',f); ok(e.detail.nom); };
    addEventListener('objet-ajoute',f); nettoyages.push(()=>removeEventListener('objet-ajoute',f)); suivreMontage(ok);
    ouvrirPhotoAvec(blob,i,false).then(()=>{ if(r.v==='plat'){ if(i.L&&i.P&&i.H) document.querySelector('#ph-ajouter')?.click(); }
      else document.querySelector('#ph-tripo')?.click(); });
  }));
}
// taille : la garder, celle de l'ancien (remplacement), ou des mesures données
async function taille(it,o={}){
  const s=it.size, act={L:cm(s.x),P:cm(s.z),H:cm(s.y)};
  if(o.dims?.L) return {...act,...Object.fromEntries(Object.entries(o.dims).filter(([,v])=>v))};
  const anc=o.ancien&&{L:cm(o.ancien.size.x),P:cm(o.ancien.size.z),H:cm(o.ancien.size.y)};
  const r=await demander('taille',{titre:'Quelle taille ?',libre:{ph:'L × P × H en cm, ex. 210 × 90 × 80'},
    choix:[ch(`Garder ${dimsTexte(act)}`,'garder',{prim:true}),...(anc?[ch(`La même que l’ancien (${dimsTexte(anc)})`,'ancien')]:[]),ch('Je donne les mesures','mesures')]});
  if(r.v==='garder') return null; if(r.v==='ancien') return anc;
  let t=r.texte; if(!t) t=(await demander('taille-m',{titre:'Donne les mesures',libre:{ph:'L × P × H en cm, ex. 210 × 90 × 80'},choix:[]})).texte;
  const d=lireDims(t); if(!d){ dire('Je n’ai pas compris ces mesures.'); return null; }
  return {L:d.L||act.L,P:d.P||act.P,H:d.H||act.H};
}
// où le poser : place libre d'une pièce, à la place d'un objet, sur un meuble, ou là où il est
async function place(it,o={}){
  if(o.piece&&PIECES.some(p=>p.id===o.piece)&&(it.ajout||PIECES.find(p=>p.id===o.piece).niveau===nivDe(it))) return {type:'piece',piece:o.piece};
  const r=await demander('place',{titre:'Où veux-tu le poser ?',choix:[ch('Dans une pièce, à une place libre','piece'),ch('À la place d’un objet','objet'),ch('Sur un meuble','sur'),ch('Là où il est (je le placerai moi-même)','ici')]});
  if(r.v==='piece'){ const p=await choisirPiece('place-p','Dans quelle pièce ?',{niveau:it.ajout?null:nivDe(it),aide:'Je cherche une place libre, en gardant 80 cm de passage si possible.'}); return {type:'piece',piece:p.id}; }
  if(r.v==='objet'){ const a=await choisirObjet('place-o','À la place de quel objet ?'); if(a===it) return {type:'ici'}; return {type:'objet',nom:a.name}; }
  if(r.v==='sur'){ const a=await choisirObjet('place-s','Sur quel meuble ?'); return {type:'sur',nom:a.name}; }
  return {type:'ici'};
}
const textePlace=pl=>!pl||pl.type==='ici'?null:pl.type==='piece'?'le poser dans '+(PIECES.find(p=>p.id===pl.piece)?.nom||'').toLowerCase()+', à une place libre'
  :pl.type==='objet'?`le poser à la place de « ${app.items[pl.nom]?.meta.l} » (masqué, on peut le remettre)`:`le poser sur « ${app.items[pl.nom]?.meta.l} »`;
// couleur et matière (tout l'objet ou une partie)
async function aspect(cle,o={},cible='objet'){
  if(o.aspect) return o.aspect;
  const r=await demander(cle,{titre:'Couleur et matière ?',aide:cible==='objet'?'Un modèle 3D ou une photo garde son aspect, sauf si tu demandes autre chose.':null,libre:{ph:'Ex. « cuir rouge », « chêne clair », « vert sauge »'},
    choix:[ch(cible==='objet'?'Comme il est':'Ne rien changer','garder',{prim:cible==='objet'}),ch('Je la décris','decrire'),ch('Je choisis dans la bibliothèque','choisir')]});
  if(r.v==='garder') return null;
  if(r.texte||r.v==='decrire'){ const t=r.texte||(await demander(cle+'-d',{titre:'Décris la couleur et la matière',libre:{ph:'Ex. « cuir rouge »'},choix:[]})).texte;
    const a=lireAspect(t); if(!a){ dire(`Je ne reconnais ni couleur ni matière dans « ${t} ».`); return aspect(cle,o,cible); }
    dire('J’ai compris : '+texteAspect(a)+'.'); return a; }
  const fams=cible==='sol'?['Sols','Bois','Pierre et céramique','Tissus']:cible==='murs'?['Finitions','Pierre et céramique','Bois','Autres']:FAMILLES.filter(f=>f!=='Autres');
  const f=await demander(cle+'-f',{titre:'Quelle famille ?',choix:fams.map(x=>ch(x,x))});
  const l=MATIERES.filter(m=>m.f===f.v&&m.i!=='autre');
  const m=await demander(cle+'-m',{titre:'Quelle matière ?',vign:true,choix:l.map(x=>ch(x.n,x.i,{img:vignette(x,72).toDataURL()}))});
  const c=await demander(cle+'-c',{titre:'Quelle couleur ?',libre:{ph:'Ex. « bleu nuit »'},choix:[ch('Celle de la matière','aucune',{prim:true}),...COULEURS.filter(([k])=>['bordeaux','anthracite','vert sapin','creme','bleu nuit','blanc','noir','gris clair','beige','vert sauge'].includes(k))
    .map(([k,v])=>ch(k[0].toUpperCase()+k.slice(1).replace('creme','crème'),v,{teinte:v}))]});
  let coul=c.v==='aucune'?null:c.v; if(c.texte){ coul=lireAspect(c.texte)?.c||null; }
  return {i:m.v,c:coul};
}
// vérification après coup : alertes de passage qui concernent l'objet (calculées à la prochaine image)
async function alertesDe(noms){ await pause(450); return lesAlertes().filter(a=>!a.ignoree&&a.noms.some(n=>noms.includes(n))).map(a=>a.texte); }
// applique un plan sur un objet (une seule sauvegarde)
function appliquer(it,pl){
  const e=etatDe(it);
  if(pl.taille){ const {L,P,H}=pl.taille;
    if(it.ajout&&e.a?.p) e.a={...e.a,p:{...e.a.p,L:L/100,P:P/100,H:H/100}};
    else if(it.size0) e.s=[+(L/100/it.size0.x).toFixed(4),+(H/100/it.size0.y).toFixed(4),+(P/100/it.size0.z).toFixed(4)]; }
  if(pl.aspect){ const parts=partiesDe(it), {i,c}=pl.aspect;
    if(i){ const m={...(e.m||{})}; for(const p of parts) if(!pl.partie||pl.partie===p.cle) m[p.cle]={i,c:c||null}; e.m=m; }
    else if(c){ if(pl.partie){ const m={...(e.m||{})}, a=m[pl.partie]; m[pl.partie]={i:a?.i||'mat',c}; e.m=m; } else e.c=c; } }
  if(pl.r!=null) e.r=pl.r;
  if(pl.pos){ e.x=pl.pos.x; e.z=pl.pos.z; }
  const lieu=pl.place;
  if(lieu?.type==='piece'){ const sz=pl.taille?{x:pl.taille.L/100,z:pl.taille.P/100}:{x:it.size.x,z:it.size.z};
    const quart=Math.abs(Math.sin(e.r||0))>0.7, L=quart?sz.z:sz.x, P=quart?sz.x:sz.z;
    const hidden=it.hidden; it.g.visible=false; const q=placeLibre(L,P,lieu.piece); it.g.visible=!hidden;
    if(q){ e.x=q.x; e.z=q.z; if(it.ajout) e.a={...e.a,v:q.niv,y:+q.y.toFixed(4),e:0}; else e.dy=0; } }
  if(lieu?.type==='objet'){ const a=app.items[lieu.nom]; e.x=a.g.position.x; e.z=a.g.position.z; e.r=a.g.rotation.y;
    if(it.ajout){ const niv=nivDe(a); e.a={...e.a,v:niv,y:sol(niv),e:0}; } }
  if(lieu?.type==='sur'){ const a=app.items[lieu.nom]; e.x=a.g.position.x; e.z=a.g.position.z; if(it.ajout){ const niv=nivDe(a); e.a={...e.a,v:niv,y:sol(niv),e:0}; } }
  appliquerEtat(it,normaliser(it.name,e));
  if(lieu?.type==='sur'){ it.g.updateMatrixWorld(true); app.model.updateMatrixWorld(true); const y=support(it), e2=etatDe(it);
    if(it.ajout) e2.a={...e2.a,e:+Math.max(0,y-(+e2.a.y||0)).toFixed(4)}; else e2.dy=+(y-it.home.y).toFixed(4);
    appliquerEtat(it,normaliser(it.name,e2)); }
  if(lieu?.type==='objet'){ const a=app.items[lieu.nom]; if(a&&!a.hidden) setHidden(a,true); }
}
// récapitulatif : « Oui, fais-le » / « Changer une étape » / « Annuler »
async function recap(lignes,cout){
  const r=await demander('recap',{titre:'Voici ce que je vais faire',lignes,cout:cout||'Gratuit',choix:[ch('Oui, fais-le','oui',{prim:true}),ch('Changer une étape','',{retour:true}),ch('Annuler','non')]});
  if(r.v==='non'){ toutDefaire(); dire('C’est annulé : la maquette est comme avant.'); nouveau(()=>menu(false)); }
}
const defaire=()=>ch('Annuler ce que tu viens de faire','defaire',{go:async()=>{ toutDefaire(debutFait); dire('C’est annulé : la maquette est comme avant.'); await menu(false); }});
const finObjet=it=>[ch('Le voir en 1re personne','voir',{go:async()=>{ setMode('walk'); await pause(80); cadrerObjet(it); await finir('Tu es devant',[]); }}),
  ch('L’essayer sur une photo de la pièce','photo',{go:async()=>{ await surPhoto({piece:pieceDe(it)?.id,objet:it.name}); }}),defaire()];
async function apresAction(it,titre,texte){
  conclusion=texte;
  if(it&&!it.hidden){ select(it.name); cadrerObjet(it); }
  const al=it?await alertesDe([it.name]):[];
  await finir(titre,al.length?['Attention : '+al.join(' ; ')+'.','Tu peux le laisser comme ça, ou « ← Retour » pour choisir une autre place.']:['C’est dans l’historique : « Assistant : '+texte+' ».'],it?finObjet(it):[]);
}

// ---------- A. Visiter ----------
async function visiter(o){
  let p=o.piece&&PIECES.find(x=>x.id===o.piece);
  if(!p){
    const vues=lesVues();
    const r=await demander('a-ou',{titre:'Où veux-tu aller ?',choix:[...PIECES.map(x=>ch(x.nom,x.id,{sous:x.niveau==='etage'?'étage':'rez'})),ch('Là où une photo a été prise','photo'),...(vues.length?[ch('Une vue que j’ai enregistrée','vue')]:[])]});
    if(r.v==='photo'){ ouvrirPointsVue(true); await finir('Touche une photo : je t’emmène là où elle a été prise',['« Y aller » sur chaque photo.']); return; }
    if(r.v==='vue'){ const v=await demander('a-vue',{titre:'Quelle vue ?',choix:vues.map(x=>ch(x.nom,x.id))}); revenir(v.v); await finVisite(); return; }
    p=PIECES.find(x=>x.id===r.v);
  }
  let m=o.mode==='1re'?'walk':o.mode==='maquette'?'orbit':o.mode==='plan'?'plan':null;
  if(!m) m=(await demander('a-mode',{titre:'Comment veux-tu la voir ?',choix:[ch('Comme si j’y étais (1re personne)','walk',{prim:true}),ch('Vue d’ensemble (maquette)','orbit'),ch('Plan vu de dessus','plan')]})).v;
  if(app.mode!==m) setMode(m);
  await pause(60); allerVers(p.id);
  await finVisite(m);
}
async function finVisite(m=app.mode){
  await finir('Tu y es',m==='walk'?['Pour marcher : touche le sol pour faire un pas, garde le doigt appuyé pour aller plus loin.']:[],[
    ch('Ouvrir les portes','portes',{go:async()=>{ toutOuvrir(true); await finVisite(m); }}),
    ch('Voir le soir, lampes allumées','soir',{go:async()=>{ document.querySelector('#cq-lum-soir')?.click(); await finVisite(m); }})]);
}

// ---------- B. Ajouter, L. Créer avec l'IA ----------
async function ajouter(o){
  await projet();
  const nom=await source(o), it=app.items[nom]; if(!it){ dire('Je ne retrouve pas l’objet ajouté.'); nouveau(()=>menu(false)); }
  dire(`« ${it.meta.l} » est dans la maquette.`);
  const t=await taille(it,{dims:o.source==='ia'||o.source==='photo'||o.source==='lien'||o.source==='produits'?null:o.dims}), pl=await place(it,o), a=await aspect('aspect',o.aspect?o:{aspect:o.couleur||o.matiere?lireAspect([o.matiere,o.couleur].filter(Boolean).join(' '))||(o.couleur?{i:null,c:o.couleur}:null):null});
  const l=[`Garder « ${it.meta.l} »`,...(t?['Taille '+dimsTexte(t)]:[]),...(textePlace(pl)?[textePlace(pl)[0].toUpperCase()+textePlace(pl).slice(1)]:[]),...(a?['Aspect : '+texteAspect(a)]:[])];
  await recap(l);
  appliquer(it,{taille:t,place:pl,aspect:a}); save();
  await apresAction(it,`C’est fait : « ${it.meta.l} » est ${pieceDe(it)?'dans '+pieceDe(it).nom.toLowerCase():'dans la maquette'}`,`ajouté « ${it.meta.l} »`);
}
async function creerIA(o){ await ajouter({...o,source:'ia'}); }

// ---------- C. Remplacer ----------
async function remplacerObjet(o){
  await projet();
  const ancien=await choisirObjet('c-objet','Quel objet veux-tu remplacer ?',o);
  if(ancien.meta.c==='ouverture'){ dire('Les portes et fenêtres ne se remplacent pas.'); nouveau(()=>menu(false)); }
  preparerRemplacement(ancien); nettoyages.push(()=>annulerRemplacement());
  const nom=await source(o), it=app.items[nom]; if(!it){ nouveau(()=>menu(false)); }
  dire(`« ${it.meta.l} » a pris la place de « ${ancien.meta.l} », qui est masqué.`);
  const t=await taille(it,{ancien,dims:o.dims}), a=await aspect('aspect',o.couleur||o.matiere?{aspect:lireAspect([o.matiere,o.couleur].filter(Boolean).join(' '))}:{});
  const l=[`Mettre « ${it.meta.l} » à la place de « ${ancien.meta.l} », même orientation`,'Masquer l’ancien (on peut le remettre)',...(t?['Taille '+dimsTexte(t)]:[]),...(a?['Aspect : '+texteAspect(a)]:[])];
  await recap(l);
  appliquer(it,{taille:t,aspect:a}); save();
  await apresAction(it,`C’est fait : « ${it.meta.l} » a remplacé « ${ancien.meta.l} »`,`« ${ancien.meta.l} » remplacé par « ${it.meta.l} »`);
}

// ---------- D. Modifier ----------
const SENS=[['gauche','Vers la gauche'],['droite','Vers la droite'],['loin','Vers le fond (loin de moi)'],['moi','Vers moi']];
function versMonde(sens,d){
  let f=new THREE.Vector3(0,0,-1); if(app.mode!=='plan'){ app.camera.getWorldDirection(f); f.y=0; if(f.lengthSq()<1e-6) f.set(0,0,-1); f.normalize(); }
  const r=new THREE.Vector3(-f.z,0,f.x), v={gauche:r.clone().negate(),droite:r,loin:f,moi:f.clone().negate()}[sens];
  return {x:v.x*d/100,z:v.z*d/100};
}
async function modifier(o){
  await projet();
  const it=await choisirObjet('d-objet','Quel objet veux-tu modifier ?',o);
  let quoi=o.action;
  if(!quoi&&o.angle) quoi='tourner'; if(!quoi&&(o.dx||o.dz)) quoi='decaler'; if(!quoi&&o.dims?.L) quoi='taille'; if(!quoi&&(o.couleur||o.matiere)) quoi='aspect';
  if(!quoi) quoi=(await demander('d-quoi',{titre:'Que veux-tu changer ?',choix:[ch('Le déplacer','deplacer'),ch('Le décaler de quelques centimètres','decaler'),ch('Le tourner','tourner'),...(it.meta.c==='ouverture'?[]:[ch('Sa taille','taille')]),ch('Sa couleur ou sa matière','aspect')]})).v;
  const pl={}, l=[];
  if(quoi==='deplacer'){ pl.place=await place(it,o); if(pl.place.type==='ici'){ dire('Il reste où il est : glisse-le avec la poignée.'); await finir('À toi de jouer',[]); return; } l.push(textePlace(pl.place)); }
  else if(quoi==='decaler'){
    let d={x:0,z:0}, t='';
    if(o.dx||o.dz){ const a=versMonde('droite',o.dx||0), b=versMonde('loin',o.dz||0); d={x:a.x+b.x,z:a.z+b.z}; t=[o.dx?`${Math.abs(o.dx)} cm vers la ${o.dx>0?'droite':'gauche'}`:'',o.dz?`${Math.abs(o.dz)} cm ${o.dz>0?'vers le fond':'vers toi'}`:''].filter(Boolean).join(' et '); }
    else { const s=await demander('d-sens',{titre:'Dans quel sens ? (vu d’où tu regardes)',choix:SENS.map(([k,l])=>ch(l,k))});
      const n=await demander('d-cm',{titre:'De combien ?',libre:{ph:'en cm, ex. 20'},choix:[5,10,20,50].map(v=>ch(v+' cm',v))});
      const v=n.texte?lireDims(n.texte)?.L:n.v; if(!v){ dire('Je n’ai pas compris la distance.'); nouveau(()=>menu(false)); }
      d=versMonde(s.v,v); t=`${v} cm ${s.l.toLowerCase()}`; }
    pl.pos={x:it.g.position.x+d.x,z:it.g.position.z+d.z}; l.push('Le décaler de '+t);
  } else if(quoi==='tourner'){
    let a=o.angle;
    if(!a){ const r=await demander('d-angle',{titre:'Comment le tourner ?',libre:{ph:'un angle en degrés, ex. 45'},choix:[ch('Un quart de tour à gauche',-90),ch('Un quart de tour à droite',90),ch('Un demi-tour',180)]});
      a=r.texte?+(String(r.texte).replace(',','.').match(/-?\d+(\.\d+)?/)||[])[0]:r.v; if(!Number.isFinite(a)||!a){ dire('Je n’ai pas compris l’angle.'); nouveau(()=>menu(false)); } }
    const r=it.g.rotation.y-a*Math.PI/180; pl.r=Math.atan2(Math.sin(r),Math.cos(r)); l.push(Math.abs(a)===180?'Le tourner d’un demi-tour':`Le tourner de ${Math.abs(a)}° vers la ${a>0?'droite':'gauche'}`);
  } else if(quoi==='taille'){ pl.taille=await taille(it,{dims:o.dims}); if(!pl.taille){ nouveau(()=>menu(false)); } l.push('Taille '+dimsTexte(pl.taille)); }
  else { const parts=partiesDe(it);
    if(parts.length>1&&!o.couleur&&!o.matiere){ const r=await demander('d-partie',{titre:'Quelle partie ?',choix:[ch('Tout l’objet',''),...parts.slice(0,8).map(p=>ch(p.nom,p.cle))]}); pl.partie=r.v||null; }
    pl.aspect=await aspect('d-aspect',o.couleur||o.matiere?{aspect:lireAspect([o.matiere,o.couleur].filter(Boolean).join(' '))}:{},'partie');
    if(!pl.aspect){ nouveau(()=>menu(false)); }
    l.push((pl.partie?parts.find(p=>p.cle===pl.partie)?.nom+' : ':'')+texteAspect(pl.aspect)); }
  await recap([`« ${it.meta.l} » : `+l.join(', ')]);
  appliquer(it,pl); save();
  await apresAction(it,'C’est fait',`« ${it.meta.l} » : ${l.join(', ')}`);
}

// ---------- E. Enlever ----------
async function enlever(o){
  await projet();
  const it=await choisirObjet('e-objet','Quel objet veux-tu enlever ?',o);
  let v='masquer';
  if(it.ajout) v=(await demander('e-quoi',{titre:'Le masquer ou le supprimer ?',aide:'Les meubles de la maquette se masquent ; seuls les objets ajoutés se suppriment.',choix:[ch('Le masquer (on peut le remettre)','masquer',{prim:true}),ch('Le supprimer','supprimer')]})).v;
  await recap([v==='masquer'?`Masquer « ${it.meta.l} » (il reste dans la liste « Masqués »)`:`Supprimer « ${it.meta.l} »`]);
  if(v==='masquer'){ setHidden(it,true); select(null); } else supprimerAjout(it.name);
  if(v==='supprimer') dispatchEvent(new CustomEvent('meubles'));
  save(); conclusion=(v==='masquer'?'masqué « ':'supprimé « ')+it.meta.l+' »';
  await finir('C’est fait : « '+it.meta.l+' » n’est plus visible',[v==='masquer'?'Il est dans la liste « Masqués » du panneau des meubles.':'Tu peux encore annuler.'],[defaire()]);
}

// ---------- F. Sol ou murs ----------
async function solMur(o){
  await projet();
  const p=o.piece&&PIECES.find(x=>x.id===o.piece)||await choisirPiece('f-piece','Dans quelle pièce ?');
  const quoi=o.quoi||(await demander('f-quoi',{titre:'Le sol ou les murs ?',choix:[ch('Le sol','sol'),ch('Les murs','murs')]})).v;
  const a=await aspect('f-aspect',o.couleur||o.matiere?{aspect:lireAspect([o.matiere,o.couleur].filter(Boolean).join(' '))}:{},quoi);
  if(!a){ nouveau(()=>menu(false)); }
  const ch0=a.i?{i:a.i,c:a.c||null}:{i:quoi==='sol'?'parquet':'peinture',c:a.c};
  await recap([`${quoi==='sol'?'Sol':'Murs'} : ${p.nom.toLowerCase()}, ${texteAspect(ch0)}`]);
  const n=quoi+'__'+p.id; appliquerSurface(n,{...(etatSurface(n)||{}),m:{[quoi]:ch0}}); save();
  conclusion=`${quoi==='sol'?'sol':'murs'} ${p.nom.toLowerCase()} en ${texteAspect(ch0)}`;
  if(app.mode==='orbit') allerVers(p.id);
  await finir(`C’est fait : ${quoi==='sol'?'le sol':'les murs'} ${p.nom==='Salon'?'du salon':'de « '+p.nom+' »'}`,['Les meubles n’ont pas bougé.'],[defaire()]);
}

// ---------- G. Essayer sur une photo (montage par l'IA : la maquette ne change pas) ----------
const blobVersData=b=>new Promise(ok=>{ const r=new FileReader(); r.onload=()=>ok(r.result); r.readAsDataURL(b); });
async function surPhoto(o){
  await etape('g-photos',{titre:'Je lis les photos des pièces…',attente:true},async()=>{ await chargerPhotos(); return true; });
  const ph=lesPhotos(); if(!ph.length){ dire('Il n’y a encore aucune photo des pièces : ajoute-les dans « Photo réaliste » → « Préparer ».'); nouveau(()=>menu(false)); }
  let p=o.piece&&PIECES.find(x=>x.id===o.piece&&ph.some(f=>f.piece===x.id));
  if(!p) p=await choisirPiece('g-piece','Quelle pièce ?',{filtre:x=>ph.some(f=>f.piece===x.id),sous:x=>ph.filter(f=>f.piece===x.id).length+' photos',
    aide:'L’IA retouche une vraie photo de la pièce pour montrer le résultat (un meuble, une déco, un objet en moins). C’est un montage : la maquette 3D ne change pas.'});
  const l=ph.filter(f=>f.piece===p.id);
  const r=l.length===1?{v:l[0].id}:await demander('g-photo',{titre:'Sur quelle photo ?',vign:true,choix:l.slice(0,12).map(f=>ch(f.nom,f.id,{img:f.vignette||null}))});
  const photo=l.find(f=>f.id===r.v);
  let produit=null;
  if(o.objet&&app.items[o.objet]){ const it=app.items[o.objet];
    produit=await etape('g-objet',{titre:`Je prépare l’image de « ${it.meta.l} »…`,attente:true},async()=>({image:await imageMeuble(it),nom:it.meta.l,dims:{L:cm(it.size.x),P:cm(it.size.z),H:cm(it.size.y)}})); }
  let q=o.description?'decrire':null; if(produit) q='produit';
  if(!q) q=(await demander('g-quoi',{titre:'Que veux-tu voir ?',choix:[ch('Un objet ou un produit précis dans la pièce','produit'),ch('Ce que je décris (style, couleurs, déco)','decrire'),ch('La pièce sans un objet','effacer')]})).v;
  if(q==='decrire'){
    const t=o.description||(await demander('g-demande',{titre:'Décris ce que tu veux voir',libre:{ph:'Ex. « un tapis bleu et des plantes »'},choix:[ch('Ajoute de la décoration','Ajoute de la décoration dans cette pièce'),ch('Des murs vert sauge','Peins les murs en vert sauge')]})).texte;
    const d=t||'Ajoute de la décoration dans cette pièce'; faireMontage(photo,null,{demande:d});
    await finir('Le montage est ouvert',['Ta demande est écrite ; touche « Lancer le rendu » (le nombre de versions et les crédits sont demandés avant).']); return;
  }
  if(q==='effacer'){ faireMontage(photo,null,{effacer:true});
    await finir('Le montage est ouvert',['Place le rectangle rouge sur ce qu’il faut enlever (glisse-le, coin pour la taille), puis « Lancer le rendu ».']); return; }
  if(!produit){
    const s=await demander('g-source',{titre:'Quel objet ou produit veux-tu essayer ?',aide:'Un produit de ta liste « Produits », ou l’image ou le lien de n’importe quel objet trouvé ailleurs.',
      choix:[ch('Un produit de ma liste « Produits »','produits'),ch('Coller l’image de l’objet','image'),ch('Coller le lien du produit (boutique)','lien'),ch('Le créer avec l’IA','ia')]});
    if(s.v==='image'){ faireMontage(photo,null,{mode:'produit'}); await finir('Le montage est ouvert',['Colle l’image (Ctrl+V ou « Coller l’image »), place-la, puis « Lancer le rendu ».']); return; }
    if(s.v==='ia'){ ouvrirCreer({retour:(image,i)=>faireMontage(photo,{image,nom:i.nom,dims:i.dims}),texteRetour:'Poser sur la photo',piece:p.id,description:o.description||''});
      await finir('Décris l’objet dans « Créer avec l’IA »',['Puis « Poser sur la photo » : le montage s’ouvre avec l’objet posé.']); return; }
    if(s.v==='lien'){ const u=await demander('g-lien',{titre:'Colle le lien du produit',libre:{ph:'https://…'},choix:[]});
      const lien=extraireLien(u.texte||'')||u.texte;
      produit=await etape('g-lu',{titre:'Je lis la page du produit…',attente:true},async()=>{ const x=await lireProduit(lien); return x.ok&&x.image?{image:x.image,nom:x.nom||'Produit',dims:x.dims||{},lien,site:x.site}:{erreur:x.erreur||'page refusée'}; });
      if(produit.erreur){ faireMontage(photo,null,{mode:'produit'}); await finir('Cette boutique refuse la lecture',['Copie l’image du produit et colle-la dans le montage (Ctrl+V ou « Coller l’image »).']); return; } }
    if(s.v==='produits'){
      const prods=await etape('g-prods',{titre:'Je lis ta liste « Produits »…',attente:true},async()=>(await chargerProduits()).map(x=>x.id));
      const tous=(await chargerProduits()).filter(x=>prods.includes(x.id)).sort((a,b)=>(b.piece===p.id)-(a.piece===p.id));
      if(!tous.length){ dire('Ta liste « Produits » est vide.'); nouveau(()=>menu(false)); }
      const w=await demander('g-prod',{titre:'Lequel ?',vign:true,choix:tous.slice(0,12).map(x=>ch(x.nom,x.id,{img:x.vignette||null,sous:dimsTexte(x)}))});
      const x=tous.find(y=>y.id===w.v);
      produit=await etape('g-pimg',{titre:'Je lis son image…',attente:true},async()=>{ const b=x.image?.id?await lireFichier(x.image.id,x.image.n||1,x.image.type||'image/jpeg'):null;
        return b?{image:await blobVersData(b),nom:x.nom,dims:{L:x.L,P:x.P,H:x.H},lien:x.lien,site:x.boutique}:{erreur:'image illisible'}; });
      if(produit.erreur){ dire('L’image du produit n’a pas pu être lue.'); nouveau(()=>menu(false)); } }
  }
  faireMontage(photo,produit);
  await finir('Le montage est ouvert',[`« ${produit.nom} » est posé sur la photo à sa taille : glisse-le à sa place (ou sur l’objet à remplacer), puis « Lancer le rendu ».`,'Le modèle, le nombre de versions et les crédits sont demandés avant.']);
}

// ---------- H. Mesurer, vérifier ----------
let essai=null;
function retirerEssai(){ if(!essai) return; const n=essai; essai=null; if(app.items[n]) supprimerAjout(n); }
async function mesurer(o){
  let q=o.dims?.L?'rentre':null;
  if(!q) q=(await demander('h-quoi',{titre:'Que veux-tu savoir ?',choix:[ch('Si un meuble rentre','rentre'),ch('La distance entre deux objets','distance'),ch('La surface d’une pièce','surface')]})).v;
  if(q==='surface'){ const p=o.piece&&PIECES.find(x=>x.id===o.piece)||await choisirPiece('h-piece','Quelle pièce ?');
    await finir(`${p.nom} : ${surface(p).toFixed(1).replace('.',',')} m²`,['Surface au sol, mesurée à 1 m de haut.']); return; }
  if(q==='distance'){
    if(!app.mobilierPret){ dire('La maquette se charge encore.'); nouveau(()=>menu(false)); }
    const a=await choisirObjet('h-a','Premier objet ?',{sansConfirmer:true}), b=await choisirObjet('h-b','Deuxième objet ?',{sansConfirmer:true});
    const A=new THREE.Box3().setFromObject(a.g), B=new THREE.Box3().setFromObject(b.g);
    const px=(lo,hi,lo2,hi2)=>hi<lo2?[hi,lo2]:hi2<lo?[lo,hi2]:[(Math.max(lo,lo2)+Math.min(hi,hi2))/2,(Math.max(lo,lo2)+Math.min(hi,hi2))/2];
    const [ax,bx]=px(A.min.x,A.max.x,B.min.x,B.max.x), [az,bz]=px(A.min.z,A.max.z,B.min.z,B.max.z), y=Math.max(A.min.y,B.min.y)+0.01, d=Math.hypot(bx-ax,bz-az);
    if(d>0.005) ajouterMesure([ax,y,az],[bx,y,bz]);
    await finir(d<0.005?'Ils se touchent':`Il y a ${d.toFixed(2).replace('.',',')} m entre les deux`,d<0.005?[]:['Mesuré bord à bord, vu de dessus ; je l’ai tracé avec la règle.']); return;
  }
  // un meuble de cette taille rentre-t-il ? boîte d'essai posée (pas enregistrée), alertes de passage lues, puis retirée
  let d=o.dims; if(!d?.L){ const r=await demander('h-dims',{titre:'Ses mesures ?',libre:{ph:'L × P × H en cm, ex. 240 × 95 × 85'},choix:[]}); d=lireDims(r.texte); }
  if(!d?.L){ dire('Je n’ai pas compris ces mesures.'); nouveau(()=>menu(false)); }
  d={L:d.L,P:d.P||Math.min(d.L,60),H:d.H||80};
  const ou=o.objet?'objet':(await demander('h-ou',{titre:'Où ?',choix:[ch('À la place d’un objet','objet'),ch('Dans une pièce, à une place libre','piece')]})).v;
  let lieu, cible=null;
  if(ou==='objet'){ cible=await choisirObjet('h-obj','Lequel ?',o); lieu={x:cible.g.position.x,z:cible.g.position.z,r:cible.g.rotation.y,niv:nivDe(cible)}; }
  else { const p=o.piece&&PIECES.find(x=>x.id===o.piece)||await choisirPiece('h-p','Dans quelle pièce ?'); const q2=placeLibre(d.L/100,d.P/100,p.id); lieu={x:q2.x,z:q2.z,r:0,niv:q2.niv}; }
  const res=await etape('h-essai',{titre:'Je pose une boîte d’essai de cette taille…',attente:true},async()=>{
    retirerEssai(); const n='aj__essai'+Date.now().toString(36), cache=cible&&!cible.hidden?cible:null;
    if(cache) cache.g.visible=false;
    const it=creerAjout(n,normaliser(n,{x:lieu.x,z:lieu.z,r:lieu.r,h:false,c:'#d9792b',a:{t:'forme',f:'boite',p:{L:d.L/100,P:d.P/100,H:d.H/100},n:'Boîte d’essai',v:lieu.niv,y:sol(lieu.niv),e:0}}));
    if(!it) return {erreur:true}; it.essai=true; essai=n;
    // l'objet remplacé ne compte pas : retiré de la vérification le temps de l'essai
    const h0=cache?cache.hidden:null; if(cache){ cache.hidden=true; }
    nettoyages.push(()=>{ retirerEssai(); if(cache){ cache.hidden=h0; cache.g.visible=!h0; } });
    cadrerObjet(it); const al=await alertesDe([n]);
    return {alertes:al};
  });
  const pas=res.alertes||[];
  await finir(pas.length?'Ça coince':'Oui, il rentre',[...(pas.length?pas.map(t=>t.replace('Boîte d’essai','La boîte')):['Rien dans un mur ni dans un autre meuble, passages de 80 cm et plus, portes libres.']),'La boîte orange disparaît quand tu passes à autre chose : rien n’est enregistré.'],
    [ch('L’ajouter pour de vrai (forme simple)','ajouter',{go:async()=>{ retirerEssai(); await ajouter({source:'forme',forme:'boite',dims:d,...(cible?{}:{})}); }})]);
}

// ---------- I. Imprimer ou partager ----------
async function imprimer(){
  const r=await demander('i-quoi',{titre:'Que veux-tu imprimer ou partager ?',choix:[ch('Le plan d’un étage','plan'),ch('Ce que je vois à l’écran','vue'),ch('La fiche d’un meuble','fiche'),ch('Une photo réaliste (montage)','rendu')]});
  const pdf=async(quoi,o={})=>{
    const m=$('impr-menu'); if(m?.hidden) $('imprimer').click();
    for(const id of [`impr-quoi-${quoi}`,o.niveau&&`impr-niveau-${o.niveau}`,o.format&&`impr-format-${o.format}`,o.echelle&&`impr-echelle-${o.echelle}`].filter(Boolean)) $(id)?.click();
    await pause(50); const b=$('impr-creer'); if(b?.disabled){ await finir('Je ne peux pas le faire comme ça',[$('impr-info')?.textContent||'']); return; }
    b?.click(); await finir('C’est prêt',['Le PDF se télécharge : imprime-le ou envoie-le.']);
  };
  if(r.v==='plan'){ const n=await demander('i-niv',{titre:'Quel étage ?',choix:[ch('Rez','rez'),ch('Étage','etage')]});
    const u=await demander('i-pour',{titre:'Pour quoi faire ?',choix:[ch('Le montrer (une page A4)','a4',{prim:true}),ch('Mesurer dessus (à l’échelle 1:50, sur A3)','a3')]});
    await pdf('plan',{niveau:n.v,format:u.v,echelle:u.v==='a3'?'50':'ajuste'}); return; }
  if(r.v==='vue'){ await pdf('vue'); return; }
  if(r.v==='fiche'){
    if(verrouillee(varianteCourante())||!app.edition){ setEdition(true,false); }
    if(!app.edition){ dire('La fiche se fait en « Éditer » : choisis d’abord un projet modifiable.'); await projet(); }
    const it=await choisirObjet('i-objet','Quel meuble ?',{sansConfirmer:true}); select(it.name); await pause(50); await pdf('fiche'); return; }
  await ouvrirGalerie(true,undefined,'rendus');
  await finir('Choisis le montage dans « Rendus »',['Puis « Partager » : WhatsApp, e-mail… L’avant / après peut partir en une seule image.']);
}

// ---------- J. Mes projets ----------
async function projets(){
  const v=varianteCourante();
  const r=await demander('j-quoi',{titre:'Que veux-tu faire avec tes projets ?',lignes:[`Projet affiché : « ${v?.nom||'Base d’origine'} ».`],
    choix:[ch('Faire une copie pour essayer sans risque','copie'),ch('Changer de projet','changer'),ch('Comparer deux projets','comparer'),ch('Voir la liste des meubles du projet','tableau')]});
  if(r.v==='copie'){ const n='Projet '+(lesVariantes().filter(x=>!x.fixe).length+1);
    const t=await demander('j-nom',{titre:'Quel nom ?',libre:{ph:'Ex. « Salon bleu »'},choix:[ch(n,n,{prim:true})]});
    const nom=(t.texte||t.v).slice(0,60);
    await recap([`Copier « ${v?.nom} » sous le nom « ${nom} »`,'Afficher la copie']);
    await etape('j-copie',{titre:'Je crée la copie…',attente:true},async()=>{ await creerVariante(nom); return true; });
    await finir(`C’est fait : tu es dans « ${varianteCourante()?.nom} »`,['Le nom du projet affiché est sous « Appart. Diolly ».']); return; }
  const autres=lesVariantes().filter(x=>x.id!==v?.id&&!x.masquee);
  if(r.v==='changer'){ const w=await demander('j-var',{titre:'Lequel ?',choix:autres.map(x=>ch(x.nom,x.id,{sous:verrouillee(x)?'base, non modifiable':null}))});
    await etape('j-aff',{titre:'J’ouvre le projet…',attente:true},async()=>afficherVariante(w.v));
    await finir(`Tu es dans « ${varianteCourante()?.nom} »`,[]); return; }
  if(r.v==='comparer'){ const w=await demander('j-cmp',{titre:`Comparer « ${v?.nom} » avec lequel ?`,choix:autres.map(x=>ch(x.nom,x.id))});
    comparer(w.v); await finir('Je les montre côte à côte',['Une barre à glisser : « '+(v?.nom||'')+' » à gauche, l’autre à droite. Rien n’est modifié. « Terminer » pour revenir.']); return; }
  ouvrirTableau(true); await finir('J’ouvre le tableau des meubles',['Dimensions, matières, changements et liens ; il se télécharge pour Excel.']);
}

// ---------- K. Demande libre (écrite ou dictée), comprise par n8n ----------
async function libre(texte,pj){
  msg('moi',texte+(pj?.image?' 📎':'')+(pj?.lien?' 🔗':''));
  const r=await etape('k',{titre:'Je réfléchis…',attente:true},async()=>{
    const ms=Object.values(app.items).filter(it=>it.meta.c!=='fixe'&&!it.essai).map(it=>({id:it.name,nom:it.meta.l,piece:pieceDe(it)?.nom||''}));
    return comprendre({texte,pieces:PIECES.map(p=>({id:p.id,nom:p.nom})),meubles:ms,pieceJointe:pj?.image?'image':pj?.lien?'lien':null});
  });
  if(!r||!r.ok){ dire((r?.erreur?r.erreur+'. ':'')+'Choisis ce que tu veux faire :'); nouveau(()=>menu(false)); }
  if(r.reponse) dire(r.reponse);
  const dims=r.L||r.P||r.H?{L:r.L,P:r.P,H:r.H}:null;
  const o={piece:r.piece,objet:r.objet&&app.items[r.objet]?r.objet:null,source:r.source,description:r.description,couleur:r.couleur,matiere:r.matiere,dims,action:r.action,angle:r.angle,dx:r.dx,dz:r.dz,mode:r.mode,
    image:pj?.image||null,lien:pj?.lien||null,quoi:/mur/.test(sans(texte))&&!/sol/.test(sans(texte))?'murs':/sol|parquet|carrelage/.test(sans(texte))?'sol':null};
  if(pj?.image&&!o.source) o.source='photo'; if(pj?.lien&&!o.source) o.source='lien';
  if(r.branche==='G'&&o.objet&&!pj) o.objet=null;
  await brancher(r.branche==='K'?'X':r.branche,o);
}

// ---------- panneau ----------
function ouvrir(oui){
  if(!pan) construire();
  pan.hidden=!oui; $('assistant').setAttribute('aria-expanded',String(oui));
  document.body.classList.toggle('assistant-ouvert',oui);
  if(oui){ if(!flux) demarrer(accueil); setTimeout(()=>$('as-texte').focus({preventScroll:true}),50); }
  else { conclure(); for(const n of nettoyages.splice(0)) try{ n(); }catch{} if(attente){ const k=attente.ko; attente=null; k(new Stop()); } gen++; flux=null; try{ speechSynthesis.cancel(); }catch{} }
}
function envoyer(){
  const i=$('as-texte'), t=i.value.trim(), pj=jointe; if(!t&&!pj) return;
  i.value=''; jointe=null; majJointe();
  if(attente&&attente.c.libre&&t&&!pj){ attente.ok({texte:t}); return; }
  if(CIAO.test(t)&&!pj){ demarrer(accueil); return; }
  const f=()=>libre(t||'Voici une image',pj); demarrer(f);
}
function majJointe(){
  const z=$('as-jointe'); z.replaceChildren(); z.hidden=!jointe; if(!jointe) return;
  if(jointe.image){ const u=URL.createObjectURL(jointe.image); z.append(el('img',{src:u,alt:'image jointe'})); }
  z.append(el('span',{},jointe.image?'Image jointe':'Lien : '+jointe.lien));
  const x=el('button',{type:'button',class:'as-mini','aria-label':'Retirer'},'×'); x.onclick=()=>{ jointe=null; majJointe(); }; z.append(x);
}
let reco=null;
function micro(){
  const R=window.SpeechRecognition||window.webkitSpeechRecognition, b=$('as-micro');
  if(!R){ dire('La dictée n’est pas disponible dans ce navigateur (essaie Chrome).'); return; }
  if(reco){ reco.stop(); return; }
  reco=new R(); reco.lang='fr-FR'; reco.interimResults=true; reco.continuous=false;
  const i=$('as-texte'); b.classList.add('ecoute'); b.setAttribute('aria-pressed','true');
  reco.onresult=e=>{ let t=''; for(const r of e.results) t+=r[0].transcript; i.value=t; if(e.results[e.results.length-1].isFinal){ reco.stop(); setTimeout(envoyer,150); } };
  reco.onend=()=>{ reco=null; b.classList.remove('ecoute'); b.setAttribute('aria-pressed','false'); };
  reco.onerror=e=>{ if(e.error==='not-allowed') dire('Le micro est refusé : autorise-le dans le navigateur.'); };
  try{ reco.start(); }catch{ reco=null; }
}
function construire(){
  pan=el('aside',{id:'assistant-panneau',class:'assistant',role:'dialog','aria-label':'Mauro, ton assistant',hidden:''});
  const tete=el('header',{class:'as-tete'});
  tete.append(el('img',{src:'icones/assistant-tete.webp',alt:'',class:'as-avatar'}),el('div',{class:'as-nom'},el('b',{},'Mauro'),el('span',{},'ton assistant')));
  const bv=el('button',{type:'button',class:'as-mini',id:'as-voix','aria-pressed':String(voix),title:'Lire les réponses à voix haute'},'🔈');
  bv.onclick=()=>{ voix=!voix; bv.setAttribute('aria-pressed',String(voix)); bv.textContent=voix?'🔊':'🔈'; try{ localStorage.setItem('maison3d-assistant',JSON.stringify({voix})); }catch{} if(!voix) try{ speechSynthesis.cancel(); }catch{} };
  const br=el('button',{type:'button',class:'as-mini',id:'as-recommencer',title:'Recommencer','aria-label':'Recommencer'},'↺'); br.onclick=()=>demarrer(accueil);
  const bf=el('button',{type:'button',class:'as-mini',id:'as-fermer','aria-label':'Fermer'},'×'); bf.onclick=()=>ouvrir(false);
  tete.append(bv,br,bf);
  fil=el('div',{class:'as-fil','aria-live':'polite'});
  const pied=el('div',{class:'as-pied'});
  const jz=el('div',{class:'as-jointe',id:'as-jointe',hidden:''});
  const fi=el('input',{type:'file',accept:'image/*',hidden:'',id:'as-fichier'});
  fi.onchange=()=>{ const f=fi.files[0]; if(f){ jointe={image:f}; majJointe(); } fi.value=''; };
  const sai=el('form',{class:'as-saisie'});
  const bj=el('button',{type:'button',class:'as-mini',id:'as-joindre','aria-label':'Joindre une image',title:'Joindre une image'},'📎'); bj.onclick=()=>fi.click();
  const it=el('input',{type:'text',id:'as-texte',autocomplete:'off','aria-label':'Ta demande',maxlength:'800'});
  it.addEventListener('paste',e=>{ const f=[...(e.clipboardData?.files||[])].find(x=>x.type.startsWith('image/')); if(f){ e.preventDefault(); jointe={image:f}; majJointe(); return; }
    const t=e.clipboardData?.getData('text')||''; const u=extraireLien(t); if(u&&u.trim()===t.trim()&&!(attente?.c.libre)){ e.preventDefault(); jointe={lien:u}; majJointe(); } });
  it.addEventListener('keydown',e=>e.stopPropagation());   // les touches de marche (WASD) ne partent pas dans la visite
  const bm=el('button',{type:'button',class:'as-mini',id:'as-micro','aria-label':'Dicter',title:'Dicter','aria-pressed':'false'},'🎤'); bm.onclick=micro;
  const be=el('button',{type:'submit',class:'btn primary',id:'as-envoyer'},'Envoyer');
  sai.onsubmit=e=>{ e.preventDefault(); envoyer(); };
  sai.append(bj,it,bm,be);
  const nav=el('div',{class:'as-nav'});
  const bret=el('button',{type:'button',class:'btn',id:'as-retour'},'← Retour'); bret.onclick=retour;
  const bmoi=el('button',{type:'button',class:'btn',id:'as-moi'},'Je le fais moi-même'); bmoi.onclick=()=>ouvrir(false);
  nav.append(bret,bmoi);
  pied.append(jz,sai,nav,fi);
  pan.append(tete,fil,pied); document.body.append(pan);
  pan.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.stopPropagation(); ouvrir(false); $('assistant').focus(); } });
}
export const assistantOuvert=()=>!!pan&&!pan.hidden;
export function initAssistant(){
  try{ voix=!!JSON.parse(localStorage.getItem('maison3d-assistant')||'{}').voix; }catch{}
  const b=$('assistant'); if(!b) return;
  b.onclick=e=>{ e.stopPropagation(); ouvrir(!assistantOuvert()); };
}
