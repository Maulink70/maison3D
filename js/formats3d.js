// Formats de fichiers 3D (étape 4, demande de Mauro du 10 octobre 2026) : en plus du .glb, .gltf, .fbx, .obj (+ .mtl),
// .dae (Collada, 3D Warehouse) et .stl. Un modèle et ses fichiers à part (géométrie .bin, textures, .mtl) se donnent
// ensemble (choix de plusieurs fichiers) ou en .zip ; les noms de fichiers cités par le modèle sont retrouvés par leur nom
// seul (sans dossier, sans majuscules). Les lecteurs de three.js ne sont chargés qu'au besoin. Le modèle lu repart dans
// la fenêtre d'import 3D comme un .glb (dimensions, allègement, compression, envoi en .glb).
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

export const FORMATS=['glb','gltf','fbx','obj','dae','stl'];
export const ACCEPTE='.glb,.gltf,.fbx,.obj,.mtl,.dae,.stl,.zip,.bin,.png,.jpg,.jpeg,.webp,.tga,.bmp,.gif';
const ext=n=>(String(n).match(/\.([a-z0-9]+)$/i)?.[1]||'').toLowerCase();
const nomSeul=u=>decodeURIComponent(String(u).split(/[?#]/)[0]).split(/[\\/]/).pop().toLowerCase();
const VIDE='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BAwAI/AL+hc2rNAAAAABJRU5ErkJggg==';   // texture absente : blanc

// fichiers choisis (et contenu des .zip) → {principal, tous (chemin → Blob), octets}
async function rassembler(fichiers){
  const tous=new Map(); let octets=0;
  for(const f of fichiers){
    if(ext(f.name)==='zip'){
      const {unzipSync}=await import('three/addons/libs/fflate.module.js');
      const z=unzipSync(new Uint8Array(await f.arrayBuffer()));
      for(const [chemin,u] of Object.entries(z)){ if(!u.length||/(^|\/)__MACOSX\//.test(chemin)||/(^|\/)\._/.test(chemin)) continue; tous.set(chemin,new Blob([u])); octets+=u.length; }
    } else { tous.set(f.name,f); octets+=f.size; }
  }
  const principal=FORMATS.map(e=>[...tous.keys()].find(k=>ext(k)===e)).find(Boolean)||null;
  return {principal,tous,octets};
}
let draco=null;
function lecteurGLTF(man){
  if(!draco){ draco=new DRACOLoader(); draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/'); }
  const l=new GLTFLoader(man); l.setDRACOLoader(draco); l.setMeshoptDecoder(MeshoptDecoder); return l;
}

// fichiers → {scene, nom, octets, manquants:[noms de fichiers cités mais absents]} ; erreur lisible sinon
export async function lireModele(fichiers){
  const {principal,tous,octets}=await rassembler(fichiers);
  if(!principal) throw new Error('aucun modèle 3D reconnu (.glb, .gltf, .fbx, .obj, .dae ou .stl)');
  const urls=new Map(), manquants=new Set();
  for(const [k,b] of tous) urls.set(nomSeul(k),URL.createObjectURL(b));
  const man=new THREE.LoadingManager(); let demarre=false;
  man.onStart=()=>{ demarre=true; };
  man.setURLModifier(u=>{ if(/^(blob|data):/.test(u)) return u; const v=urls.get(nomSeul(u)); if(v) return v; manquants.add(nomSeul(u)); return VIDE; });
  const fini=new Promise(ok=>{ man.onLoad=ok; });
  const e=ext(principal), blob=tous.get(principal), nom=principal.split('/').pop().replace(/\.[a-z0-9]+$/i,'').replace(/[_-]+/g,' ');
  let scene;
  try{
    if(e==='glb'||e==='gltf'){
      const donnees=e==='glb'?await blob.arrayBuffer():await blob.text();
      scene=await new Promise((ok,ko)=>lecteurGLTF(man).parse(donnees,'',g=>ok(g.scene||g.scenes?.[0]),ko));
    } else if(e==='fbx'){
      const [{FBXLoader},{TGALoader}]=await Promise.all([import('three/addons/loaders/FBXLoader.js'),import('three/addons/loaders/TGALoader.js')]);
      man.addHandler(/\.tga$/i,new TGALoader(man));
      scene=new FBXLoader(man).parse(await blob.arrayBuffer(),'');
    } else if(e==='obj'){
      const {OBJLoader}=await import('three/addons/loaders/OBJLoader.js'), l=new OBJLoader(man);
      const mtl=[...tous.keys()].find(k=>ext(k)==='mtl');
      if(mtl){ const {MTLLoader}=await import('three/addons/loaders/MTLLoader.js'); const m=new MTLLoader(man).parse(await tous.get(mtl).text(),''); m.preload(); l.setMaterials(m); }
      scene=l.parse(await blob.text());
    } else if(e==='dae'){
      const {ColladaLoader}=await import('three/addons/loaders/ColladaLoader.js');
      scene=new ColladaLoader(man).parse(await blob.text(),'')?.scene;
    } else {
      const {STLLoader}=await import('three/addons/loaders/STLLoader.js'), g=new STLLoader(man).parse(await blob.arrayBuffer());
      if(!g.attributes.normal) g.computeVertexNormals();
      scene=new THREE.Group(); scene.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:g.hasColors?0xffffff:0xb8b0a4,vertexColors:!!g.hasColors,roughness:0.6})));
    }
    if(!scene) throw new Error('fichier illisible');
    // textures demandées pendant la lecture : on attend qu'elles soient là (30 s au plus) avant de mesurer et d'envoyer
    if(demarre) await Promise.race([fini,new Promise(ok=>setTimeout(ok,30000))]);
  } finally { setTimeout(()=>{ for(const u of urls.values()) URL.revokeObjectURL(u); },60000); }
  return {scene,nom,octets,format:e,manquants:[...manquants].filter(n=>n&&!/\.(glb|gltf|fbx|obj|dae|stl)$/.test(n))};
}

// avant l'envoi : un matériau par maillage (les maillages à plusieurs matériaux sont coupés en morceaux, sinon la
// simplification mélangerait les zones) et des matériaux « standard » (ceux de l'.obj, du .fbx, du .dae sont Phong ou
// Lambert : couleur, texture, transparence reprises)
export function separer(racine){
  const l=[]; racine.traverse(o=>{ if(o.isMesh&&Array.isArray(o.material)) l.push(o); });
  for(const o of l){
    const g=o.geometry, groupes=g.groups.length?g.groups:[{start:0,count:Infinity,materialIndex:0}];
    const plat=g.index?g.toNonIndexed():g, n=plat.attributes.position.count;
    if(Object.values(plat.attributes).some(a=>a.isInterleavedBufferAttribute)){ o.material=o.material[0]; continue; }
    for(const gr of groupes){
      const m=o.material[gr.materialIndex??0]; if(!m) continue;
      const a0=Math.max(0,gr.start), a1=Math.min(n,gr.start+(Number.isFinite(gr.count)?gr.count:n)); if(a1<=a0) continue;
      const sub=new THREE.BufferGeometry();
      for(const [k,a] of Object.entries(plat.attributes)) sub.setAttribute(k,new THREE.BufferAttribute(a.array.slice(a0*a.itemSize,a1*a.itemSize),a.itemSize,a.normalized));
      const me=new THREE.Mesh(sub,m); me.name=o.name; me.position.copy(o.position); me.quaternion.copy(o.quaternion); me.scale.copy(o.scale); o.parent.add(me);
    }
    o.removeFromParent();
  }
}
export function standardiser(racine){
  const faits=new Map();
  racine.traverse(o=>{ if(!o.isMesh) return; const m=o.material; if(!m||m.isMeshStandardMaterial||m.isMeshBasicMaterial) return;
    if(!faits.has(m)){ const s=new THREE.MeshStandardMaterial({color:m.color?.clone()||new THREE.Color(0xffffff),map:m.map||null,normalMap:m.normalMap||null,
        emissive:m.emissive?.clone()||new THREE.Color(0),emissiveMap:m.emissiveMap||null,alphaMap:m.alphaMap||null,transparent:!!m.transparent,opacity:m.opacity??1,
        side:m.side,vertexColors:!!m.vertexColors,roughness:m.shininess!==undefined?Math.max(0.15,1-Math.min(m.shininess,100)/120):0.7,metalness:0});
      s.name=m.name; faits.set(m,s); }
    o.material=faits.get(m); });
}
