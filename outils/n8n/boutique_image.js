// Maison3D Boutique : la photo du produit, renvoyée au site en data URL (avec le nom et les dimensions trouvés)
const {info}=$('Extraire').first().json, it=$input.first(), bin=it.binary&&it.binary.data;
if(!bin) return [{json:{reponse:{ok:false,erreur:'La photo du produit n’a pas pu être téléchargée',code:502,...info}}}];
const buf=await this.helpers.getBinaryDataBuffer(0,'data');
if(buf.length>8*1024*1024) return [{json:{reponse:{ok:false,erreur:'Photo du produit trop lourde',code:413,...info}}}];
const type=/^image\//.test(bin.mimeType||'')?bin.mimeType:'image/jpeg';
return [{json:{reponse:{ok:true,...info,image:'data:'+type+';base64,'+buf.toString('base64')}}}];
