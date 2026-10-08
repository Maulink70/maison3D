// Ciel et sol extérieur, visibles en 1re personne seulement : par les fenêtres et les portes ouvertes on voit
// dehors, et non le fond uni de la page (gris foncé en thème sombre)
import * as THREE from 'three';
import {app} from './app.js';

export function creerCiel(){
  const g=new THREE.Group(); g.name='ciel'; g.visible=false;
  const R=120, geo=new THREE.SphereGeometry(R,32,16), p=geo.attributes.position, col=[];
  const haut=new THREE.Color(0x6f9fd3), horizon=new THREE.Color(0xdde8f0), c=new THREE.Color();
  for(let i=0;i<p.count;i++){ const t=Math.max(0,p.getY(i)/R); c.copy(horizon).lerp(haut,Math.pow(t,0.5)); col.push(c.r,c.g,c.b); }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  const dome=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,depthWrite:false}));
  const sol=new THREE.Mesh(new THREE.CircleGeometry(R,48),new THREE.MeshLambertMaterial({color:0x8e9a7c}));
  sol.rotation.x=-Math.PI/2; sol.position.set(15.5,-0.03,-21); dome.position.set(15.5,0,-21); dome.renderOrder=-1;
  for(const o of [dome,sol]){ o.raycast=()=>{}; g.add(o); }
  app.scene.add(g); app.ciel=g;
  return g;
}
