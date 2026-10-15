// Chargement progressif du modèle et corrections faites au chargement (le fichier 3D n'est pas modifié)
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {app, $} from './app.js';
import {META, FICHIERS, GARDE_CORPS, ETAGE_FLOOR, SOL_WC} from './config.js';
import {construireEtagere} from './etagere.js';
import {construireBuanderie, carrelerSol, carrelerMursWC, avancerMurLavabo} from './buanderie.js';
import {fusionner, MAT} from './formes.js';
import {remplacerEscalier, remplacerCloison, cloisonReduit, toitSud, decorEntree, jointsToitSud} from './rez_structure.js';
import {construireCuisine} from './rez_cuisine.js';
import {construireSalon, construireBuffet} from './rez_salon.js';
import {construirePieces, carrelerMursSdb} from './rez_pieces.js';
import {plafondsPin, solDouche, murAubergine, ouvrirPorteDouche, carrelerDouche, faitage} from './etage_structure.js';
import {chargerBase, installerBase, estRetire} from './base.js';
import {construireEtage} from './etage_pieces.js';
import {installerPortes} from './portes.js';
import {installerFenetres} from './fenetres.js';
import {corrigerStructure, retirerPanneauxSurVitres, seuilBaie} from './corrections.js';
import {habiller, habillerConstruits, habillerModele, poserCoordonnees} from './matieres.js';
import {poserCouvercles} from './coupes.js';

const loader=new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
function charger(url,progres){
  return new Promise((res,rej)=>loader.load(url,res,e=>{ if(e.total) progres(Math.round(e.loaded/e.total*100)); },rej));
}

// Vitres : la texture « nuages » de SketchUp est remplacée par un verre clair
const VITRE=new THREE.MeshStandardMaterial({color:0xdcebf0,transparent:true,opacity:0.16,roughness:0.05,metalness:0,side:THREE.DoubleSide,depthWrite:false});
function corrigerVitres(root){
  root.traverse(o=>{ if(!o.isMesh) return;
    const m=o.material; if(!Array.isArray(m)&&m.transparent&&m.map){ o.material=VITRE; o.userData.vitre=true; } });
}

// Les murs SketchUp n'ont souvent qu'une face, tournée vers l'intérieur : on ajoute leur dos, poussé en
// profondeur, pour qu'il ne s'affiche que là où aucune face n'existe (un DoubleSide simple ferait scintiller
// les sols, où SketchUp superpose deux faces dos à dos)
function doublerFaces(root){
  const dos=[];
  root.traverse(o=>{ if(o.isMesh&&!o.userData.vitre) dos.push(o); });
  for(const o of dos){
    const m=o.material.clone(); m.side=THREE.BackSide; m.polygonOffset=true; m.polygonOffsetFactor=1; m.polygonOffsetUnits=4;
    const b=new THREE.Mesh(o.geometry,m); b.raycast=()=>{}; b.userData.dos=true; o.add(b);
  }
}

function ajouterFixe(o,mur=true){
  const solid=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  o.updateMatrixWorld(true);
  o.traverse(m=>{ if(!m.isMesh||m.userData.vitre||m.userData.dos) return;
    const c=new THREE.Mesh(m.geometry,solid); c.matrixAutoUpdate=false; c.matrixWorld.copy(m.matrixWorld);
    app.floors.push(c); if(mur||m.userData.collider) app.colliders.push(c); });
}

function gardeCorps(){
  const g=GARDE_CORPS, geo=new THREE.BoxGeometry(g.x1-g.x0,g.h,g.z1-g.z0);
  const verre=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xcfe6ee,transparent:true,opacity:0.28,roughness:0.08,side:THREE.DoubleSide,depthWrite:false}));
  verre.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:0x7d9aa5,transparent:true,opacity:0.6})));
  verre.position.set((g.x0+g.x1)/2,ETAGE_FLOOR+g.h/2,(g.z0+g.z1)/2); verre.name='etage__garde_corps';
  verre.traverse(o=>{ o.raycast=()=>{}; });   // ne gêne pas la sélection des meubles derrière
  // seul l'arrêt compte pour la visite : pas de sol, sinon on marcherait dessus
  const solid=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  solid.matrixAutoUpdate=false; verre.updateMatrixWorld(true); solid.matrixWorld.copy(verre.matrixWorld); app.colliders.push(solid);
  return verre;
}

