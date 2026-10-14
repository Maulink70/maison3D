// Maison3D Blender (14 octobre 2026, demande de Mauro : « créer un objet via Blender depuis l'application ») : file
// d'attente entre le site et le programme « pont Blender » du PC de Mauro (Claude Code + Blender MCP). Rien dans Airtable :
// les demandes sont gardées dans les données statiques du workflow (comme les compteurs de Tripo) ; le modèle fini est
// envoyé par le PC dans la table Fichiers (action fichier de « Maison3D API »), le site le lit comme les autres.
// Site : etat (PC et demandes), creer, annuler, relancer, supprimer. PC : prendre (battement + demande suivante),
// avancer, finir, echouer. Jeton de connexion exigé partout (le PC se connecte avec le compte de Mauro).
// Deux exécutions simultanées peuvent s'écraser (données statiques écrites en entier à la fin) : creer est idempotent
// (le site renvoie sa demande s'il ne la voit pas dans etat), le PC vérifie que finir / echouer ont été pris.
const it=$input.first().json; let c=it.body;
if(typeof c==='string'){ try{ c=JSON.parse(c); }catch(e){ c=null; } }
const rep=reponse=>[{json:{reponse}}];
const refus=(erreur,code)=>rep({ok:false,erreur,code:code||400});
if(!c||typeof c!=='object') return refus('Demande illisible');
const moi=lireJeton(c.jeton); if(!moi) return refus('Connexion nécessaire',401);
const s=$getWorkflowStaticData('global'); s.d=s.d||{}; s.pcs=s.pcs||{};
const now=Date.now(), JOUR=24*3600*1000;
const txt=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const num=v=>{ const x=+v; return isFinite(x)&&x>0&&x<5000?Math.round(x*10)/10:null; };
const fic=v=>v&&typeof v==='object'&&estId(v.id)?{id:v.id,n:Math.max(1,Math.min(8,v.n|0||1)),type:txt(v.type,40)}:null;
const idOk=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{6,40}$/.test(v);
// pièce où ranger le modèle dans le Drive (« Objets 3D/Rez/Salon »…, le PC fait la correspondance)
const PIECES=['salon','cuisine','entree','degagement','wc','chambre','sdb','portes_rez','mezzanine','dressing','chambre_etage','douche','portes_etage'];
// une demande telle que le site la voit (sans les champs internes)
const vue=d=>({id:d.id,qui:d.qui,cree:d.cree,maj:d.maj,etat:d.etat,type:d.type,nom:d.nom,description:d.description,L:d.L,P:d.P,H:d.H,detail:d.detail,textures:d.textures,
  images:d.images,lien:d.lien,site:d.site,source:d.source,piece:d.piece||'',p:d.p||0,texte:d.texte||'',pc:d.pc||'',pris:d.pris||null,resultat:d.resultat||null,erreur:d.erreur||'',essais:d.essais||0,place:d.place||null});
// ménage : 60 demandes au plus, plus de 30 jours effacées (sauf en attente ou en cours)
function menage(){
  const l=Object.values(s.d).sort((a,b)=>b.cree-a.cree);
  l.forEach((d,i)=>{ if((i>=60||now-d.cree>30*JOUR)&&!['attente','en_cours'].includes(d.etat)) delete s.d[d.id]; });
}
// une demande en cours dont le PC ne donne plus de nouvelles depuis 20 min : remise en attente (2 essais), sinon échec
function perdues(){
  for(const d of Object.values(s.d)) if(d.etat==='en_cours'&&now-(d.maj||0)>20*60000){
    if((d.essais||0)<2){ d.etat='attente'; d.texte='Le PC n’a plus donné de nouvelles : la demande est reprise.'; d.maj=now; }
    else { d.etat='echec'; d.erreur='Le PC a cessé de répondre pendant la création.'; d.maj=now; } }
}
const etatPC=()=>Object.entries(s.pcs).map(([nom,p])=>({nom,vu:p.t,ilya:Math.round((now-p.t)/1000),occupe:p.occupe||null,version:p.version||''}))
  .sort((a,b)=>b.vu-a.vu);
const position=d=>Object.values(s.d).filter(x=>x.etat==='attente'&&x.cree<d.cree).length;

