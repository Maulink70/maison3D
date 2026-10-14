# Lancé par le pont Blender quand il ouvre Blender lui-même (blender.exe --python demarrer_blender_mcp.py).
# Le port voulu est dans M3D_PORT : 9877 pour le Blender à part du pont (réglage « port_pont »), 9876 sinon.
# L'extension « MCP for Blender » démarre son serveur toute seule, une fois l'interface prête, sur le port de la scène
# (propriété blendermcp_port) : on règle ce port tout de suite, avant elle. Si, 15 secondes plus tard, rien n'écoute
# encore sur ce port (ou si le serveur a démarré sur un autre), on le (re)démarre : bouton « Connect to Claude ».
# Si l'extension n'est pas activée dans les préférences, elle est activée pour cette session seulement.
# Ne touche à aucun fichier.
import os
import socket

import bpy

PORT = int(os.environ.get('M3D_PORT') or 9876)
essais = [0]


def _ecoute():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.5)
    try:
        s.connect(('127.0.0.1', PORT))
        return True
    except Exception:
        return False
    finally:
        s.close()


def _regler_port():
    for sc in bpy.data.scenes:
        try:
            sc.blendermcp_port = PORT
        except Exception:
            pass


def _demarrer():
    _regler_port()
    if _ecoute():
        return None
    essais[0] += 1
    serveur = getattr(bpy.types, 'blendermcp_server', None)
    if serveur is not None and getattr(serveur, 'port', PORT) != PORT:
        try:
            bpy.ops.blendermcp.stop_server()       # démarré sur un autre port avant notre réglage
        except Exception:
            pass
    try:
        bpy.ops.blendermcp.start_server()
    except Exception as e:
        print('Pont Blender : démarrage de Blender MCP impossible (' + str(e) + ').')
    if _ecoute():
        print('Pont Blender : Blender MCP écoute sur le port', PORT)
        return None
    return 5.0 if essais[0] < 6 else None


def _activer_extension():
    """Le Blender du pont ne charge que les extensions enregistrées dans les préférences : si « MCP for Blender » n'y est
    pas (activée seulement dans une session ouverte), on l'active pour cette session seulement (préférences inchangées).
    Nom du module : « blender_mcp » (extension installée à la main), « bl_ext.<dépôt>.blender_mcp » (extensions.blender.org)."""
    if hasattr(bpy.types.Scene, 'blendermcp_port'):
        return
    try:
        import addon_utils
    except Exception:
        return
    noms = ['blender_mcp', 'mcp_for_blender']
    try:
        for m in addon_utils.modules():
            nom = m.__name__
            titre = str((getattr(m, 'bl_info', None) or {}).get('name', ''))
            if nom.split('.')[-1] in ('blender_mcp', 'mcp_for_blender') or 'mcp' in titre.lower():
                if nom not in noms:
                    noms.insert(0, nom)
    except Exception:
        pass
    for nom in noms:
        try:
            if addon_utils.enable(nom, default_set=False) and hasattr(bpy.types.Scene, 'blendermcp_port'):
                print('Pont Blender : extension', nom, 'activée pour cette session.')
                return
        except Exception:
            pass
    print('Pont Blender : extension « MCP for Blender » introuvable.')


_activer_extension()
_regler_port()
bpy.app.timers.register(_demarrer, first_interval=15.0)