// Murs et plafonds peints (rez, étage) : « peinture un peu rugueuse » (questionnaire des textures)
const PEINTURE=['Material_6','Material_363'];
function installerStructure(root){
  root.traverse(o=>{ if(o.isMesh&&o.material.name===SOL_WC) carrelerSol(o); });
  avancerMurLavabo(root);                      // mur du lavabo du WC 30 cm plus en avant (mesure de Mauro)
  carrelerMursWC(root);                        // faïence blanche du WC / buanderie (photo de Mauro)
  const corrections=corrigerStructure(root);   // sols, seuil de la baie, mur percé pour la porte d'entrée (audit)
  ouvrirPorteDouche(root); carrelerDouche(root); corrigerVitres(root);
  carrelerMursSdb(root);                        // murs de la salle de bain du rez carrelés (relevé de Mauro)
  root.traverse(o=>{ if(o.isMesh&&PEINTURE.includes(o.material.name)&&!o.material.userData.motif) habiller(o.material,'peinture'); });
  poserCoordonnees(root);                      // avant les dos des faces, qui partagent la géométrie
  doublerFaces(root); app.model.add(root);
  // escalier en vraies marches (réduit dessous), muret rampant, cloison du réduit : d'après les photos
  const esc=root.getObjectByName('rez__escalier'), clo=root.getObjectByName('rez__cloison');
  if(esc) remplacerEscalier(esc,root); if(clo) remplacerCloison(clo,root);
  root.add(fusionner(cloisonReduit()),solDouche(),corrections);
  for(const child of [...root.children]) ajouterFixe(child,child.name!=='rez__escalier');
  let peint=null, peintRez=null; root.traverse(o=>{ if(!o.isMesh||o.material.side!==THREE.FrontSide) return;
    if(!peint&&o.material.name==='Material_363') peint=o.material; if(!peintRez&&o.material.name==='Material_6') peintRez=o.material; });
  root.add(gardeCorps(),toitSud(),plafondsPin(),fusionner(murAubergine()));
  if(peint) root.add(faitage(peint));   // fente au faîte fermée
  if(peintRez) root.add(jointsToitSud(peintRez));   // haut des murs est et ouest du salon, sous le pan sud
  habillerConstruits(root); poserCoordonnees(root);   // marches en pierre, nez de marche, faces refaites
}

// Remplace la carcasse SketchUp de la bibliothèque (seule pièce de plus de 2 m de haut) ; les livres du modèle restent,
// en élément à part, « Livres (bibliothèque) » (Mauro, 11 octobre 2026 : pouvoir poser autre chose sur les meubles)
function remplacerEtagere(node,root){
  const vieux=[];
  node.traverse(o=>{ if(o.isMesh&&new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).y>2) vieux.push(o); });
  for(const o of vieux) o.removeFromParent();
  const livres=[]; node.traverse(o=>{ if(o.isMesh) livres.push(o); });
  if(livres.length){ const l=new THREE.Group(); l.name='rez__livres'; root.add(l); node.updateMatrixWorld(true); for(const o of livres) l.attach(o); }
  const g=fusionner(construireEtagere()); root.add(g); node.attach(g);
}

// Buffet du salon refait d'après la photo de Mauro (js/rez_salon.js), dans le laqué bordeaux et crème du modèle (teintés)
function remplacerBuffet(node,root){
  let bordeaux=null, creme=null; node.traverse(o=>{ if(!o.isMesh) return;
    if(o.material.name==='Material_15') bordeaux=o.material; if(o.material.name==='Material_6') creme=o.material; });
  const vieux=[]; node.traverse(o=>{ if(o.isMesh) vieux.push(o); }); for(const o of vieux) o.removeFromParent();
  const g=fusionner(construireBuffet(bordeaux||MAT.potBordeaux,creme||MAT.laqueCreme)); root.add(g); node.attach(g);
}

