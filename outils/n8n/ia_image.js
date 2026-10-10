// Maison3D IA : l'image nettoyée, renvoyée au site en data URL (le site ne peut pas la lire chez kie.ai)
const bin=$input.first().binary&&$input.first().binary.data;
if(!bin) return [{json:{reponse:{ok:true,etat:'echec',raison:'image illisible'}}}];
const buf=await this.helpers.getBinaryDataBuffer(0,'data');
return [{json:{reponse:{ok:true,etat:'fini',image:'data:'+(bin.mimeType||'image/png')+';base64,'+buf.toString('base64')}}}];
