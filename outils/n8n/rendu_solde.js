// Maison3D Rendu : crédits kie.ai restants (affichés dans la confirmation avant un rendu)
const r=$input.first().json, b=r.body||{};
return [{json:{reponse:b.code===200?{ok:true,solde:+b.data||0}:{ok:false,erreur:'kie.ai : '+(b.msg||r.statusCode||'?'),code:502}}}];