// Couleurs corrigées d'après les photos (matériau SketchUp → couleur réelle), meuble par meuble
const TEINTES={'rez__meuble_salon':{Material_15:0x6f1f2b,       // buffet : rouge vif → bordeaux
    Material_6:0xeee6d4},                                        // caisson blanc → crème (questionnaire)
  'rez__Bar_cuisine':{Material_52:0x1d1d1f},                     // machine à café sur le bar : rouge → noire
  'rez__Cherry':{Material_18:0x6a1a28, Material_15:0x4a1019}};   // cerise décorative : rouge → bordeaux
// Matières du modèle remplacées par une texture dessinée (questionnaire des textures) : [motif, couleur]
const MATIERES={'rez__canape_salon#1':{Material_309:['cuir',0x4a121b],   // base bordeaux foncé
    Material_310:['cuir',0x4a121b], Material_311:['cuir',0xe8d8ad]},    // assise, coussins crème : tout en cuir
  'rez__tapis_salon':{Material_361:['tapis',0xf3f0ea], Material_362:['tapis',0xf3f0ea]}};   // tapis blanc, poils longs
function teinter(root){
  for(const [nom,t] of Object.entries(TEINTES)){ const n=root.getObjectByName(nom); if(!n) continue;
    n.traverse(o=>{ if(o.isMesh&&t[o.material.name]!==undefined){ o.material=o.material.clone(); o.material.color.set(t[o.material.name]); } }); }
}

// Places corrigées d'après les photos calées (11 octobre 2026) : nœuds du modèle déplacés (x, z en mètres) avant la création des meubles
const DEPLACES={'rez__Bar_cuisine':[0,0.60],   // îlot : allée de ~1,1 m devant les meubles du fond (0,6 m dans le modèle)
  'rez__meuble_salon':[0,0.25],                // buffet : 25 cm plus au sud (trois photos du salon)
  'rez__armoire_chambre_a_coucher':[-0.01,0]};  // armoire de la chambre : flanc 1 cm dans le mur (il était dans son plan et scintillait vu d'en haut, Mauro)
function deplacer(root){
  for(const [nom,[dx,dz]] of Object.entries(DEPLACES)){ const n=root.getObjectByName(nom); if(!n) continue;
    const p=n.getWorldPosition(new THREE.Vector3()); p.x+=dx; p.z+=dz; n.parent.worldToLocal(p); n.position.copy(p); n.updateMatrixWorld(true); }
}

// Machine à café du bar (11 octobre 2026, Mauro : « ça me sélectionne le bar entier ») : fondue dans le nœud du bar dans le
// modèle (ses maillages, plus 627 triangles de la peinture blanche du bar) ; ce qui est au-dessus du plateau, au bout est du
// bar, devient un élément à part, « Machine à café » (après deplacer : coordonnées de l'îlot déplacé). Un maillage coupé
// donne deux géométries non indexées, chacune avec ses seuls sommets (boîte englobante juste : taille, sélection, plan)
const MACHINE=new THREE.Box3(new THREE.Vector3(18.05,0.935,-22.66),new THREE.Vector3(18.35,1.4,-22.26));
function separerMachine(root){
  const bar=root.getObjectByName('rez__Bar_cuisine'); if(!bar) return;
  const g=new THREE.Group(); g.name='rez__machine_cafe'; root.add(g); bar.updateMatrixWorld(true);
  const v=new THREE.Vector3(), maillages=[]; bar.traverse(o=>{ if(o.isMesh) maillages.push(o); });
  for(const o of maillages){
    const geo=o.geometry, pos=geo.attributes.position, n=geo.index?geo.index.count:pos.count, at=k=>geo.index?geo.index.getX(k):k;
    const dans=[], reste=[];
    for(let k=0;k+2<n;k+=3){ const t=[at(k),at(k+1),at(k+2)]; (t.every(i=>MACHINE.containsPoint(v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld)))?dans:reste).push(...t); }
    if(!dans.length) continue;
    if(!reste.length){ g.attach(o); continue; }
    const morceau=idx=>{ const x=new THREE.BufferGeometry(); for(const [k,a] of Object.entries(geo.attributes)) x.setAttribute(k,a);
      x.setIndex(idx); const y=x.toNonIndexed(); y.computeBoundingBox(); y.computeBoundingSphere(); return y; };
    const part=morceau(dans); o.geometry=morceau(reste); geo.dispose();
    const m=new THREE.Mesh(part,o.material); m.name=o.name+'_machine'; m.userData={...o.userData};
    m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale); o.parent.add(m); g.attach(m);
  }
}

