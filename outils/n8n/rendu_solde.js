// Maison3D Rendu : crédits kie.ai restants et modèles proposés (rendus et « Créer avec l'IA » : affichés avant de lancer)
const r=$input.first().json, b=r.body||{};
const ml={modeles:modelesPublics(),modelesCreer:modelesCreerPublics()};
return [{json:{reponse:b.code===200?{ok:true,solde:+b.data||0,...ml}:{ok:false,erreur:'kie.ai : '+(b.msg||r.statusCode||'?'),code:502,...ml}}}];
