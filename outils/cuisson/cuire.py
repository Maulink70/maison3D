#!/usr/bin/env python3
"""Cuisson de la lumière du ciel sur la structure de la maquette (lot « réalisme », phase 1, 15 octobre 2026).

Entrée : le dossier écrit par exporter_structure.mjs (structure.bin, maillages.json).
Sortie (dossier cuisson/ du site) : lumiere.webp (atlas, sRGB), lumiere_uv.bin (u, v de chaque sommet, Uint16, même
ordre que l'export), lumiere.json (fiche lue par js/cuisson.js : version, intensite, empreintes des maillages).

Blender (bpy) : un seul maillage (tous les triangles, Z vertical), sommets confondus soudés pour que les faces d'un même
plan forment des îlots d'un seul tenant, dépliage « Smart UV Project », matière grise mate, ciel blanc uniforme (strength 1),
Cycles sur le processeur, cuisson DIFFUSE directe + indirecte sans la couleur ; puis gain (le 99,5e centile → 1), gris
moyen hors des îlots (mipmaps), conversion sRGB, WebP. Chaque coin de triangle retrouve son uv par le polygone de même
centre et de même normale (les faces dégénérées, retirées par le soudage, restent à u = v = 0).

Usage : python3 cuire.py <dossier export> <dossier de sortie> [--taille 2048] [--echantillons 64] [--version AAAAMMJJ]
        [--intensite 1.0] [--marge 8] [--sans-soudage]
   ou : blender -b --python cuire.py -- <mêmes arguments>
"""
import sys, os, json, math, time, argparse
argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
ap=argparse.ArgumentParser(); ap.add_argument('export'); ap.add_argument('sortie')
ap.add_argument('--taille',type=int,default=2048); ap.add_argument('--echantillons',type=int,default=64)
ap.add_argument('--version',default=time.strftime('%Y%m%d%H%M')); ap.add_argument('--intensite',type=float,default=2.4)
ap.add_argument('--marge',type=int,default=8); ap.add_argument('--sans-soudage',action='store_true'); ap.add_argument('--angle',type=float,default=66.0); ap.add_argument('--flou',type=int,default=1)
a=ap.parse_args(argv)
import bpy, bmesh, numpy as np
t0=time.time(); log=lambda *m: print('[cuire %5.0f s]'%(time.time()-t0),*m,flush=True)

# ---------- 1. lecture de l'export ----------
fiche=json.load(open(os.path.join(a.export,'maillages.json'),encoding='utf-8'))
pos=np.fromfile(os.path.join(a.export,'structure.bin'),dtype=np.float32).reshape(-1,3)
total=sum(m['n'] for m in fiche['maillages']); assert pos.shape[0]==total, (pos.shape, total)
assert total%3==0
nT=total//3
verts=np.stack([pos[:,0],-pos[:,2],pos[:,1]],axis=1).astype(np.float64)   # site : Y vertical → Blender : Z vertical (x, -z, y)
log(f"{len(fiche['maillages'])} maillages, {nT} triangles")

# ---------- 2. scène Blender : un seul maillage ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
me=bpy.data.meshes.new('Structure')
me.vertices.add(total); me.vertices.foreach_set('co',verts.ravel())
me.loops.add(total); me.loops.foreach_set('vertex_index',np.arange(total,dtype=np.int32))
me.polygons.add(nT); me.polygons.foreach_set('loop_start',np.arange(0,total,3,dtype=np.int32)); me.polygons.foreach_set('loop_total',np.full(nT,3,dtype=np.int32))
me.update(calc_edges=True); me.validate(verbose=False)
obj=bpy.data.objects.new('Structure',me); scene.collection.objects.link(obj)
bpy.context.view_layer.objects.active=obj; obj.select_set(True)

# centres et normales des triangles d'origine (pour retrouver chaque face après le soudage)
A,B,C=verts[0::3],verts[1::3],verts[2::3]
centre0=(A+B+C)/3; nrm0=np.cross(B-A,C-A); L=np.linalg.norm(nrm0,axis=1); degen=L<1e-12
nrm0=np.where(degen[:,None],0,nrm0/np.maximum(L,1e-12)[:,None])
log(f"triangles dégénérés : {int(degen.sum())}")

if not a.sans_soudage:
    bm=bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-5)
    bm.to_mesh(me); bm.free(); me.update()
    log(f"soudage : {len(me.vertices)} sommets, {len(me.polygons)} faces (sur {total} coins, {nT} triangles)")

