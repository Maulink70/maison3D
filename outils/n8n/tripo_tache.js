// Maison3D Tripo : la photo est chez Tripo (file_token) ; créer la tâche image-to-model (réglages fixes, ici et non dans
// la page) : modèle v3.1, textures PBR, 60 000 faces au plus, taille réelle estimée (en mètres), géométrie compressée
const r=$input.first().json, b=r.body||{}, tok=b.code===0&&b.data&&b.data.file_token;
if(!tok) return [{json:{reponse:erreurTripo(r,'envoi de la photo'),req:null}}];
return [{json:{req:{method:'POST',url:'https://openapi.tripo3d.ai/v3/generation/image-to-model',
  body:{input:tok,model:'v3.1-20260211',texture:true,pbr:true,face_limit:60000,auto_size:true,compress:'geometry'}}}}];
