// Maison3D Boutique : la photo du produit, renvoyée au site en data URL (avec le nom et les dimensions trouvés)
const {info}=$('Extraire').first().json, it=$input.first(), bin=it.binary&&it.binary.data;
if(!bin) return [{json:{reponse:{ok:false,erreur:'La photo du produit n’a pas pu être téléchargée',code:502,...info}}}];
const buf=await this.helpers.getBinaryDataBuffer(0,'data');
if(buf.length>8*1024*1024) return [{json:{reponse:{ok:false,erreur:'Photo du produit trop lourde',code:413,...info}}}];
// type lu dans les premiers octets (Pfister annonce du JPEG et envoie du WebP)
const sig=buf.slice(0,12).toString('latin1');
const type=sig.startsWith('RIFF')&&sig.slice(8,12)==='WEBP'?'image/webp':sig.startsWith('\x89PNG')?'image/png':sig.startsWith('\xff\xd8')?'image/jpeg':sig.startsWith('GIF8')?'image/gif':/ftypavi[fs]/.test(buf.slice(4,12).toString('latin1'))?'image/avif':/^image\//.test(bin.mimeType||'')?bin.mimeType:'image/jpeg';
return [{json:{reponse:{ok:true,...info,image:'data:'+type+';base64,'+buf.toString('base64')}}}];
