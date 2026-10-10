// Maison3D Boutique : dans la page du produit, la photo principale (og:image, JSON-LD Product, twitter:image), le nom et
// les dimensions (JSON-LD, ou texte « Largeur : 200 cm », « L 200 x P 90 x H 75 cm », « 200 x 90 x 75 cm », allemand compris)
const {url,debug}=$('Analyser').first().json, r=$input.first().json;
const html=typeof r.body==='string'?r.body:(r.data||'');
const code=r.statusCode||0;
if(!html||code>=400) return [{json:{reponse:{ok:false,erreur:code===403||code===429?'La boutique refuse la lecture de ses pages par un serveur ('+code+') : copiez plutôt l’image du produit.':'Page illisible ('+(code||'vide')+')',code:502},image:null}}];
const dec=t=>String(t||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(m,n)=>String.fromCharCode(+n)).trim();
const meta=n=>{ const m=html.match(new RegExp('<meta[^>]+(?:property|name)=["\']'+n+'["\'][^>]*>','i')); if(!m) return ''; const v=m[0].match(/content=["']([^"']*)["']/i); return v?dec(v[1]):''; };
// adresses relatives rendues absolues (pas de URL dans le nœud Code de n8n)
const origine=(url.match(/^https?:\/\/[^\/?#]+/i)||[''])[0], dossier=url.replace(/[?#].*$/,'').replace(/[^\/]*$/,'');
const abs=v=>{ v=String(v||'').trim(); if(!v||/^data:/i.test(v)) return ''; if(/^https?:\/\//i.test(v)) return v; if(v.startsWith('//')) return 'https:'+v; if(v.startsWith('/')) return origine+v; return dossier+v; };
// JSON-LD : le premier objet de type Product
let prod=null;
for(const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)){
  let j; try{ j=JSON.parse(m[1].trim()); }catch(e){ continue; }
  const pile=[j]; while(pile.length&&!prod){ const o=pile.pop(); if(!o||typeof o!=='object') continue; if(Array.isArray(o)){ pile.push(...o); continue; }
    const t=[].concat(o['@type']||[]); if(t.some(x=>/product/i.test(x))) prod=o; else { if(o['@graph']) pile.push(o['@graph']); if(o.mainEntity) pile.push(o.mainEntity); } }
  if(prod) break;
}
const img0=x=>Array.isArray(x)?img0(x[0]):x&&typeof x==='object'?(x.url||x.contentUrl||''):x||'';
let image=abs(meta('og:image')||meta('og:image:secure_url')||img0(prod&&prod.image)||meta('twitter:image')||'');
const nom=dec((prod&&prod.name)||meta('og:title')||(html.match(/<title[^>]*>([^<]*)/i)||[])[1]||'').replace(/\s*[|–-]\s*[^|–-]{2,40}$/,'').slice(0,80);
// dimensions en cm
const enCm=(v,u)=>{ v=parseFloat(String(v).replace(',','.')); if(!isFinite(v)) return null; u=(u||'cm').toLowerCase(); return Math.round(u==='mm'?v/10:u==='m'?v*100:v); };
const d={};
const q=x=>x&&typeof x==='object'?enCm(x.value,x.unitText||x.unitCode==='MMT'&&'mm'||x.unitCode==='MTR'&&'m'||'cm'):x!=null?enCm(x,'cm'):null;
if(prod){ if(prod.width) d.L=q(prod.width); if(prod.depth) d.P=q(prod.depth); if(prod.height) d.H=q(prod.height);
  for(const a of [].concat(prod.additionalProperty||[])){ const n=String(a&&a.name||'').toLowerCase(), v=enCm(a&&a.value,a&&a.unitText);
    if(v==null) continue; if(/larg|breit|width/.test(n)) d.L=d.L||v; else if(/prof|tief|depth/.test(n)) d.P=d.P||v; else if(/haut|höh|hoh|height/.test(n)) d.H=d.H||v; } }
const texte=dec(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ');
const cherche=(re)=>{ const m=texte.match(re); return m?enCm(m[1],m[2]):null; };
const U='(cm|mm|m)\\b';
d.L=d.L||cherche(new RegExp('(?:largeur|breite|width)\\s*(?:totale|gesamt)?\\s*[:：]?\\s*(\\d+(?:[.,]\\d+)?)\\s*'+U,'i'));
d.P=d.P||cherche(new RegExp('(?:profondeur|tiefe|depth)\\s*(?:totale|gesamt)?\\s*[:：]?\\s*(\\d+(?:[.,]\\d+)?)\\s*'+U,'i'));
d.H=d.H||cherche(new RegExp('(?:hauteur|höhe|hohe|height)\\s*(?:totale|gesamt)?\\s*[:：]?\\s*(\\d+(?:[.,]\\d+)?)\\s*'+U,'i'));
if(!(d.L&&d.P&&d.H)){ const m=texte.match(/(\d{2,3}(?:[.,]\d)?)\s*[x×]\s*(\d{2,3}(?:[.,]\d)?)\s*[x×]\s*(\d{2,3}(?:[.,]\d)?)\s*(cm|mm)\b/i);
  if(m){ d.L=d.L||enCm(m[1],m[4]); d.P=d.P||enCm(m[2],m[4]); d.H=d.H||enCm(m[3],m[4]); } }
for(const k of ['L','P','H']) if(!(d[k]>0&&d[k]<2000)) delete d[k];
const site=origine.replace(/^https?:\/\//i,'').replace(/^www\./,'');
const liens=debug?[...new Set([...html.matchAll(/href=["']([^"'#]+)["']/gi)].map(m=>abs(dec(m[1]))).concat(debug==='tous'?[...html.matchAll(/https?:(?:\\?\/){2}[^"'\s<>\\]+/g)].map(m=>m[0].replace(/\\\//g,'/')):[]).filter(h=>h.startsWith('http')&&h.includes(site)))].slice(0,300):undefined;
if(!image) return [{json:{reponse:{ok:false,erreur:'Pas de photo trouvée sur cette page : copiez plutôt l’image du produit.',code:404,nom,dims:d,site,liens},image:null}}];
return [{json:{image,info:{nom,dims:d,site,url,liens}}}];
