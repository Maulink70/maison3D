// Catalogue de meubles 3D (étape 4, livraison 3) : Poly Haven (modèles libres CC0, sans compte, lus directement par le
// site) et Sketchfab (recherche publique faite par le site ; téléchargement par le workflow n8n « Maison3D Catalogue », la
// clé Sketchfab de Mauro restant dans n8n). Recherche en français (petit dictionnaire → anglais, les mots inconnus partent
// tels quels), vignettes, auteur, licence, poids ; le modèle choisi passe par la fenêtre d'import 3D (dimensions,
// allègement, compression) comme un fichier .glb, avec son origine (gardée dans l'objet : panneau, fiche).
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {connecte} from './api.js';
import {importerModele, importerScene} from './import3d.js';

const CATALOGUE='https://n8n.srv1123557.hstgr.cloud/webhook/maison3d-catalogue';
const PH='https://api.polyhaven.com', SF='https://api.sketchfab.com/v3';
const TROP_LOURD=60e6;   // .glb Sketchfab de plus de 60 Mo : trop lourd pour la tablette, même allégé
const CLE='maison3d-catalogue';
const jeton=()=>{ try{ return JSON.parse(localStorage.getItem('maison3d-compte')||'null')?.jeton||''; }catch{ return ''; } };
const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
const sansAccents=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const mo=o=>(o/1048576).toFixed(o<1048576*10?1:0).replace('.',',')+' Mo';
const milliers=n=>n>=1000?Math.round(n/1000).toLocaleString('fr-FR')+' k':String(n);

// ---------- français → anglais ----------
const EXPRESSIONS={'table basse':'coffee table','table de chevet':'nightstand','table de nuit':'nightstand','table a manger':'dining table',
  'table ronde':'round table','meuble tv':'tv stand','meuble tele':'tv stand','lampe de chevet':'bedside lamp','lampe de bureau':'desk lamp',
  'lampe a poser':'table lamp','porte manteau':'coat rack','chaise de bureau':'office chair','fauteuil de bureau':'office chair',
  'canape d angle':'corner sofa','canape lit':'sofa bed','plante verte':'plant','plante en pot':'potted plant','machine a laver':'washing machine',
  'lave linge':'washing machine','seche linge':'dryer','lave vaisselle':'dishwasher','micro ondes':'microwave','plan de travail':'countertop',
  'tete de lit':'headboard','porte fruits':'fruit bowl','corbeille a fruits':'fruit bowl','cadre photo':'picture frame','salle de bain':'bathroom'};
const MOTS={canape:'sofa',divan:'couch',fauteuil:'armchair',chaise:'chair',chaises:'chairs',tabouret:'stool',banc:'bench',banquette:'bench',pouf:'pouf',
  table:'table',bureau:'desk',console:'console table',commode:'dresser',buffet:'sideboard',bahut:'sideboard',armoire:'wardrobe',penderie:'wardrobe',
  placard:'cabinet',vaisselier:'cabinet',vitrine:'display cabinet',etagere:'shelf',etageres:'shelves',bibliotheque:'bookcase',lit:'bed',matelas:'mattress',
  berceau:'crib',lampe:'lamp',lampadaire:'floor lamp',applique:'wall lamp',suspension:'pendant lamp',lustre:'chandelier',plafonnier:'ceiling lamp',
  plante:'plant',plantes:'plants',cactus:'cactus',fleur:'flower',fleurs:'flowers',vase:'vase',pot:'pot',tapis:'rug',rideau:'curtain',rideaux:'curtains',
  coussin:'cushion',coussins:'cushions',plaid:'blanket',miroir:'mirror',horloge:'clock',pendule:'clock',cadre:'frame',tableau:'painting',bougie:'candle',
  bougeoir:'candle holder',panier:'basket',corbeille:'basket',livre:'book',livres:'books',television:'tv',tele:'tv',ecran:'monitor',ordinateur:'computer',
  enceinte:'speaker',piano:'piano',guitare:'guitar',frigo:'fridge',refrigerateur:'fridge',four:'oven',cuisiniere:'stove',evier:'sink',lavabo:'sink',
  baignoire:'bathtub',douche:'shower',toilettes:'toilet',wc:'toilet',radiateur:'radiator',ventilateur:'fan',poubelle:'trash can',valise:'suitcase',
  jouet:'toy',velo:'bicycle',bois:'wooden',blanc:'white',blanche:'white',noir:'black',noire:'black',rond:'round',ronde:'round',moderne:'modern',
  scandinave:'scandinavian',cuir:'leather',verre:'glass',metal:'metal',rotin:'rattan',velours:'velvet',gris:'grey',grise:'grey',bleu:'blue',
  vert:'green',verte:'green',rouge:'red',jaune:'yellow',marron:'brown',petit:'small',petite:'small',grand:'large',grande:'large',haut:'tall',
  angle:'corner',mural:'wall',murale:'wall',ancien:'antique',ancienne:'antique',industriel:'industrial',jardin:'garden',cuisine:'kitchen',salon:'living room',chambre:'bedroom'};
