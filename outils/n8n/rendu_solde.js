// Maison3D Rendu : crédits kie.ai restants et modèles proposés (affichés dans la confirmation avant un rendu)
const r=$input.first().json, b=r.body||{};
return [{json:{reponse:b.code===200?{ok:true,solde:+b.data||0,modeles:modelesPublics()}:{ok:false,erreur:'kie.ai : '+(b.msg||r.statusCode||'?'),code:502,modeles:modelesPublics()}}}];
