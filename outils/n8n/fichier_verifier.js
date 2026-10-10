// Maison3D Fichiers (étape 4) : vérifier le jeton (paramètre j) et préparer la lecture de la ligne de la table Fichiers
const q=$input.first().json.query||{};
if(!lireJeton(q.j)) return [{json:{reponse:{ok:false,erreur:'Connexion nécessaire',code:401},req:null}}];
if(!estId(q.id)) return [{json:{reponse:{ok:false,erreur:'Fichier inconnu',code:400},req:null}}];
return [{json:{req:{method:'GET',url:url('fichiers','/'+q.id)},p:Math.max(0,Math.min(20,(+q.p)|0))}}];
