// Maison3D Fichiers : adresse (temporaire) du morceau p du fichier, pièces jointes rangées par numéro (nom.partN)
const {p}=$('Vérifier').first().json, r=$input.first().json;
const att=((r.body&&r.body.fields&&r.body.fields['Fichier'])||[]).slice();
const num=a=>+((/\.part(\d+)$/.exec(a.filename||'')||[])[1]||0);
att.sort((a,b)=>num(a)-num(b));
const f=att.find(a=>num(a)===p)||null;
if(!f) return [{json:{reponse:{ok:false,erreur:'Fichier introuvable',code:404},url:null}}];
return [{json:{url:f.url,type:f.type||'application/octet-stream'}}];