function installerMobilier(root){
  corrigerVitres(root); retirerPanneauxSurVitres(root); teinter(root); seuilBaie(root);
  app.model.add(root); root.updateMatrixWorld(true); app.mobilier=root;   // racine du mobilier : les objets ajoutés y sont rangés
  const etagere=root.getObjectByName('rez__armoire'); if(etagere) remplacerEtagere(etagere,root);
  const buffet=root.getObjectByName('rez__meuble_salon'); if(buffet) remplacerBuffet(buffet,root);
  deplacer(root); separerMachine(root);
  for(const n of [...construireBuanderie(root),...construireCuisine(),...construireSalon(),...construirePieces(root),...construireEtage(root),...decorEntree()]) root.add(fusionner(n));
  installerPortes(root); installerFenetres(root);
  const tapis=root.getObjectByName('rez__tapis_salon'); if(tapis) tapis.scale.y=1.75;   // poils longs : 3,5 cm d'épaisseur au lieu de 2
  habillerModele(root,MATIERES); habillerConstruits(root); poserCoordonnees(root);
  for(const child of [...root.children]){
    const meta=META[child.name]||{l:child.name,c:'fixe'};
    if(meta.c==='fixe'){ ajouterFixe(child,true); continue; }
    if(estRetire(child.name)){ root.remove(child); continue; }   // meuble remplacé par un objet de l'Appart Base (base.js) : jamais affiché, hors de la liste
    const box=new THREE.Box3().setFromObject(child), c=box.getCenter(new THREE.Vector3());
    const g=new THREE.Group(); g.name=child.name; g.position.set(c.x,box.min.y,c.z); root.add(g); g.attach(child);
    const it={g,meta,name:child.name,size:box.getSize(new THREE.Vector3()),lvl:child.name.startsWith('etage')?'Étage':'Rez',
      home:g.position.clone(),hidden:false,color:null,mats:[]};
    child.traverse(o=>{ if(o.isMesh){ o.userData.item=child.name; it.mats.push(o); } });
    app.items[child.name]=it;
    if(/fenetre|baie|element_mural|velux/i.test(child.name)) app.fenetres.push(...it.mats);
  }
  poserCouvercles();   // dessus des éléments coupés par les vues Rez / Étage (après app.fenetres : pas d'obstacle en plus)
}

function erreur(err,cible){ console.error(err); cible.textContent='Le modèle n’a pas pu être chargé ('+(err&&err.message?err.message:String(err))+'). Rechargez la page.'; }

// 1. la structure (murs, sols, escalier) ; la maquette s'affiche dès qu'elle est là
// 2. le mobilier (meubles, portes, fenêtres), avec un indicateur discret
export async function chargerModele({structurePrete,mobilierPret}){
  try{
    const s=await charger(FICHIERS.structure,p=>{ $('bar').style.width=p+'%'; $('pct').textContent=p+' %'; const r=$('loading-rempli'); if(r) r.style.clipPath=`inset(${100-p}% 0 0 0)`; });
    installerStructure(s.scene); structurePrete();
    $('loading').hidden=true; $('charge').hidden=false;
  }catch(e){ erreur(e,$('pct')); return; }
  try{
    const [m]=await Promise.all([charger(FICHIERS.mobilier,p=>{ $('charge-pct').textContent=p+' %'; }),chargerBase()]);   // l'Appart Base (base.js) en même temps
    installerMobilier(m.scene); installerBase(); app.mobilierPret=true; mobilierPret();
    $('charge').hidden=true;
  }catch(e){ $('charge').hidden=false; erreur(e,$('charge'));
    $('list').innerHTML='<div class="attente">Les meubles n’ont pas pu être chargés. Rechargez la page.</div>'; }
}
