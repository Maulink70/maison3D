// Dehors, visible en 1re personne seulement (par les fenêtres et les portes ouvertes) : ciel avec nuages, montagnes
// enneigées au loin, collines boisées, pelouse en relief, arbres (demande de Mauro du 9 octobre 2026). Tout est dessiné
// en code au premier passage en 1re personne : aucune image à télécharger.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {app} from './app.js';

const C={x:15.4, z:-21.2};                       // centre de la maison
const R_CIEL=285;                                // la caméra voit jusqu'à 300 m

// ---------- bruit déterministe ----------
function hash(x,y){ let h=(Math.imul(x,374761393)+Math.imul(y,668265263))|0; h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; }
function bruit(x,y){ const xi=Math.floor(x), yi=Math.floor(y), tx=x-xi, ty=y-yi, sx=tx*tx*(3-2*tx), sy=ty*ty*(3-2*ty);
  const a=hash(xi,yi), b=hash(xi+1,yi), c=hash(xi,yi+1), d=hash(xi+1,yi+1); return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy; }
function fbm(x,y,o=4){ let s=0,a=1,t=0; for(let i=0;i<o;i++){ s+=a*bruit(x,y); t+=a; x=x*2.03+17; y=y*2.03+31; a*=0.5; } return s/t; }
const lisse=(a,b,t)=>{ t=Math.min(1,Math.max(0,(t-a)/(b-a))); return t*t*(3-2*t); };
function alea(s){ return ()=>{ s=(s*16807)%2147483647; return (s-1)/2147483646; }; }

// Relief de la pelouse : plat autour de la maison, ondulations douces puis collines vers le lointain
export function hauteurSol(x,z){
  const d=Math.hypot(x-C.x,z-C.z);
  return -0.03+(fbm(x/9,z/9,3)-0.5)*0.8*lisse(12,28,d)+(fbm(x/45+5,z/45,4)-0.42)*16*lisse(28,110,d);
}

// ---------- ciel : dégradé et nuages projetés sur un plafond à 1 500 m (plus gros au-dessus, serrés vers l'horizon) ----------
function texCiel(){
  const W=768, H=384, c=document.createElement('canvas'); c.width=W; c.height=H;
  const x=c.getContext('2d'), img=x.createImageData(W,H), px=img.data;
  const zenith=[88,135,196], horizon=[214,226,236];
  for(let j=0;j<H;j++){ const e=Math.max(0,(0.5-j/H)*Math.PI), t=Math.pow(e/(Math.PI/2),0.45);   // élévation (rad), 0 à l'horizon
    for(let i=0;i<W;i++){ const k=(j*W+i)*4; let r=horizon[0]+(zenith[0]-horizon[0])*t, g=horizon[1]+(zenith[1]-horizon[1])*t, b=horizon[2]+(zenith[2]-horizon[2])*t;
      if(e>0.012){ const phi=i/W*Math.PI*2, dist=Math.min(9000,1500/Math.tan(e)), u=Math.cos(phi)*dist/900, v=Math.sin(phi)*dist/900;
        const n=fbm(u,v,5), dens=lisse(0.5,0.72,n)*lisse(0.012,0.12,e), ombre=0.82+0.18*lisse(0.55,0.8,fbm(u*1.7+9,v*1.7,3));
        r+=(248*ombre-r)*dens; g+=(249*ombre-g)*dens; b+=(252*ombre-b)*dens; }
      px[k]=r; px[k+1]=g; px[k+2]=b; px[k+3]=255; } }
  x.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}

