// ---- SHA-256, HMAC, PBKDF2 en JavaScript pur (le module crypto n'est pas disponible dans le nœud Code de n8n) ----
const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const H0=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
const W=new Int32Array(64);
function bloc(h,o,m,d){ // h : état (Int32Array 8), m : octets, d : début du bloc de 64 octets
  for(let i=0;i<16;i++) W[i]=(m[d+4*i]<<24)|(m[d+4*i+1]<<16)|(m[d+4*i+2]<<8)|m[d+4*i+3];
  for(let i=16;i<64;i++){ const a=W[i-15], b=W[i-2];
    W[i]=(W[i-16]+(((a>>>7)|(a<<25))^((a>>>18)|(a<<14))^(a>>>3))+W[i-7]+(((b>>>17)|(b<<15))^((b>>>19)|(b<<13))^(b>>>10)))|0; }
  let A=h[0],B=h[1],C=h[2],D=h[3],E=h[4],F=h[5],G=h[6],H=h[7];
  for(let i=0;i<64;i++){
    const t1=(H+(((E>>>6)|(E<<26))^((E>>>11)|(E<<21))^((E>>>25)|(E<<7)))+((E&F)^(~E&G))+K[i]+W[i])|0;
    const t2=((((A>>>2)|(A<<30))^((A>>>13)|(A<<19))^((A>>>22)|(A<<10)))+((A&B)^(A&C)^(B&C)))|0;
    H=G; G=F; F=E; E=(D+t1)|0; D=C; C=B; B=A; A=(t1+t2)|0; }
  o[0]=(h[0]+A)|0; o[1]=(h[1]+B)|0; o[2]=(h[2]+C)|0; o[3]=(h[3]+D)|0; o[4]=(h[4]+E)|0; o[5]=(h[5]+F)|0; o[6]=(h[6]+G)|0; o[7]=(h[7]+H)|0;
}
const octets=e=>{ const o=new Uint8Array(32); for(let i=0;i<8;i++){ o[4*i]=e[i]>>>24; o[4*i+1]=(e[i]>>>16)&255; o[4*i+2]=(e[i]>>>8)&255; o[4*i+3]=e[i]&255; } return o; };
// condensé de m (Uint8Array), en partant de l'état h et de « deja » octets déjà traités
function finir(h,m,deja){
  const n=m.length, tot=n+deja, l=((n+9+63)>>6)<<6, p=new Uint8Array(l); p.set(m); p[n]=0x80;
  const bits=tot*8; p[l-4]=(bits>>>24)&255; p[l-3]=(bits>>>16)&255; p[l-2]=(bits>>>8)&255; p[l-1]=bits&255; p[l-5]=Math.floor(bits/4294967296)&255;
  const e=Int32Array.from(h); for(let d=0;d<l;d+=64) bloc(e,e,p,d); return e;
}
const sha256=m=>octets(finir(Int32Array.from(H0),m,0));
// HMAC : états intérieur et extérieur précalculés (PBKDF2 en fait des milliers)
function prepa(cle){
  if(cle.length>64) cle=sha256(cle);
  const ip=new Uint8Array(64).fill(0x36), op=new Uint8Array(64).fill(0x5c);
  for(let i=0;i<cle.length;i++){ ip[i]^=cle[i]; op[i]^=cle[i]; }
  const hi=Int32Array.from(H0), ho=Int32Array.from(H0); bloc(hi,hi,ip,0); bloc(ho,ho,op,0); return {hi,ho};
}
const hmacP=(p,m)=>octets(finir(p.ho,octets(finir(p.hi,m,64)),64));
const hmac=(cle,m)=>hmacP(prepa(cle),m);
function pbkdf2(mdp,sel,tours){
  const p=prepa(mdp), s=new Uint8Array(sel.length+4); s.set(sel); s[sel.length+3]=1;
  let u=hmacP(p,s); const t=u.slice();
  for(let i=1;i<tours;i++){ u=hmacP(p,u); for(let j=0;j<32;j++) t[j]^=u[j]; }
  return t;
}
const utf8=s=>new Uint8Array(Buffer.from(String(s),'utf8'));
const hex=b=>Buffer.from(b).toString('hex');
const egal=(a,b)=>{ if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length) return false; let d=0; for(let i=0;i<a.length;i++) d|=a.charCodeAt(i)^b.charCodeAt(i); return d===0; };
