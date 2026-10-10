// Maison3D Boutique (étape 5, livraison 3) : lire la page d'un produit d'une boutique en ligne (lien collé ou partagé
// depuis l'appli de la boutique) : photo principale, nom et, si la page les donne, dimensions. La page ne peut pas lire
// une autre boutique elle-même (sécurité des navigateurs) : n8n le fait. Jeton de connexion exigé ; 200 lectures par jour.
const it=$input.first().json; let c=it.body;
if(typeof c==='string'){ try{ c=JSON.parse(c); }catch(e){ c=null; } }
const refus=(erreur,code)=>[{json:{reponse:{ok:false,erreur,code:code||400},req:null}}];
if(!c||typeof c!=='object') return refus('Demande illisible');
const moi=lireJeton(c.jeton); if(!moi) return refus('Connexion nécessaire',401);
if(c.action!=='lire') return refus('Action inconnue');
// (le nœud Code de n8n n'a pas URL : adresse lue à la main)
const href=String(c.url||'').trim().replace(/\s/g,''), m=href.match(/^(https?):\/\/([^\/?#:@]+)(?::\d+)?([\/?#].*)?$/i);
if(!m||href.length>2000) return refus('Lien illisible');
const hote=m[2].toLowerCase();
if(/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.)/.test(hote)||!hote.includes('.')||/^\d+\.\d+\.\d+\.\d+$/.test(hote)) return refus('Lien refusé');
const s=$getWorkflowStaticData('global'), jour=new Date().toISOString().slice(0,10);
if(s.jour!==jour){ s.jour=jour; s.n=0; }
if((s.n||0)>=200) return refus('Limite de 200 lectures par jour atteinte : réessayez demain.',429);
s.n=(s.n||0)+1;
return [{json:{url:href,debug:c.debug==='tous'?'tous':!!c.debug,req:{url:href}}}];