// ---------- montagnes et collines : anneaux de relief autour de la maison, couleurs voilées par la distance ----------
function anneau(R,n,hauteur,couleur){
  const pos=[], col=[], idx=[], rangs=[-3,0.5,0.8,1], c=new THREE.Color();
  for(let i=0;i<=n;i++){ const phi=i/n*Math.PI*2, h=hauteur(phi), cx=C.x+Math.cos(phi)*R, cz=C.z+Math.sin(phi)*R;
    for(const [k,f] of rangs.entries()){ pos.push(cx,k===0?f:h*f,cz); couleur(h,k,phi,c); col.push(c.r,c.g,c.b); } }
  for(let i=0;i<n;i++) for(let k=0;k<3;k++){ const a=i*4+k, b=(i+1)*4+k; idx.push(a,b,a+1,b,b+1,a+1); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx);
  return new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
}
const periodique=(phi,f,o=4,dec=0)=>fbm(Math.cos(phi)*f+dec,Math.sin(phi)*f+dec,o);
const voile=new THREE.Color(0xc4d2df);
// Chaîne de montagnes peinte sur un cylindre transparent au-dessus de sa crête : relief (crêtes aiguës), versants
// éclairés ou à l'ombre, roche striée, neige au-dessus d'une limite irrégulière, voile de distance vers le bas
function chaine(R,haut,profil,{roche,neige,limite,voileBas,voileHaut,graine}){
  const W=2048, H=320, c=document.createElement('canvas'); c.width=W; c.height=H;
  const x=c.getContext('2d'), img=x.createImageData(W,H), px=img.data, hs=new Float32Array(W);
  for(let i=0;i<W;i++) hs[i]=profil(i/W*Math.PI*2);
  const R0=new THREE.Color(roche), N0=new THREE.Color(neige), col=new THREE.Color();   // limite : hauteur à partir de laquelle un sommet est enneigé
  const lisseH=new Float32Array(W);                                  // crête lissée : pente des grands versants
  for(let i=0;i<W;i++){ let m=0; for(let d=-12;d<=12;d++) m+=hs[(i+d+W)%W]; lisseH[i]=m/25; }
  for(let i=0;i<W;i++){ const h=hs[i], pente=(lisseH[(i+8)%W]-lisseH[(i-8+W)%W])/16/(Math.PI*2*R/W), cap=5+10*fbm(i/22+graine,1.5,3);
    for(let j=0;j<H;j++){ const y=haut*(1-j/H), k=(j*W+i)*4; if(y>h){ px[k+3]=0; continue; }
      const prof=1-y/Math.max(h,1);                                    // 0 sur la crête, 1 au pied
      // facettes : près de la crête la pente du versant, plus bas des arêtes qui descendent (bruit étiré en hauteur)
      const arete=fbm(i/26+graine,y/38,3)-fbm((i+5)/26+graine,y/38,3);
      const lum=0.8+0.3*Math.max(-1,Math.min(1,(1-prof)*pente*1.4+prof*arete*9))+0.06*(fbm(i/8,j/6,2)-0.5);
      const couloir=fbm(i/18+graine,y/55,3)>0.6&&y>h*0.5;              // neige dans les couloirs
      const neigeHaut=h>limite(h)&&y>h-cap;
      if(neigeHaut||(couloir&&h>limite(h)*0.85)) col.copy(N0).multiplyScalar(0.84+0.18*lum); else col.copy(R0).multiplyScalar(lum);
      col.lerp(voile,voileHaut+(voileBas-voileHaut)*Math.pow(prof,1.5));
      px[k]=Math.min(255,col.r*255); px[k+1]=Math.min(255,col.g*255); px[k+2]=Math.min(255,col.b*255); px[k+3]=255; } }
  x.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=THREE.RepeatWrapping; t.anisotropy=4;
  const g=new THREE.CylinderGeometry(R,R,haut,240,1,true); g.translate(C.x,haut/2-6,C.z);
  return new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide,alphaTest:0.5}));
}
function montagnes(){
  // les plus hautes face au salon (baie et grandes fenêtres), crêtes aiguës
  const face=phi=>0.55+0.45*Math.max(0,Math.cos(phi-Math.PI*0.35));
  const loin=chaine(278,110,phi=>{ const pic=1-Math.abs(periodique(phi,4.2,3,3)*2-1), base=periodique(phi,2.1,4);
      return (22+30*base+38*pic*pic*base)*face(phi)*1.15; },
    {roche:0x7d8ea6, neige:0xf4f7fb, limite:()=>52, voileBas:0.68, voileHaut:0.36, graine:3});
  const milieu=chaine(238,70,phi=>10+30*Math.pow(periodique(phi,3.2,4,11),1.2)*(0.75+0.25*face(phi)),
    {roche:0x5f7388, neige:0xeef2f7, limite:()=>44, voileBas:0.55, voileHaut:0.32, graine:9});
  // collines boisées : sommet dentelé (cimes des arbres)
  const pres=anneau(160,520,phi=>5+15*periodique(phi,4.3,3,23)+1.3*(hash(Math.floor(phi*240),7)-0.5),
    (h,k,phi,c)=>{ c.set(k===0?0x4d6b45:k===3?0x3c5a38:0x45633f); c.lerp(voile,0.22); });
  return [loin,milieu,pres];
}

