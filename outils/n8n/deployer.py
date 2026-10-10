# Assemble et publie le workflow n8n « Maison3D API » (étape 3).
# Usage : N8N_BASE_URL=… N8N_API_KEY=… python3 deployer.py [<id credential Airtable> <nom>]
# Par défaut : la clé « Airtable Maison3D » (créée par Mauro dans n8n, id YLhykJLQo38AL1L5).
# Le secret qui signe les jetons de connexion n'est jamais dans le dépôt : il est lu dans le workflow déjà publié
# (nœud « Analyser ») ; s'il n'existe pas encore, un nouveau est tiré au hasard (tous les appareils devront se reconnecter).
import json, os, sys, urllib.request, uuid
D=os.path.dirname(os.path.abspath(__file__)); C=D
lire=lambda n: open(os.path.join(C,n),encoding='utf8').read()
lib=lire('chiffre.js')+'\n'+lire('commun.js')+'\n'
cred={'airtableTokenApi':{'id':sys.argv[1] if len(sys.argv)>2 else 'YLhykJLQo38AL1L5','name':sys.argv[2] if len(sys.argv)>2 else 'Airtable Maison3D'}}
ORIGINES='https://maison3d.vercel.app,http://localhost:8000'
def code(nom,js,x): return {'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3d-'+nom)),'name':nom,'type':'n8n-nodes-base.code','typeVersion':2,'position':[x,0],'parameters':{'jsCode':js}}
def si(nom,x): return {'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3d-'+nom)),'name':nom,'type':'n8n-nodes-base.if','typeVersion':2.2,'position':[x,0],'parameters':{
  'conditions':{'options':{'caseSensitive':True,'leftValue':'','typeValidation':'loose','version':2},
    'conditions':[{'id':'c1','leftValue':'={{ $json.req != null }}','rightValue':'','operator':{'type':'boolean','operation':'true','singleValue':True}}],'combinator':'and'},
  'looseTypeValidation':True,'options':{}}}
def http(nom,x,corps):
  p={'method':'={{ $json.req.method }}','url':'={{ $json.req.url }}','authentication':'predefinedCredentialType','nodeCredentialType':'airtableTokenApi',
     'options':{'response':{'response':{'fullResponse':True,'neverError':True}},'batching':{'batch':{'batchSize':4,'batchInterval':1000}}}}
  if corps: p.update({'sendBody':True,'contentType':'json','specifyBody':'json','jsonBody':'={{ JSON.stringify($json.req.body) }}'})
  return {'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3d-'+nom)),'name':nom,'type':'n8n-nodes-base.httpRequest','typeVersion':4.2,'position':[x,0],'parameters':p,'credentials':cred}
nodes=[
 {'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3d-webhook')),'name':'Site Maison3D','type':'n8n-nodes-base.webhook','typeVersion':2,'position':[0,0],'webhookId':'4a2f5d0e-6c1b-4c8e-9f3a-maison3d0001',
  'parameters':{'httpMethod':'POST','path':'maison3d','responseMode':'responseNode','options':{'allowedOrigins':ORIGINES}}},
 code('Analyser',lib+lire('analyser.js'),220), si('Lecture ?',440), http('Lire Airtable',660,False),
 code('Décider',lib+lire('decider.js'),880), si('Écriture ?',1100), http('Écrire Airtable',1320,True),
 code('Répondre',lire('repondre.js'),1540),
 {'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3d-reponse')),'name':'Réponse','type':'n8n-nodes-base.respondToWebhook','typeVersion':1.1,'position':[1760,0],
  'parameters':{'respondWith':'json','responseBody':'={{ JSON.stringify($json.reponse) }}','options':{}}}]
m=lambda n,i=0:{'node':n,'type':'main','index':i}
conn={'Site Maison3D':{'main':[[m('Analyser')]]},'Analyser':{'main':[[m('Lecture ?')]]},'Lecture ?':{'main':[[m('Lire Airtable')],[m('Décider')]]},
 'Lire Airtable':{'main':[[m('Décider')]]},'Décider':{'main':[[m('Écriture ?')]]},'Écriture ?':{'main':[[m('Écrire Airtable')],[m('Répondre')]]},
 'Écrire Airtable':{'main':[[m('Répondre')]]},'Répondre':{'main':[[m('Réponse')]]}}
wf={'name':'Maison3D API','nodes':nodes,'connections':conn,'settings':{'executionOrder':'v1','saveDataSuccessExecution':'none','saveDataErrorExecution':'all'}}
B=os.environ['N8N_BASE_URL']+'/api/v1/workflows'; H={'X-N8N-API-KEY':os.environ['N8N_API_KEY'],'Content-Type':'application/json'}
def req(meth,u,data=None):
  r=urllib.request.Request(u,data=json.dumps(data).encode() if data is not None else None,headers=H,method=meth)
  try: return json.load(urllib.request.urlopen(r))
  except urllib.error.HTTPError as e: print('ERREUR',e.code,e.read().decode()[:500]); sys.exit(1)
# workflow existant (par son nom) et secret des jetons
import re, secrets
existant=[w for w in req('GET',B+'?limit=200')['data'] if w['name']=='Maison3D API']
sec=None
if existant:
  w0=req('GET',B+'/'+existant[0]['id'])
  for n in w0['nodes']:
    m=re.search(r"SECRET=utf8\('([0-9a-f]{64})'\)",n.get('parameters',{}).get('jsCode','') or '')
    if m: sec=m.group(1)
sec=sec or secrets.token_hex(32)
for n in wf['nodes']:
  if n['type']=='n8n-nodes-base.code': n['parameters']['jsCode']=n['parameters']['jsCode'].replace('__SECRET__',sec)
if existant:
  i=existant[0]['id']; req('POST',B+'/'+i+'/deactivate'); req('PUT',B+'/'+i,wf)
else:
  i=req('POST',B,wf)['id']
r=req('POST',B+'/'+i+'/activate'); print('workflow',i,'actif',r.get('active'))