const VIDES=new Set(['de','du','des','la','le','les','l','un','une','en','a','au','aux','avec','pour','et','d']);
export function traduire(q){
  let t=' '+sansAccents(q).replace(/[^a-z0-9]+/g,' ').trim()+' ';
  for(const [fr,en] of Object.entries(EXPRESSIONS)) t=t.replace(' '+fr+' ',' '+en.replace(/ /g,'_')+' ');
  return t.trim().split(/\s+/).filter(m=>m&&!VIDES.has(m)).map(m=>(MOTS[m]||m).replace(/_/g,' ')).join(' ');
}

// ---------- Poly Haven : la liste entière (environ 500 modèles), filtrée ici ----------
const MAISON=new Set(['furniture','seating','table','shelves','decorative','lighting','potted plants','plants','vases','wall decoration','electronics',
  'appliances','office','dishes','books','bed','containers','flowers','food','instrument']);
let listePH=null;
async function polyHaven(q){
  if(!listePH){ const r=await fetch(PH+'/assets?t=models'); if(!r.ok) throw new Error('Poly Haven ne répond pas');
    listePH=Object.entries(await r.json()).filter(([,v])=>v.categories?.some(c=>MAISON.has(c))&&(v.polycount||0)<=300000); }
  const mots=traduire(q).split(' ').filter(Boolean);
  const note=([id,v])=>{ if(!mots.length) return v.categories.includes('furniture')?2:1;
    // mots collés ou séparés (« Arm Chair 01 » pour « armchair ») : comparés aussi sans espaces ni tirets
    const net=x=>sansAccents(x).replace(/[^a-z0-9]/g,''), nom=sansAccents(v.name), nomNet=net(v.name), tags=(v.tags||[]).map(sansAccents), tagsNet=tags.map(net), cats=v.categories.map(sansAccents); let s=0;
    for(const m of mots){ const t=m.toLowerCase(); if(new RegExp('\\b'+t).test(nom)||nomNet.includes(t)) s+=3; if(tags.includes(t)||cats.includes(t)||tagsNet.includes(t)) s+=2; else if(tags.some(x=>x.startsWith(t))) s+=1; }
    return s; };
  return listePH.map(e=>[e,note(e)]).filter(([,s])=>s>0).sort((a,b)=>b[1]-a[1]||b[0][1].date_published-a[0][1].date_published).slice(0,60)
    .map(([[id,v]])=>({source:'polyhaven',id,titre:v.name,auteur:Object.keys(v.authors||{}).join(', '),licence:'CC0',
      vignette:`https://cdn.polyhaven.com/asset_img/thumbs/${encodeURIComponent(id)}.png?width=256&height=256`,lien:`https://polyhaven.com/a/${encodeURIComponent(id)}`,
      triangles:v.polycount||0,octets:0}));
}
// glTF 1k : un fichier .gltf, sa géométrie .bin et ses textures, chacun à sa propre adresse (d'où la correspondance des noms)
async function chargerPH(id,progres){
  const r=await fetch(PH+'/files/'+encodeURIComponent(id)); if(!r.ok) throw new Error('Poly Haven ne répond pas');
  const g=(await r.json()).gltf, f=(g?.['1k']||g?.['2k']||Object.values(g||{})[0])?.gltf; if(!f) throw new Error('pas de version glTF');
  const inc=Object.entries(f.include||{}), total=(f.size||0)+inc.reduce((s,[,v])=>s+(v.size||0),0);
  const man=new THREE.LoadingManager(); man.setURLModifier(u=>{ const t=inc.find(([k])=>u.endsWith('/'+k)||u.endsWith(k)); return t?t[1].url:u; });
  man.onProgress=(u,n,de)=>progres(`${n} fichier${n>1?'s':''} sur ${de}`);
  const l=new GLTFLoader(man); l.setMeshoptDecoder(MeshoptDecoder);
  const gltf=await new Promise((ok,ko)=>l.load(f.url,ok,undefined,ko)); return {scene:gltf.scene||gltf.scenes[0],octets:total};
}