// ---------- pelouse : relief, nuances de vert, brins dessinés (motif répété tous les 1,5 m) ----------
function texHerbe(){
  const N=256, buf=new Float32Array(N*N*3).fill(0), a=alea(77);
  for(let i=0;i<N*N;i++){ buf[i*3]=0.86; buf[i*3+1]=0.92; buf[i*3+2]=0.78; }
  for(let k=0;k<14000;k++){ const x=a()*N, y=a()*N, l=3+a()*6, ang=-Math.PI/2+(a()-0.5)*0.9, v=0.62+a()*0.45, j=0.9+a()*0.2;
    for(let t=0;t<l;t+=0.7){ const X=((Math.round(x+Math.cos(ang)*t)%N)+N)%N, Y=((Math.round(y+Math.sin(ang)*t)%N)+N)%N, i=(Y*N+X)*3;
      buf[i]=v*0.85*j; buf[i+1]=v*j; buf[i+2]=v*0.72*j; } }
  const c=document.createElement('canvas'); c.width=c.height=N; const x=c.getContext('2d'), img=x.createImageData(N,N);
  for(let i=0;i<N*N;i++){ img.data[i*4]=Math.min(255,buf[i*3]*255); img.data[i*4+1]=Math.min(255,buf[i*3+1]*255); img.data[i*4+2]=Math.min(255,buf[i*3+2]*255); img.data[i*4+3]=255; }
  x.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t;
}
function pelouse(){
  const T=560, n=110, g=new THREE.PlaneGeometry(T,T,n,n); g.rotateX(-Math.PI/2); g.translate(C.x,0,C.z);
  const p=g.attributes.position, uv=g.attributes.uv, col=[], c=new THREE.Color(), clair=new THREE.Color(0x86a957), fonce=new THREE.Color(0x56803a);
  for(let i=0;i<p.count;i++){ const x=p.getX(i), z=p.getZ(i), d=Math.hypot(x-C.x,z-C.z);
    p.setY(i,d>T/2?-3:hauteurSol(x,z)); uv.setXY(i,x/1.5,z/1.5);
    c.copy(fonce).lerp(clair,fbm(x/14,z/14,3)); c.lerp(voile,0.3*lisse(60,250,d)); col.push(c.r,c.g,c.b); }
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.computeVertexNormals();
  return new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,map:texHerbe()}));
}

// ---------- arbres : sapins et feuillus en instances (4 appels de dessin pour tous) ----------
function arbres(){
  const sapinTronc=new THREE.CylinderGeometry(0.12,0.22,2,6).translate(0,1,0);
  const sapin=mergeGeometries([new THREE.ConeGeometry(1.7,3.4,8).translate(0,3.2,0),new THREE.ConeGeometry(1.3,3,8).translate(0,4.9,0),new THREE.ConeGeometry(0.85,2.6,8).translate(0,6.5,0)]);
  const feuTronc=new THREE.CylinderGeometry(0.16,0.26,3,6).translate(0,1.5,0);
  const boule=(r,x,y,z)=>new THREE.IcosahedronGeometry(r,1).scale(1,0.85,1).translate(x,y,z);
  const feuillu=mergeGeometries([boule(2.1,0,4.6,0),boule(1.6,1.3,4.1,0.4),boule(1.5,-1.1,4.2,-0.6),boule(1.4,0.2,5.6,-0.9)]);
  const bois=new THREE.MeshLambertMaterial({color:0x5b4632}), feuille=new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true});
  const a=alea(4242), places=[];
  const libre=(x,z)=>!(x>11-9&&x<19.7+9&&z>-28.2-9&&z<-14.1+9);
  for(let k=0;k<900&&places.length<200;k++){
    const loin=places.length>=70, ang=a()*Math.PI*2, r=loin?115+a()*35:18+Math.pow(a(),0.8)*85, x=C.x+Math.cos(ang)*r, z=C.z+Math.sin(ang)*r;
    if(!libre(x,z)) continue;
    places.push({x,z,y:hauteurSol(x,z),s:(loin?0.9:0.75)+a()*0.6,sapin:a()<(loin?0.7:0.45),rot:a()*Math.PI*2,teinte:a()});
  }
  const groupes=[];
  for(const type of [true,false]){
    const l=places.filter(q=>q.sapin===type), m=new THREE.Matrix4(), q4=new THREE.Quaternion(), c=new THREE.Color();
    const tronc=new THREE.InstancedMesh(type?sapinTronc:feuTronc,bois,l.length), houppe=new THREE.InstancedMesh(type?sapin:feuillu,feuille,l.length);
    l.forEach((q,i)=>{ m.compose(new THREE.Vector3(q.x,q.y-0.1,q.z),q4.setFromAxisAngle(new THREE.Vector3(0,1,0),q.rot),new THREE.Vector3(q.s,q.s,q.s));
      tronc.setMatrixAt(i,m); houppe.setMatrixAt(i,m);
      c.set(type?0x2f5232:0x4f7a35).offsetHSL((q.teinte-0.5)*0.04,0,(q.teinte-0.5)*0.12); houppe.setColorAt(i,c); });
    groupes.push(tronc,houppe);
  }
  return groupes;
}

