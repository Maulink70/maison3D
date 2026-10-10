// Étape 1 : lire la demande du site, vérifier le jeton, préparer les lectures Airtable
const it=$input.first().json; let corps=it.body;
if(typeof corps==='string'){ try{ corps=JSON.parse(corps); }catch(e){ corps=null; } }
const ctx={action:corps&&corps.action, corps:corps||{}, moi:null, reponse:null};
const sortie=reqs=>reqs.length?reqs.map(req=>({json:{ctx,req}})):[{json:{ctx,req:null}}];
const refus=(erreur,code)=>{ ctx.reponse={ok:false,erreur,code:code||400}; return sortie([]); };
if(!corps||typeof corps!=='object') return refus('Demande illisible');
ctx.moi=lireJeton(corps.jeton);
const PRIVE=['charger','etat','enregistrer','variante','vue','mesure','historique','motdepasse'];   // tout sauf la connexion : le site est fermé sans compte
if(PRIVE.includes(ctx.action)&&!ctx.moi) return refus('Connexion nécessaire',401);
const tri=(champ,sens)=>'sort%5B0%5D%5Bfield%5D='+enc(champ)+'&sort%5B0%5D%5Bdirection%5D='+(sens||'asc');
const parId=(t,id)=>({method:'GET',url:url(t,'?'+formule('{Id}='+texte(id))+'&maxRecords=10')});
switch(ctx.action){
  case 'connexion': {
    const id=String(corps.identifiant||'').trim().toLowerCase();
    if(!id||!corps.motDePasse||id.length>40) return refus('Nom ou mot de passe manquant');
    return sortie([{method:'GET',url:url('personnes','?'+formule('LOWER({Identifiant})='+texte(id))+'&maxRecords=1')}]);
  }
  case 'charger': {
    const r=[{method:'GET',url:url('variantes','?'+formule('NOT({Supprimée})')+'&'+tri('Ordre'))}];
    r.push({method:'GET',url:url('vues','?'+tri('Ordre'))}); r.push({method:'GET',url:url('mesures','?'+tri('Créée le'))});
    return sortie(r);
  }
  case 'etat':
    return sortie([{method:'GET',url:url('variantes','?'+formule('NOT({Supprimée})')+'&fields%5B%5D=Nom&fields%5B%5D=Version&fields%5B%5D='+enc('Modifiée par')+'&fields%5B%5D='+enc('Modifiée le')+'&fields%5B%5D=Ordre&'+tri('Ordre'))}]);
  case 'enregistrer':
    if(!estId(corps.variante)) return refus('Variante inconnue');
    return sortie([{method:'GET',url:url('variantes','/'+corps.variante)}]);
  case 'variante':
    if(!['creer','renommer','supprimer','ordre'].includes(corps.op)) return refus('Opération inconnue');
    return sortie([]);
  case 'vue':
    if(corps.op==='enregistrer') return sortie([]);
    if(corps.op==='supprimer') return sortie([parId('vues',corps.id)]);
    return refus('Opération inconnue');
  case 'mesure':
    if(corps.op==='ajouter') return sortie([]);
    if(corps.op==='supprimer') return sortie([parId('mesures',corps.id)]);
    if(corps.op==='toutEffacer') return sortie([{method:'GET',url:url('mesures','?fields%5B%5D=Id&maxRecords=100')}]);
    return refus('Opération inconnue');
  case 'historique':
    if(!estId(corps.variante)) return refus('Variante inconnue');
    return sortie([{method:'GET',url:url('historique','?'+formule('{Variante id}='+texte(corps.variante))+'&'+tri('Quand','desc')+'&maxRecords='+Math.min(100,Math.max(1,corps.n|0||50)))}]);
  case 'motdepasse':
    if(!corps.ancien||!corps.nouveau||String(corps.nouveau).length<6) return refus('Le nouveau mot de passe doit faire au moins 6 caractères');
    return sortie([{method:'GET',url:url('personnes','/'+ctx.moi.p)}]);
  default: return refus('Action inconnue');
}