// ---------- Sketchfab : recherche publique (le site), téléchargement par n8n (la clé) ----------
async function sketchfab(q,suite){
  const u=suite||`${SF}/search?type=models&downloadable=true&available_archive_type=glb&archives_max_face_count=300000&count=24&q=${encodeURIComponent(traduire(q)||'furniture')}`;
  const r=await fetch(u); if(!r.ok) throw new Error('Sketchfab ne répond pas'); const d=await r.json();
  const vign=m=>{ const l=(m.thumbnails?.images||[]).filter(i=>i.width>=200).sort((a,b)=>a.width-b.width); return (l[0]||m.thumbnails?.images?.[0])?.url||''; };
  return {suite:d.next||null,liste:(d.results||[]).map(m=>{ const glb=m.archives?.glb||{};
    return {source:'sketchfab',id:m.uid,titre:m.name,auteur:m.user?.displayName||m.user?.username||'',licence:m.license?.label||'',vignette:vign(m),
      lien:m.viewerUrl,triangles:glb.faceCount||m.faceCount||0,octets:glb.size||0}; })};
}
async function n8n(corps,binaire=false){
  let r; try{ r=await fetch(CATALOGUE,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({...corps,jeton:jeton()}),cache:'no-store'}); }
  catch{ throw new Error('Pas de connexion au serveur : réessayez quand le réseau revient.'); }
  if(r.status===404) throw new Error('Sketchfab n’est pas encore branché (clé Sketchfab à enregistrer dans n8n). Poly Haven marche sans clé.');
  if(binaire&&r.ok&&!/json/i.test(r.headers.get('content-type')||'')) return r;
  const d=await r.json().catch(()=>({ok:false,erreur:'Réponse illisible'})); if(!d.ok) throw new Error(d.erreur||'Sketchfab a refusé'); return d;
}
// lecture d'une réponse avec progression (Mo reçus)
async function lireTout(r,progres,total){
  const t=+r.headers.get('content-length')||total||0; if(!r.body?.getReader){ return new Uint8Array(await r.arrayBuffer()); }
  const lec=r.body.getReader(), morceaux=[]; let n=0;
  for(;;){ const {done,value}=await lec.read(); if(done) break; morceaux.push(value); n+=value.length; progres(t?`${mo(n)} sur ${mo(t)}`:mo(n)); }
  const u=new Uint8Array(n); let o=0; for(const m of morceaux){ u.set(m,o); o+=m.length; } return u;
}
async function chargerSF(m,progres){
  const d=await n8n({action:'telecharger',id:m.id});   // adresse temporaire du .glb (quelques minutes)
  let r=null; try{ r=await fetch(d.url); if(!r.ok) r=null; }catch{ r=null; }   // directement si Sketchfab l'autorise…
  if(!r) r=await n8n({action:'fichier',url:d.url},true);                       // …sinon par n8n
  return lireTout(r,progres,d.taille);
}

