// Maison3D IA : état de la tâche ; prête : adresse de l'image à télécharger
const r=$input.first().json, b=r.body||{}, d=b.data||{};
if(b.code!==200) return [{json:{reponse:{ok:false,erreur:'kie.ai : '+(b.msg||r.statusCode||'?'),code:502},url:null}}];
if(d.state==='success'){ let u=null; try{ u=(JSON.parse(d.resultJson||'{}').resultUrls||[])[0]; }catch(e){}
  return u?[{json:{url:u}}]:[{json:{reponse:{ok:true,etat:'echec',raison:'pas d’image dans le résultat'},url:null}}]; }
if(['fail','failed','error'].includes(d.state)) return [{json:{reponse:{ok:true,etat:'echec',raison:String(d.failMsg||'').slice(0,200)},url:null}}];
return [{json:{reponse:{ok:true,etat:'attente'},url:null}}];
