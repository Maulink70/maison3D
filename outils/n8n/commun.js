// ---- Maison3D : constantes communes (base Airtable, tables, jeton) ----
const BASE='https://api.airtable.com/v0/app6QXMQrN6IwgbXq/';
const T={personnes:'tblP1uims1UXACAp4',variantes:'tblR2iq9raoIrVk7W',historique:'tbl8jnnrX1urdbarb',vues:'tblFUrGS3InCPIti0',mesures:'tbl20tv71DsYNuPk6'};
const SECRET=utf8('__SECRET__'), DUREE=365*24*3600*1000, TOURS=20000;
const url=(t,suite)=>BASE+T[t]+(suite||'');
const enc=encodeURIComponent;
const formule=f=>'filterByFormula='+enc(f);
const texte=s=>"'"+String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"'";
const estId=s=>typeof s==='string'&&/^rec[A-Za-z0-9]{14}$/.test(s);
const signer=o=>{ const p=Buffer.from(JSON.stringify(o)).toString('base64url'); return p+'.'+hex(hmac(SECRET,utf8(p))); };
function lireJeton(j){
  if(typeof j!=='string'||j.length>600) return null; const [p,s]=j.split('.'); if(!p||!s) return null;
  if(!egal(hex(hmac(SECRET,utf8(p))),s)) return null;
  let o; try{ o=JSON.parse(Buffer.from(p,'base64url').toString('utf8')); }catch(e){ return null; }
  return o&&estId(o.p)&&o.n&&o.e>Date.now()?o:null;
}