// ---------- la fenêtre ----------
let fen=null, source='polyhaven', suite=null, enCours=false;
try{ source=localStorage.getItem(CLE)==='sketchfab'?'sketchfab':'polyhaven'; }catch{}
const IDEES=['Canapé','Fauteuil','Chaise','Table','Table basse','Lampe','Lampadaire','Étagère','Commode','Lit','Plante','Vase','Tapis','Miroir'];
function dire(t,erreur=false){ const m=fen.querySelector('.ph-message'); m.textContent=t||''; m.classList.toggle('cx-erreur',erreur); }
function carte(m){
  const lourd=m.octets>TROP_LOURD, b=el('button',{type:'button',class:'cat-carte','data-id':m.id}); if(lourd) b.disabled=true;
  const i=el('img',{src:m.vignette,alt:'',loading:'lazy',referrerpolicy:'no-referrer'}); i.onerror=()=>i.remove();
  b.append(el('span',{class:'cat-image'}),el('span',{class:'cat-titre'},m.titre),el('span',{class:'cat-info'},[m.auteur,m.licence].filter(Boolean).join(' · ')),
    el('span',{class:'cat-info'},lourd?'Trop lourd ('+mo(m.octets)+')':[m.octets?mo(m.octets):'',m.triangles?milliers(m.triangles)+' triangles':''].filter(Boolean).join(' · ')));
  b.firstChild.append(i); b.onclick=()=>choisir(m); return b;
}
async function chercher(plus=false){
  if(enCours) return; const q=fen.querySelector('#cat-q').value.trim(), grille=fen.querySelector('.cat-grille'), pl=fen.querySelector('#cat-plus');
  if(!plus){ grille.replaceChildren(); suite=null; } pl.hidden=true; enCours=true;
  dire(q?`Recherche de « ${traduire(q)} »…`:'Recherche…');
  try{
    const r=source==='polyhaven'?{liste:await polyHaven(q),suite:null}:await sketchfab(q,plus?suite:null);
    suite=r.suite; for(const m of r.liste) grille.append(carte(m));
    pl.hidden=!suite;
    dire(grille.children.length?(source==='sketchfab'?'Modèles de la communauté Sketchfab : vérifiez l’auteur et la licence.':'Modèles libres de Poly Haven (CC0).')+' Touchez un modèle pour l’ajouter.'
      :`Rien trouvé pour « ${q} »${source==='polyhaven'?' chez Poly Haven (catalogue réduit) : essayez Sketchfab.':'.'}`);
  }catch(e){ dire(e.message||'La recherche a échoué.',true); }
  finally{ enCours=false; }
}
async function choisir(m){
  if(enCours) return; if(m.source==='sketchfab'&&!connecte()){ dire('Connectez-vous pour télécharger depuis Sketchfab.',true); return; }
  enCours=true; fen.querySelectorAll('.cat-carte').forEach(b=>b.classList.toggle('choisi',b.dataset.id===m.id));
  const progres=t=>dire(`Téléchargement de « ${m.titre} »… ${t}`);
  progres('');
  const origine={site:m.source==='polyhaven'?'Poly Haven':'Sketchfab',id:m.id,titre:String(m.titre).slice(0,80),auteur:String(m.auteur).slice(0,80),licence:String(m.licence).slice(0,60),lien:m.lien};
  try{
    if(m.source==='polyhaven'){ const {scene,octets}=await chargerPH(m.id,progres); ouvrirCatalogue(false);
      importerScene(scene,{nom:m.titre,octets,origine,message:'Modèle du catalogue : vérifiez les dimensions (cm), puis « Ajouter ».'}); }
    else { const u=await chargerSF(m,progres); ouvrirCatalogue(false);
      await importerModele(new File([u],'catalogue.glb',{type:'model/gltf-binary'}),{nom:m.titre,origine,message:'Modèle du catalogue : vérifiez les dimensions (cm), puis « Ajouter ».'}); }
  }catch(e){ dire('Téléchargement impossible : '+(e.message||e),true); }
  finally{ enCours=false; }
}
function construireFenetre(){
  fen=el('div',{id:'catalogue-fenetre',class:'fenetre',role:'dialog','aria-modal':'true','aria-label':'Catalogue de meubles 3D'});
  fen.innerHTML=`<div class="fenetre-carte cat-carte-fen">
    <div class="fenetre-tete"><h2>Catalogue de meubles 3D</h2><button type="button" class="fermer" aria-label="Fermer">×</button></div>
    <div class="seg cat-sources" role="group" aria-label="Catalogue"><button type="button" data-source="polyhaven">Poly Haven (libre)</button><button type="button" data-source="sketchfab">Sketchfab</button></div>
    <form class="cat-recherche"><input type="search" id="cat-q" placeholder="canapé, lampe, table basse…" autocomplete="off" aria-label="Rechercher"><button type="submit" class="btn primary">Chercher</button></form>
    <div class="cat-idees"></div>
    <p class="ph-message" role="status"></p>
    <div class="cat-grille"></div>
    <button type="button" class="btn wide" id="cat-plus" hidden>Plus de résultats</button></div>`;
  document.body.append(fen);
  const q=s=>fen.querySelector(s);
  q('.fermer').onclick=()=>ouvrirCatalogue(false);
  fen.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape') ouvrirCatalogue(false); });
  fen.addEventListener('pointerdown',e=>{ if(e.target===fen) ouvrirCatalogue(false); });
  for(const b of fen.querySelectorAll('[data-source]')) b.onclick=()=>{ source=b.dataset.source; try{ localStorage.setItem(CLE,source); }catch{} majSources(); chercher(); };
  q('.cat-recherche').onsubmit=e=>{ e.preventDefault(); chercher(); };
  for(const t of IDEES){ const b=el('button',{type:'button',class:'cat-idee'},t); b.onclick=()=>{ q('#cat-q').value=t; chercher(); }; q('.cat-idees').append(b); }
  q('#cat-plus').onclick=()=>chercher(true);
}
function majSources(){ for(const b of fen.querySelectorAll('[data-source]')) b.setAttribute('aria-pressed',String(b.dataset.source===source)); }
export function ouvrirCatalogue(oui=true){
  if(oui&&!fen) construireFenetre(); if(!fen) return; fen.hidden=!oui;
  if(oui){ majSources(); dire(''); if(!fen.querySelector('.cat-grille').children.length) chercher(); setTimeout(()=>fen.querySelector('#cat-q').focus()); }
}
