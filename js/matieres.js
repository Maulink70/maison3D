// Textures dessinées en code (aucune image à télécharger), d'après le questionnaire des textures de Mauro (8 octobre 2026).
// Chaque texture est un motif neutre et répétable (gris clair autour de 1) que la couleur du matériau teinte, plus un relief
// (bumpMap) pour le grain. Les coordonnées de texture sont recalculées en mètres, pour que le motif garde son échelle
// quelle que soit la taille du meuble.
import * as THREE from 'three';

// ---------- bruit répétable ----------
function graine(s){ return ()=>{ s=(s+0x6D2B79F5)|0; let t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
// bruit de valeur périodique (se raccorde sur les bords) : n × n valeurs entre 0 et 1, grille de « cellules » cases
function bruit(n,cellules,alea){
  const g=new Float32Array(cellules*cellules).map(()=>alea()), out=new Float32Array(n*n), lisse=t=>t*t*(3-2*t);
  for(let y=0;y<n;y++){ const fy=y/n*cellules, y0=Math.floor(fy), ty=lisse(fy-y0), y1=(y0+1)%cellules;
    for(let x=0;x<n;x++){ const fx=x/n*cellules, x0=Math.floor(fx), tx=lisse(fx-x0), x1=(x0+1)%cellules;
      const a=g[y0*cellules+x0], b=g[y0*cellules+x1], c=g[y1*cellules+x0], d=g[y1*cellules+x1];
      out[y*n+x]=(a+(b-a)*tx)+((c+(d-c)*tx)-(a+(b-a)*tx))*ty; } }
  return out;
}
function fbm(n,octaves,alea,base=4){ const out=new Float32Array(n*n); let amp=1, tot=0;
  for(let o=0;o<octaves;o++){ const b=bruit(n,base<<o,alea); for(let i=0;i<out.length;i++) out[i]+=b[i]*amp; tot+=amp; amp*=0.5; }
  for(let i=0;i<out.length;i++) out[i]/=tot; return out; }

// Pixels à partir d'une fonction (x, y) → [r, g, b] (0..255) : image carrée de n × n, en tableau
function toile(n,pixel){
  const d=new Uint8ClampedArray(n*n*4);   // valeurs bornées à 0..255, comme dans une toile
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){ const [r,g,b]=pixel(x,y), i=(y*n+x)*4; d[i]=r; d[i+1]=g; d[i+2]=b; d[i+3]=255; }
  return {d,n};
}
// Les textures dessinées en code partent vers la carte graphique en tableau de pixels (DataTexture), jamais par une toile
// 2D (CanvasTexture) : sur le PC de Mauro, à la première ouverture, la copie directe d'une toile donnait parfois une
// texture vide, et tout ce qui la portait sortait noir (murs, canapé, chaises, cuisine, escalier ; normal après
// rechargement, 9 octobre 2026)
function pixels(d,w,h,couleur){
  const t=new THREE.DataTexture(d,w,h,THREE.RGBAFormat); t.flipY=true; t.generateMipmaps=true;
  t.minFilter=THREE.LinearMipmapLinearFilter; t.magFilter=THREE.LinearFilter; t.needsUpdate=true;
  if(couleur) t.colorSpace=THREE.SRGBColorSpace; return t;
}
function texture({d,n},couleur=true){ const t=pixels(d,n,n,couleur); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; return t; }
// Texture d'une toile 2D dessinée (carrelages, ciel, montagnes, patchwork) : ses pixels sont relus et envoyés en tableau
export function textureDe(c,couleur=true){
  const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  return pixels(new Uint8ClampedArray(d),c.width,c.height,couleur);
}
const gris=v=>{ const g=Math.max(0,Math.min(255,Math.round(v*255))); return [g,g,g]; };

// ---------- les motifs (taille = côté du motif en mètres) ----------
const N=256;
const MOTIFS={
  // cuir : réseau de plis fins (bruit « en crête ») et pores, très légères variations de teinte
  cuir:{taille:0.25, dessin(){ const a=graine(7), f=fbm(N,3,a,4), g=fbm(N,3,a,16), p=bruit(N,128,a);
    const pli=i=>Math.min(1,Math.abs(g[i]-0.5)*6), pore=i=>p[i]>0.8?(p[i]-0.8)*2.5:0;
    return {map:toile(N,(x,y)=>{ const i=y*N+x; return gris(0.95+0.04*f[i]-0.035*(1-pli(i))-0.04*pore(i)); }),
      bump:toile(N,(x,y)=>{ const i=y*N+x; return gris(0.25+0.6*pli(i)-0.3*pore(i)); })}; }, bumpScale:0.35},
  // tissu : fils croisés (toile), légère irrégularité
  tissu:{taille:0.10, dessin(){ const a=graine(11), f=fbm(N,3,a,8), fils=32;
    const v=(x,y)=>{ const u=(x/N*fils)%1, w=(y/N*fils)%1, trame=Math.abs(Math.sin(u*Math.PI)), chaine=Math.abs(Math.sin(w*Math.PI)); return ((x/N*fils|0)+(y/N*fils|0))%2?trame:chaine; };
    return {map:toile(N,(x,y)=>gris(0.86+0.1*v(x,y)+0.05*f[y*N+x])), bump:toile(N,(x,y)=>gris(v(x,y)))}; }, bumpScale:0.8},
  // tapis à poils longs (précisé par Mauro) : mèches de 2 à 5 cm couchées en tous sens, racine plus sombre que la pointe,
  // regroupées en touffes ombrées. Mèches tracées directement dans un tableau de pixels (le canevas serait bien plus lent)
  tapis:{taille:0.36, dessin(){ const a=graine(5), f=fbm(N,3,a,4), touffes=fbm(N,2,a,12), poil=new Float32Array(N*N).fill(0.78);
    for(let i=0;i<7000;i++){ const px=a()*N, py=a()*N, ang=a()*Math.PI*2, l=14+a()*22, courbe=(a()-0.5)*0.06, g=0.86+a()*0.12, w=a()<0.5?1:2;
      let x=px, y=py, an=ang;
      for(let t=0;t<=l;t+=0.6){ an+=courbe; x+=Math.cos(an)*0.6; y+=Math.sin(an)*0.6; const v=g*(0.86+0.14*t/l);
        for(let k=0;k<w;k++){ const X=((Math.round(x+k*Math.sin(an))%N)+N)%N, Y=((Math.round(y-k*Math.cos(an))%N)+N)%N; poil[Y*N+X]=v; } } }
    const v=(x,y)=>{ const i=y*N+x; return poil[i]*(0.9+0.1*f[i])*(0.94+0.06*touffes[i]); };
    return {map:toile(N,(x,y)=>gris(Math.min(1,v(x,y)*1.08))), bump:toile(N,(x,y)=>gris(v(x,y)))}; }, bumpScale:2.2},
  // bois : fil droit, cernes fins et sombres légèrement ondulés, stries le long du fil
  bois:{taille:0.80, dessin(){ const a=graine(3), f=fbm(N,3,a,2), fin=fbm(N,2,a,32), stries=new Float32Array(N).map(()=>a());
    const v=(x,y)=>{ const i=y*N+x, k=y/N*18+(f[i]-0.5)*1.4, cerne=Math.exp(-Math.abs(Math.sin(k*Math.PI))*9);
      return 0.9+0.05*(f[i]-0.5)-0.09*cerne+0.035*(stries[y]-0.5)+0.02*(fin[i]-0.5); };
    return {map:toile(N,(x,y)=>{ const g=v(x,y); return [g*255,g*247,g*236].map(Math.round); }), bump:toile(N,(x,y)=>gris(v(x,y)))}; }, bumpScale:0.3},
  // pierre à aspérités : grain moucheté, petits trous
  pierre:{taille:0.40, dessin(){ const a=graine(13), f=fbm(N,4,a,4), m=fbm(N,2,a,48), trous=new Float32Array(N*N).map(()=>a());
    const v=i=>0.78+0.16*f[i]+0.1*(m[i]-0.5)-(trous[i]>0.985?0.25:0)+(trous[i]<0.01?0.15:0);
    return {map:toile(N,(x,y)=>gris(v(y*N+x))), bump:toile(N,(x,y)=>gris(0.5*m[y*N+x]+0.5*f[y*N+x]-(trous[y*N+x]>0.985?0.4:0)))}; }, bumpScale:2.2},
  // peinture un peu rugueuse : grain très fin, presque invisible de loin
  peinture:{taille:0.50, dessin(){ const a=graine(17), f=fbm(N,2,a,64);
    return {map:toile(N,(x,y)=>gris(0.975+0.025*f[y*N+x])), bump:toile(N,(x,y)=>gris(f[y*N+x]))}; }, bumpScale:0.6},
  // inox brossé : stries fines dans un sens
  inox:{taille:0.30, dessin(){ const a=graine(19), lignes=new Float32Array(N).map(()=>a()), f=fbm(N,2,a,8);
    return {map:toile(N,(x,y)=>gris(0.9+0.08*lignes[y]+0.03*f[y*N+x])), bump:toile(N,(x,y)=>gris(lignes[y]))}; }, bumpScale:0.15},

  // ---- bibliothèque de matières (étape 4) ----
  // lin : toile à gros fils irréguliers (flammes)
  lin:{taille:0.12, dessin(){ const a=graine(23), f=fbm(N,3,a,8), fils=24, ix=new Float32Array(N).map(()=>0.8+0.4*a()), iy=new Float32Array(N).map(()=>0.8+0.4*a());
    const v=(x,y)=>{ const u=(x/N*fils)%1, w=(y/N*fils)%1, tr=Math.pow(Math.abs(Math.sin(u*Math.PI)),0.6)*ix[x], ch=Math.pow(Math.abs(Math.sin(w*Math.PI)),0.6)*iy[y];
      return ((x/N*fils|0)+(y/N*fils|0))%2?tr:ch; };
    return {map:toile(N,(x,y)=>gris(0.8+0.14*v(x,y)+0.06*(f[y*N+x]-0.5))), bump:toile(N,(x,y)=>gris(Math.min(1,v(x,y))))}; }, bumpScale:1.0},
  // velours : doux, légères marques d'écrasement
  velours:{taille:0.30, dessin(){ const a=graine(29), f=fbm(N,4,a,4), g=fbm(N,2,a,64);
    return {map:toile(N,(x,y)=>gris(0.87+0.11*f[y*N+x]+0.03*(g[y*N+x]-0.5))), bump:toile(N,(x,y)=>gris(0.5+0.5*(g[y*N+x]-0.5)))}; }, bumpScale:0.3},
  // bouclette : petites boucles de laine serrées
  bouclette:{taille:0.15, dessin(){ const a=graine(31), h=new Float32Array(N*N);
    for(let i=0;i<2600;i++){ const cx=a()*N, cy=a()*N, r=2+a()*2.5;
      for(let dy=-5;dy<=5;dy++) for(let dx=-5;dx<=5;dx++){ const v=Math.max(0,1-Math.abs(Math.hypot(dx,dy)-r)/1.3); if(v<=0) continue;
        const k=((Math.round(cy+dy)%N+N)%N)*N+((Math.round(cx+dx)%N+N)%N); if(v>h[k]) h[k]=v; } }
    return {map:toile(N,(x,y)=>gris(0.8+0.18*h[y*N+x])), bump:toile(N,(x,y)=>gris(h[y*N+x]))}; }, bumpScale:1.6},
  // moquette : poil ras et dense
  moquette:{taille:0.20, dessin(){ const a=graine(67), g=fbm(N,2,a,64), f=fbm(N,3,a,4);
    return {map:toile(N,(x,y)=>gris(0.86+0.1*(g[y*N+x]-0.5)+0.06*(f[y*N+x]-0.5))), bump:toile(N,(x,y)=>gris(g[y*N+x]))}; }, bumpScale:1.2},
  // marbre : veines sinueuses fines et larges, sans relief
  marbre:{taille:0.90, dessin(){ const a=graine(37), f=fbm(N,5,a,2), g=fbm(N,3,a,6);
    const v=(x,y)=>{ const i=y*N+x, k=(x+y)/N*2+f[i]*3.2, veine=Math.exp(-Math.abs(Math.sin(k*Math.PI))*14), fine=Math.exp(-Math.abs(Math.sin((k*3+g[i]*2)*Math.PI))*22);
      return 0.97-0.3*veine-0.12*fine+0.03*(g[i]-0.5); };
    return {map:toile(N,(x,y)=>gris(v(x,y))), bump:toile(N,()=>gris(0.5))}; }, bumpScale:0},
  // béton : nuages de teinte et petites bulles
  beton:{taille:0.80, dessin(){ const a=graine(41), f=fbm(N,4,a,4), m=fbm(N,2,a,32), p=new Float32Array(N*N).map(()=>a());
    const v=i=>0.86+0.12*(f[i]-0.5)+0.05*(m[i]-0.5)-(p[i]>0.993?0.18:0);
    return {map:toile(N,(x,y)=>gris(v(y*N+x))), bump:toile(N,(x,y)=>gris(0.5+0.3*(m[y*N+x]-0.5)-(p[y*N+x]>0.993?0.35:0)))}; }, bumpScale:0.8},
  // terrazzo : éclats de pierre sombres et blancs dans un liant clair
  terrazzo:{taille:0.50, dessin(){ const a=graine(59), base=fbm(N,2,a,16), h=new Float32Array(N*N).fill(-1);
    for(let i=0;i<420;i++){ const cx=a()*N, cy=a()*N, r=1.5+a()*a()*7, ton=a()<0.5?0.5+a()*0.25:0.99, an=a()*Math.PI, e=0.5+a()*0.5, co=Math.cos(an), si=Math.sin(an);
      for(let dy=-8;dy<=8;dy++) for(let dx=-8;dx<=8;dx++){ const X=dx*co+dy*si, Y=(-dx*si+dy*co)/e; if(X*X+Y*Y>r*r) continue;
        h[((Math.round(cy+dy)%N+N)%N)*N+((Math.round(cx+dx)%N+N)%N)]=ton; } }
    return {map:toile(N,(x,y)=>{ const i=y*N+x; return gris(h[i]>=0?h[i]:0.88+0.06*(base[i]-0.5)); }), bump:toile(N,()=>gris(0.5))}; }, bumpScale:0},
  // carrelage : 2 × 2 carreaux à joints fins (dalle : joints plus fins pour les grands carreaux)
  carrelage:{taille:0.60, dessin(){ return carreaux(43,2); }, bumpScale:1.2},
  dalle:{taille:1.20, dessin(){ return carreaux(44,1); }, bumpScale:1.2},
  // parquet : lames de 15 cm, décalées, une teinte par lame, fil du bois
  parquet:{taille:1.20, dessin(){ const a=graine(47), cols=8, w=N/cols, coupes=new Float32Array(cols).map(()=>Math.floor(a()*N)), tons=new Float32Array(cols).map(()=>0.86+0.12*a()), f=fbm(N,3,a,2), fin=fbm(N,2,a,32);
    const v=(x,y)=>{ const c=Math.floor(x/w), lx=x-c*w, ly=(y-coupes[c]+N)%N, i=y*N+x;
      if(lx<1||ly<1) return 0.55;
      const cerne=Math.exp(-Math.abs(Math.sin((lx/w*2.5+(f[i]-0.5)*1.2+c*0.37)*Math.PI))*9); return tons[c]*(0.95-0.07*cerne+0.03*(fin[i]-0.5)); };
    return boisDe(v); }, bumpScale:0.5},
  // parquet en chevron (point de Hongrie) : lames à 45°, une colonne sur deux dans l'autre sens
  chevron:{taille:0.80, dessin(){ const a=graine(53), C=N/2, W=32, tons=new Float32Array(64).map(()=>0.84+0.14*a()), f=fbm(N,3,a,2), fin=fbm(N,2,a,32);
    const v=(x,y)=>{ const c=Math.floor(x/C), lx=x-c*C, s=c%2?lx:C-lx, u=(y+s)%N, k=Math.floor(u/W), lu=u%W, i=y*N+x;
      if(lu<1||lx<1) return 0.55;
      const cerne=Math.exp(-Math.abs(Math.sin((lu/W*2+(f[i]-0.5))*Math.PI))*8); return tons[(k+c*13)%64]*(0.95-0.06*cerne+0.03*(fin[i]-0.5)); };
    return boisDe(v); }, bumpScale:0.5},
  // lambris : lames verticales de 12 cm à rainure
  lambris:{taille:0.48, dessin(){ const a=graine(73), cols=4, w=N/cols, tons=new Float32Array(cols).map(()=>0.9+0.08*a()), f=fbm(N,3,a,2), fin=fbm(N,2,a,32);
    const v=(x,y)=>{ const c=Math.floor(x/w), lx=x%w, i=y*N+x; if(lx<3) return 0.62;
      const cerne=Math.exp(-Math.abs(Math.sin((lx/w*2.2+(f[i]-0.5)*1.2+c*0.4)*Math.PI))*9); return tons[c]*(0.95-0.07*cerne+0.03*(fin[i]-0.5)); };
    return boisDe(v); }, bumpScale:0.6},
  // brique : briques de 25 × 6 cm à joints clairs, une rangée sur deux décalée
  brique:{taille:0.50, dessin(){ const a=graine(71), f=fbm(N,3,a,8), tons=new Float32Array(64).map(()=>0.8+0.18*a()), H=32, L=128, M=4;
    const joint=(x,y)=>{ const r=Math.floor(y/H), xx=(x+(r%2?L/2:0))%N; return xx%L<M||y%H<M; };
    const v=(x,y)=>{ const r=Math.floor(y/H), b=Math.floor(((x+(r%2?L/2:0))%N)/L); return joint(x,y)?0.95:tons[(r*3+b)%64]*(0.92+0.1*(f[y*N+x]-0.5)); };
    return {map:toile(N,(x,y)=>gris(v(x,y))), bump:toile(N,(x,y)=>gris(joint(x,y)?0.15:0.7+0.2*f[y*N+x]))}; }, bumpScale:1.6},
  // rotin, cannage : brins tressés
  rotin:{taille:0.12, dessin(){ const a=graine(61), f=fbm(N,2,a,16), B=32;
    const v=(x,y)=>{ const bx=Math.floor(x/B), by=Math.floor(y/B), lx=x%B, ly=y%B; if(lx<2||ly<2) return 0.3;
      const brin=(bx+by)%2?Math.abs(Math.sin(lx/B*4*Math.PI)):Math.abs(Math.sin(ly/B*4*Math.PI)); return 0.72+0.22*brin+0.05*(f[y*N+x]-0.5); };
    return {map:toile(N,(x,y)=>gris(v(x,y))), bump:toile(N,(x,y)=>gris(v(x,y)))}; }, bumpScale:1.4}
};
// carreaux : 2 × 2 par motif, joints de j pixels de chaque côté, légère différence de teinte d'un carreau à l'autre
function carreaux(s,j){ const a=graine(s), f=fbm(N,3,a,8), tons=[0,1,2,3].map(()=>0.93+0.05*a()), T=N/2;
  const joint=(x,y)=>{ const tx=x%T, ty=y%T; return tx<j||ty<j||tx>=T-j||ty>=T-j; };
  return {map:toile(N,(x,y)=>gris(joint(x,y)?0.62:tons[(x>=T?1:0)+(y>=T?2:0)]+0.03*(f[y*N+x]-0.5))), bump:toile(N,(x,y)=>gris(joint(x,y)?0.2:0.75))}; }
// bois en lames : teinte chaude, relief du fil
const boisDe=v=>({map:toile(N,(x,y)=>{ const g=v(x,y); return [g*255,g*247,g*236].map(Math.round); }), bump:toile(N,(x,y)=>gris(v(x,y)))});
const cache={};
export function motif(nom){
  if(!cache[nom]){ const m=MOTIFS[nom], d=m.dessin(); cache[nom]={taille:m.taille, bumpScale:m.bumpScale, map:texture(d.map,true), bump:texture(d.bump,false), pixels:d.map}; }
  return cache[nom];
}
export const motifExiste=nom=>!!MOTIFS[nom];
export const motifPret=nom=>!!cache[nom];

// Habille un matériau d'un motif (le matériau garde sa couleur, qui teinte le motif)
export function habiller(mat,nom,{couleur,rugosite}={}){
  const m=motif(nom); mat.map=m.map; mat.bumpMap=m.bump; mat.bumpScale=m.bumpScale;
  if(couleur!==undefined) mat.color.set(couleur); if(rugosite!==undefined) mat.roughness=rugosite;
  mat.userData.motif=nom; mat.userData.taille=m.taille; mat.needsUpdate=true; return mat;
}

// Coordonnées de texture en mètres, en coordonnées monde : chaque triangle est projeté selon sa normale
// (dessus → x, z ; face tournée vers x → z, y ; face tournée vers z → x, y). Les normales du maillage restent intactes.
const a=new THREE.Vector3(), b=new THREE.Vector3(), c=new THREE.Vector3(), n=new THREE.Vector3();
export function uvMetres(mesh,taille){
  mesh.updateMatrixWorld(true);
  const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
  const p=g.attributes.position, uv=new Float32Array(p.count*2), w=mesh.matrixWorld;
  for(let i=0;i+2<p.count;i+=3){
    a.fromBufferAttribute(p,i).applyMatrix4(w); b.fromBufferAttribute(p,i+1).applyMatrix4(w); c.fromBufferAttribute(p,i+2).applyMatrix4(w);
    n.subVectors(c,b).cross(b.clone().sub(a)); const ax=Math.abs(n.x), ay=Math.abs(n.y), az=Math.abs(n.z);
    const k=ay>=ax&&ay>=az?0:ax>=az?1:2;
    [a,b,c].forEach((v,j)=>{ const u=k===1?v.z:v.x, t=k===0?v.z:v.y; uv[(i+j)*2]=u/taille; uv[(i+j)*2+1]=t/taille; });
  }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); mesh.geometry=g; mesh.userData.uvm=true;
}

