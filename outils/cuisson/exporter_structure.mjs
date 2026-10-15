// Export de la structure de la maquette telle que le site la construit, pour la cuisson de la lumière (outils/cuisson/cuire.py).
// Ouvre le site en local dans Chromium sans écran (API simulée des tests), attend les meubles, puis écrit dans le dossier donné :
//   structure.bin   positions de tous les sommets (x, y, z en mètres, repère du site, axe Y vertical), Float32, maillage après maillage
//   maillages.json  {total, maillages: [{n: sommets, s: empreinte (js/cuisson.js), nom, mat}]} dans l'ordre de maillagesCuits()
// Usage : SITE=http://localhost:8000/ MOCK=<chemin de mock_api.mjs> PLAYWRIGHT=<dossier node_modules/playwright> node exporter_structure.mjs <dossier de sortie>
import fs from 'node:fs'; import path from 'node:path'; import {createRequire} from 'node:module'; import {pathToFileURL} from 'node:url';
const SORTIE=process.argv[2]||'.', SITE=process.env.SITE||'http://localhost:8000/';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT||'playwright');
const mock=process.env.MOCK?await import(pathToFileURL(process.env.MOCK).href):null;
const srv=mock?mock.serveur():null;
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:'block'});
await ctx.addInitScript(()=>{ window.__images=k=>new Promise(r=>{ let n=0; const f=()=>{ if(++n>=k) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); });
if(mock) await mock.brancher(ctx,srv,'Mauro');
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto(SITE,{timeout:180000}); await p.waitForFunction(()=>window.maison3d?.mobilierPret,null,{timeout:300000});
await p.evaluate(()=>window.__images(2));
const r=await p.evaluate(async()=>{
  const C=await import('/js/cuisson.js'); const liste=C.preparerCuisson();
  let total=0; for(const e of liste) total+=e.n;
  const out=new Float32Array(total*3), fiche=[]; let k=0;
  for(const {o,geo,n,s} of liste){ o.updateMatrixWorld(true); const e=o.matrixWorld.elements, q=geo.attributes.position;
    for(let i=0;i<n;i++){ const x=q.getX(i), y=q.getY(i), z=q.getZ(i);
      out[k++]=e[0]*x+e[4]*y+e[8]*z+e[12]; out[k++]=e[1]*x+e[5]*y+e[9]*z+e[13]; out[k++]=e[2]*x+e[6]*y+e[10]*z+e[14]; }
    fiche.push({n,s,nom:o.name||o.parent?.name||'',mat:o.material.name||''}); }
  const b=new Uint8Array(out.buffer); let str=''; for(let i=0;i<b.length;i+=8192) str+=String.fromCharCode.apply(null,b.subarray(i,i+8192));
  return {fiche,b64:btoa(str),total};
});
fs.mkdirSync(SORTIE,{recursive:true});
fs.writeFileSync(path.join(SORTIE,'structure.bin'),Buffer.from(r.b64,'base64'));
fs.writeFileSync(path.join(SORTIE,'maillages.json'),JSON.stringify({date:new Date().toISOString(),site:SITE,total:r.total,maillages:r.fiche}));
console.log(`${r.fiche.length} maillages, ${r.total} sommets (${r.total/3} triangles) → ${SORTIE}`);
if(errs.length) console.log('Erreurs de page :',errs.slice(0,3).join(' | '));
await browser.close(); srv?.close?.();
