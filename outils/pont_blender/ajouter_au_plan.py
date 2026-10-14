# Ajoute un objet fait par le pont Blender au plan Blender de son niveau (meubles_rez.blend ou meubles_etage.blend),
# puis enregistre le plan. Lancé par pont_blender.py dans un Blender invisible :
#   blender.exe -b --factory-startup <plan.blend> --python ajouter_au_plan.py -- <demande.json>
# demande.json : {id, nom, blend (objet.blend écrit dans Blender) ou glb (repli), collection (pièce), parent,
#                 position [X, Y, Z] et rotation (radians) dans le repère du plan, sortie (résultat JSON)}
# L'objet est rangé sous la collection « parent » / « collection », sous un vide nommé comme lui (propriété m3d_id) :
# s'il y est déjà (même m3d_id), rien n'est ajouté.
import json
import os
import sys
import traceback

import bpy

a = json.load(open(sys.argv[sys.argv.index('--') + 1], encoding='utf-8'))
res = {'ok': False}


def collection(nom, parent):
    for c in parent.children:
        if c.name == nom or c.name.split('.')[0] == nom:
            return c
    c = bpy.data.collections.new(nom)
    parent.children.link(c)
    return c


try:
    deja = [o for o in bpy.data.objects if o.get('m3d_id') == a['id']]
    if deja:
        res = {'ok': True, 'deja': True, 'collection': deja[0].users_collection[0].name if deja[0].users_collection else ''}
    else:
        racine = bpy.context.scene.collection
        haut = collection(a.get('parent') or 'Créés depuis l’application', racine)
        piece = collection(a.get('collection') or 'Divers', haut)
        avant = set(bpy.data.objects)
        source = ''
        if a.get('blend') and os.path.exists(a['blend']):
            with bpy.data.libraries.load(a['blend'], link=False) as (src, dst):
                dst.objects = list(src.objects)
            nouveaux = [o for o in dst.objects if o is not None]
            for o in nouveaux:
                piece.objects.link(o)
            source = 'blend'
        else:
            bpy.ops.import_scene.gltf(filepath=a['glb'])
            nouveaux = [o for o in bpy.data.objects if o not in avant]
            for o in nouveaux:
                for c in list(o.users_collection):
                    c.objects.unlink(o)
                piece.objects.link(o)
            source = 'glb'
        if not nouveaux:
            raise RuntimeError('aucun objet trouvé dans le fichier de l’objet')
        bpy.context.view_layer.update()
        # un vide nommé comme l'objet porte tout : on le déplace, on le tourne, on le retrouve
        vide = bpy.data.objects.new(a.get('nom') or 'Objet', None)
        vide.empty_display_type = 'PLAIN_AXES'
        vide.empty_display_size = 0.2
        vide['m3d_id'] = a['id']
        piece.objects.link(vide)
        for o in nouveaux:
            if o.parent is None or o.parent not in nouveaux:
                mw = o.matrix_world.copy()
                o.parent = vide
                o.matrix_world = mw
        vide.location = a.get('position') or (0, 0, 0)
        vide.rotation_euler = (0, 0, float(a.get('rotation') or 0))
        bpy.ops.wm.save_mainfile()
        res = {'ok': True, 'collection': haut.name + ' / ' + piece.name, 'objets': len(nouveaux), 'source': source}
except Exception as e:
    res = {'ok': False, 'erreur': str(e)[:400], 'pile': traceback.format_exc()[-1200:]}

with open(a['sortie'], 'w', encoding='utf-8') as f:
    json.dump(res, f, ensure_ascii=False)
