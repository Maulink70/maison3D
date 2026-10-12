// Maison3D Assistant : la réponse du modèle (un objet JSON, parfois entouré de ```json) est lue, nettoyée et renvoyée au site
const r=$input.first().json, b=r.body||{};
const t=b.choices&&b.choices[0]&&b.choices[0].message&&b.choices[0].message.content;
if(!t) return [{json:{reponse:{ok:false,erreur:'kie.ai : '+(b.msg||(typeof b==='string'?b.slice(0,80):'')||r.statusCode||'pas de réponse'),code:502}}}];
let j=null; const m=String(t).match(/\{[\s\S]*\}/); try{ j=JSON.parse(m?m[0]:t); }catch(e){}
if(!j||typeof j!=='object') return [{json:{reponse:{ok:false,erreur:'Réponse du modèle illisible',code:502}}}];
const txt=(v,n)=>v==null?null:String(v).replace(/[\u0000-\u001f]/g,' ').slice(0,n||200);
const num=v=>Number.isFinite(+v)&&v!==null&&v!==''?+v:null;
const branche=/^[A-LX]$/.test(String(j.branche||''))?String(j.branche):'X';
const res={branche,objet:txt(j.objet,120),piece:txt(j.piece,40),source:txt(j.source,20),description:txt(j.description,300),
  couleur:/^#[0-9a-f]{6}$/i.test(String(j.couleur||''))?String(j.couleur).toLowerCase():null,matiere:txt(j.matiere,40),
  L:num(j.L),P:num(j.P),H:num(j.H),action:txt(j.action,20),angle:num(j.angle),dx:num(j.dx),dz:num(j.dz),mode:txt(j.mode,20),reponse:txt(j.reponse,300)};
return [{json:{reponse:{ok:true,...res,credits:b.credits_consumed||null}}}];