# ---------- 3. dépliage ----------
me.uv_layers.new(name='Cuisson')
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(a.angle),island_margin=0.003,area_weight=0.0,correct_aspect=True,scale_to_bounds=False)
try: bpy.ops.uv.pack_islands(rotate=True,margin=0.003)
except Exception as e: log('pack_islands :',e)
bpy.ops.object.mode_set(mode='OBJECT')
log('dépliage fait')

# ---------- 4. correspondance coin d'origine → uv ----------
nP=len(me.polygons)
pc=np.zeros(nP*3); me.polygons.foreach_get('center',pc); pc=pc.reshape(-1,3)
pn=np.zeros(nP*3); me.polygons.foreach_get('normal',pn); pn=pn.reshape(-1,3)
ls=np.zeros(nP,dtype=np.int32); me.polygons.foreach_get('loop_start',ls)
lt=np.zeros(nP,dtype=np.int32); me.polygons.foreach_get('loop_total',lt)
nL=len(me.loops); lv=np.zeros(nL,dtype=np.int32); me.loops.foreach_get('vertex_index',lv)
uvl=np.zeros(nL*2); me.uv_layers['Cuisson'].data.foreach_get('uv',uvl); uvl=uvl.reshape(-1,2)
nV=len(me.vertices); vco=np.zeros(nV*3); me.vertices.foreach_get('co',vco); vco=vco.reshape(-1,3)
# chaque triangle d'origine retrouve sa face par son centre (au mm près : Blender calcule en float32) et sa normale
uv=np.zeros((total,2),dtype=np.float64); perdus=0
ordre=np.argsort(pc[:,0]); pcx=pc[ordre,0]
for t in range(nT):
    c0=centre0[t]
    i0=np.searchsorted(pcx,c0[0]-2e-3); i1=np.searchsorted(pcx,c0[0]+2e-3)
    cand=ordre[i0:i1]
    if len(cand)==0: perdus+=1; continue
    d=np.sum((pc[cand]-c0)**2,axis=1); proches=cand[d<4e-6]
    if len(proches)==0: perdus+=1; continue
    dots=pn[proches]@nrm0[t]; k=int(proches[np.argmax(dots)])
    if dots.max()<0.5 and not degen[t]: perdus+=1; continue
    loops=range(ls[k],ls[k]+lt[k])
    for j in range(3):
        c=verts[3*t+j]; best=None; bd=1e9
        for l in loops:
            dd=np.sum((vco[lv[l]]-c)**2)
            if dd<bd: bd=dd; best=l
        uv[3*t+j]=uvl[best]
log(f"correspondance : {nT-perdus} triangles sur {nT} ({perdus} perdus : dégénérés ou confondus)")

# ---------- 5. matière, image, ciel, cuisson ----------
mat=bpy.data.materials.new('Cuisson'); mat.use_nodes=True; nt=mat.node_tree
bsdf=nt.nodes.get('Principled BSDF')
if bsdf:
    bsdf.inputs['Base Color'].default_value=(0.75,0.75,0.75,1); bsdf.inputs['Roughness'].default_value=1.0
    for nom in ('Specular IOR Level','Specular'):
        if nom in bsdf.inputs: bsdf.inputs[nom].default_value=0.0
img=bpy.data.images.new('Cuisson',a.taille,a.taille,alpha=True,float_buffer=True)
for cs in ('Linear Rec.709','Linear','Non-Color'):
    try: img.colorspace_settings.name=cs; break
    except Exception: pass
img.generated_color=(0,0,0,0)
tex=nt.nodes.new('ShaderNodeTexImage'); tex.image=img; nt.nodes.active=tex
me.materials.append(mat)
world=bpy.data.worlds.new('Ciel'); world.use_nodes=True
bg=world.node_tree.nodes.get('Background'); bg.inputs[0].default_value=(1,1,1,1); bg.inputs[1].default_value=1.0
scene.world=world
scene.render.engine='CYCLES'; cy=scene.cycles
try: cy.device='CPU'
except Exception: pass
cy.samples=a.echantillons; cy.use_denoising=False
try: cy.use_adaptive_sampling=True; cy.adaptive_threshold=0.02
except Exception: pass
cy.max_bounces=8; cy.diffuse_bounces=6; cy.glossy_bounces=0; cy.transmission_bounces=0; cy.transparent_max_bounces=0
try: cy.bake_type='DIFFUSE'
except Exception: pass
bk=scene.render.bake; bk.use_pass_direct=True; bk.use_pass_indirect=True; bk.use_pass_color=False
bk.margin=a.marge
try: bk.margin_type='EXTEND'
except Exception: pass
bk.use_clear=False; bk.target='IMAGE_TEXTURES'; bk.use_selected_to_active=False
log(f"cuisson Cycles : {a.taille} px, {a.echantillons} échantillons…")
bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT','INDIRECT'},margin=a.marge,use_clear=False)
log('cuisson faite')