// Cage d'escalier de l'immeuble, derrière la porte d'entrée et la petite fenêtre du coin bureau (précisé par Mauro :
// « l'intérieur de l'immeuble, une cage d'escalier avec ascenseur », fait simple). Boîte vue de l'intérieur (faces arrière) :
// depuis l'appartement, on voit ses murs du fond à travers la porte ou la fenêtre, et non le paysage.
function cageEscalier(){
  const g=new THREE.Group(), x0=8.4, x1=12.66, z0=-20.905, z1=-16.4, H=6.2;
  const lam=(c,o={})=>new THREE.MeshLambertMaterial({color:c,...o});
  const mur=lam(0xe6e0d4,{side:THREE.BackSide}), sol=lam(0x8f8b85,{side:THREE.BackSide}), plafond=lam(0xf3f1ec,{side:THREE.BackSide});
  const boite=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,H,z1-z0),[mur,mur,plafond,sol,mur,mur]);
  boite.position.set((x0+x1)/2,H/2,(z0+z1)/2); g.add(boite);
  const pave=(m,a0,a1,b0,b1,c0,c1)=>{ const o=new THREE.Mesh(new THREE.BoxGeometry(a1-a0,b1-b0,c1-c0),m); o.position.set((a0+a1)/2,(b0+b1)/2,(c0+c1)/2); g.add(o); return o; };
  // ascenseur sur le mur du fond, en face de la porte d'entrée : encadrement, deux vantaux en inox, bouton d'appel
  const inox=lam(0xbcc2c8), cadre=lam(0x7f868e), pierre=lam(0x9b968e);
  pave(cadre,10.45,11.75,0,2.22,z1-0.03,z1); pave(inox,10.55,11.09,0,2.12,z1-0.05,z1-0.03); pave(inox,11.11,11.65,0,2.12,z1-0.05,z1-0.03);
  pave(cadre,11.88,11.98,1.0,1.18,z1-0.04,z1);
  // volée d'escalier le long du mur ouest, du rez au palier de l'étage, et palier devant la petite fenêtre
  const n=16, haut=2.9/n, giron=(z1-0.4-(z0+1.35))/n;
  for(let i=0;i<n;i++) pave(pierre,x0,x0+1.2,0,(i+1)*haut,z1-0.4-(i+1)*giron,z1-0.4-i*giron);
  pave(pierre,x0,x1,2.76,2.9,z0,z0+1.35);
  pave(cadre,x0+1.2,x0+1.24,0.9,3.8,z0+1.35,z1-0.4).rotation.x=0;          // main courante (montant simple)
  return g;
}

export function creerCiel(){
  const g=new THREE.Group(); g.name='ciel'; g.visible=false;
  const dome=new THREE.Mesh(new THREE.SphereGeometry(R_CIEL,48,24),new THREE.MeshBasicMaterial({map:texCiel(),side:THREE.BackSide,depthWrite:false}));
  dome.position.set(C.x,-20,C.z); dome.renderOrder=-1;
  g.add(dome,...montagnes(),pelouse(),...arbres(),cageEscalier());
  g.traverse(o=>{ o.raycast=()=>{}; });                // le dehors ne gêne ni la sélection ni la marche
  app.scene.add(g); app.ciel=g;
  return g;
}
