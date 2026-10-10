// Maison3D Tripo : crédits restants (affichés dans la confirmation avant chaque modèle)
const r=$input.first().json, b=r.body||{};
if(b.code===0&&b.data) return [{json:{reponse:{ok:true,solde:+b.data.balance||0,gele:+b.data.frozen||0}}}];
return [{json:{reponse:erreurTripo(r,'solde')}}];