# ---------- 6. post-traitement et écriture ----------
px=np.array(img.pixels[:],dtype=np.float32).reshape(a.taille,a.taille,4)   # lignes de bas en haut
R=px[...,:3]
# masque des îlots (l'alpha de Blender n'est pas fiable) : triangles tracés dans l'atlas d'après leurs uv, puis élargis de la marge
T=a.taille; masque=np.zeros((T,T),dtype=bool)
for k in range(nP):
    q=uvl[ls[k]:ls[k]+lt[k]]*T
    x0,y0=np.floor(q.min(axis=0)).astype(int)-1; x1,y1=np.ceil(q.max(axis=0)).astype(int)+1
    x0=max(x0,0); y0=max(y0,0); x1=min(x1,T-1); y1=min(y1,T-1)
    if x1<x0 or y1<y0 or len(q)<3: continue
    xs,ys=np.meshgrid(np.arange(x0,x1+1)+0.5,np.arange(y0,y1+1)+0.5)
    (ax,ay),(bx,by),(cx,cy)=q[0],q[1],q[2]
    d=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax)
    if abs(d)<1e-9: continue
    w0=((bx-xs)*(cy-ys)-(by-ys)*(cx-xs))/d; w1=((cx-xs)*(ay-ys)-(cy-ys)*(ax-xs))/d; w2=1-w0-w1
    masque[y0:y1+1,x0:x1+1]|=(w0>=-0.02)&(w1>=-0.02)&(w2>=-0.02)
for _ in range(a.marge):
    P=np.pad(masque,1,mode='constant'); masque=np.zeros_like(masque)
    for i in range(3):
        for j in range(3): masque|=P[i:i+T,j:j+T]
R=R.copy()
for _ in range(a.flou):   # flou 3 × 3 (bruit de la cuisson ; la marge de 8 px protège les bords des îlots)
    P=np.pad(R,((1,1),(1,1),(0,0)),mode='edge'); R=sum(P[i:i+R.shape[0],j:j+R.shape[1]] for i in range(3) for j in range(3))/9
vals=R[masque].mean(axis=1) if masque.any() else np.array([1.0])
p995=float(np.percentile(vals,99.5)); gain=1.0/max(p995,1e-3)
S=np.clip(R*gain,0,1); moyen=float(np.clip(vals.mean()*gain,0,1)); S[~masque]=moyen
srgb=np.where(S<=0.0031308,12.92*S,1.055*np.power(np.maximum(S,0),1/2.4)-0.055)
img8=(srgb*255+0.5).astype(np.uint8)[::-1]   # fichier : lignes de haut en bas (three.js, flipY)
os.makedirs(a.sortie,exist_ok=True)
try:
    from PIL import Image
    Image.fromarray(np.ascontiguousarray(img8),'RGB').save(os.path.join(a.sortie,'lumiere.webp'),quality=88,method=6)
except ImportError:
    img.file_format='PNG'; img.filepath_raw=os.path.join(a.sortie,'lumiere.png'); img.save(); log('PIL absent : PNG écrit, à convertir en WebP')
u16=np.clip(np.round(uv*65535),0,65535).astype('<u2'); u16.tofile(os.path.join(a.sortie,'lumiere_uv.bin'))
json.dump({'version':a.version,'intensite':a.intensite,'taille':a.taille,'echantillons':a.echantillons,'gain':round(gain,4),'p995':round(p995,5),
           'moyenne':round(float(vals.mean()),5),'couverture':round(float(masque.mean()),4),'triangles':nT,'perdus':perdus,'date':time.strftime('%Y-%m-%d %H:%M'),
           'maillages':[{'n':m['n'],'s':m['s']} for m in fiche['maillages']]},
          open(os.path.join(a.sortie,'lumiere.json'),'w',encoding='utf-8'),ensure_ascii=False)
log(f"écrit dans {a.sortie} : couverture {masque.mean()*100:.1f} %, p99,5 {p995:.4f}, gain {gain:.3f}, moyenne {vals.mean():.4f}")