switch(c.action){
  // ---------- site ----------
  case 'etat': {
    const l=Object.values(s.d).sort((a,b)=>b.cree-a.cree).slice(0,30).map(d=>({...vue(d),position:d.etat==='attente'?position(d):0}));
    return rep({ok:true,pcs:etatPC(),demandes:l,maintenant:now});
  }
  case 'creer': {
    if(!idOk(c.id)) return refus('Identifiant de demande invalide');
    if(s.d[c.id]) return rep({ok:true,demande:vue(s.d[c.id]),deja:true});   // renvoyée par le site : déjà là
    const type=c.type==='modifier'?'modifier':'creer', nom=txt(c.nom,60)||'Objet', description=txt(c.description,3000);
    const images=(Array.isArray(c.images)?c.images:[]).slice(0,6).map(fic).filter(Boolean);
    const source=c.source&&typeof c.source==='object'?{fic:fic(c.source.fic),nom:txt(c.source.nom,80),element:txt(c.source.element,60),
      dims:c.source.dims&&typeof c.source.dims==='object'?{L:num(c.source.dims.L),P:num(c.source.dims.P),H:num(c.source.dims.H)}:null,image:fic(c.source.image)}:null;
    if(type==='creer'&&description.length<3&&!images.length) return refus('Décrivez l’objet, ou joignez au moins une image.');
    if(type==='modifier'&&(!source||(!source.fic&&!source.image))) return refus('Objet à modifier inconnu.');
    if(type==='modifier'&&description.length<3) return refus('Dites ce qu’il faut changer.');
    const jour=new Date().toISOString().slice(0,10); if(s.jour!==jour){ s.jour=jour; s.n=0; }
    if((s.n||0)>=40) return refus('Limite de 40 demandes à Blender par jour atteinte : réessayez demain.',429);
    s.n=(s.n||0)+1;
    const d={id:c.id,qui:moi.n,cree:now,maj:now,etat:'attente',type,nom,description,L:num(c.L),P:num(c.P),H:num(c.H),
      detail:['simple','normal','detaille'].includes(c.detail)?c.detail:'normal',textures:c.textures!==false,images,lien:txt(c.lien,500),site:txt(c.site,80),source,piece:PIECES.includes(c.piece)?c.piece:'',
      place:c.place&&typeof c.place==='object'?{x:+c.place.x||0,z:+c.place.z||0,r:+c.place.r||0,niv:c.place.niv==='etage'?'etage':'rez'}:null,p:0,texte:'',essais:0};
    s.d[d.id]=d; menage();
    return rep({ok:true,demande:{...vue(d),position:position(d)},pcs:etatPC()});
  }
  case 'annuler': case 'relancer': case 'supprimer': {
    const d=idOk(c.id)&&s.d[c.id]; if(!d) return refus('Demande inconnue',404);
    if(c.action==='annuler'){ if(['attente','en_cours'].includes(d.etat)){ d.etat='annule'; d.maj=now; d.texte='Annulée par '+moi.n; } }
    else if(c.action==='relancer'){ if(['echec','annule'].includes(d.etat)){ d.etat='attente'; d.essais=0; d.erreur=''; d.p=0; d.texte=''; d.maj=now; d.cree=now; } }
    else { if(d.etat==='en_cours') return refus('Annulez-la d’abord : le PC y travaille.'); delete s.d[c.id]; return rep({ok:true,supprimee:true}); }
    return rep({ok:true,demande:vue(d)});
  }
  // ---------- PC (programme « pont Blender ») ----------
  case 'prendre': {
    const agent=txt(c.agent,40)||'PC', p=s.pcs[agent]||{};
    // programme relancé (PC redémarré pendant une création) : sa demande en cours est reprise depuis le début
    if(c.depart) for(const x of Object.values(s.d)) if(x.etat==='en_cours'&&x.pc===agent){
      if((x.essais||0)<2){ x.etat='attente'; x.texte='Le programme du PC a redémarré : la demande est reprise.'; } else { x.etat='echec'; x.erreur='Le programme du PC s’est arrêté pendant la création.'; } x.maj=now; }
    perdues();
    const occupe=Object.values(s.d).find(d=>d.etat==='en_cours'&&d.pc===agent);
    // battement : écrit au plus une fois par minute quand rien ne change (moins de risque d'écraser une demande qui arrive)
    const libre=!occupe&&c.libre!==false;
    let d=libre?Object.values(s.d).filter(x=>x.etat==='attente').sort((a,b)=>a.cree-b.cree)[0]:null;
    if(d){ d.etat='en_cours'; d.pc=agent; d.pris=now; d.maj=now; d.essais=(d.essais||0)+1; d.p=1; d.texte='Le PC a pris la demande.'; }
    if(d||now-(p.t||0)>55000||(p.occupe||null)!==(d?d.id:occupe?occupe.id:null)||p.version!==txt(c.version,20))
      s.pcs[agent]={t:now,occupe:d?d.id:occupe?occupe.id:null,version:txt(c.version,20)};
    for(const [n,q] of Object.entries(s.pcs)) if(now-q.t>14*JOUR) delete s.pcs[n];
    return rep({ok:true,demande:d?vue(d):null,annulees:Object.values(s.d).filter(x=>x.etat==='annule'&&x.pc===agent&&now-x.maj<3600000).map(x=>x.id)});
  }
  case 'avancer': case 'finir': case 'echouer': {
    const d=idOk(c.id)&&s.d[c.id]; if(!d) return refus('Demande inconnue',404);
    if(d.etat==='annule') return rep({ok:true,annule:true});
    if(d.etat!=='en_cours') return rep({ok:true,etat:d.etat});
    d.maj=now; const agent=txt(c.agent,40); if(agent&&s.pcs[agent]) s.pcs[agent].t=now;
    if(c.action==='avancer'){ d.p=Math.max(1,Math.min(99,c.p|0)); d.texte=txt(c.texte,300); return rep({ok:true}); }
    if(c.action==='echouer'){ d.etat='echec'; d.erreur=txt(c.erreur,600)||'Erreur inconnue'; d.texte=''; if(s.pcs[agent]) s.pcs[agent].occupe=null; return rep({ok:true,etat:d.etat}); }
    const f=fic(c.fichier); if(!f) return refus('Fichier du modèle manquant');
    d.etat='fini'; d.p=100; d.texte=txt(c.texte,300);
    d.resultat={fic:f,taille:Math.max(0,+c.taille||0),triangles:Math.max(0,c.triangles|0),dims:c.dims&&typeof c.dims==='object'?{L:num(c.dims.L),P:num(c.dims.P),H:num(c.dims.H)}:null,
      apercu:fic(c.apercu),duree:Math.max(0,c.duree|0),notes:txt(c.notes,1500),drive:txt(c.drive,300),driveErreur:txt(c.driveErreur,300),fin:now};
    if(s.pcs[agent]) s.pcs[agent].occupe=null;
    return rep({ok:true,etat:d.etat});
  }
  default: return refus('Action inconnue');
}