// Parcourt un ensemble : chaque maillage dont le matériau porte un motif reçoit des coordonnées en mètres (une seule fois)
export function poserCoordonnees(racine){
  const liste=[];
  racine.traverse(o=>{ if(!o.isMesh||o.userData.dos||o.userData.uvm) return; const m=o.material;
    if(!Array.isArray(m)&&m.userData?.taille) liste.push(o); });
  for(const o of liste) uvMetres(o,o.material.userData.taille);
}

// Matériaux des éléments construits en code (nom du matériau → motif), d'après le questionnaire des textures
const PAR_NOM={cuir:'cuir', cuirClair:'cuir', etage_cuirNoir:'cuir',
  tissuBleu:'tissu', lingeBleu:'tissu', lingeMarine:'tissu', drap:'tissu', tissuBeige:'tissu', etage_gris:'tissu', etage_tissuNoir:'tissu',
  boisCuisine:'bois', chene:'bois', erable:'bois', boisBrunClair:'bois', etage_hetre:'bois',
  pierre:'pierre', inox:'inox'};
export function habillerConstruits(racine){
  racine.traverse(o=>{ if(!o.isMesh) return; const m=o.material;
    if(!Array.isArray(m)&&!m.userData.motif&&PAR_NOM[m.name]) habiller(m,PAR_NOM[m.name]); });
}

// Matériaux du modèle SketchUp, élément par élément (matériau cloné pour ne pas toucher les autres éléments) :
// nom du matériau → [motif, couleur]
export function habillerModele(racine,table){
  for(const [nom,t] of Object.entries(table)){ const nd=racine.getObjectByName(nom); if(!nd) continue; const faits=new Map();
    nd.traverse(o=>{ if(!o.isMesh||Array.isArray(o.material)) return; const r=t[o.material.name]; if(!r) return;
      if(!faits.has(o.material)) faits.set(o.material,habiller(o.material.clone(),r[0],{couleur:r[1]}));
      o.material=faits.get(o.material); }); }
}
