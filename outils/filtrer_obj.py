# Filtre l OBJ exporte de SketchUp : retire les objets decoratifs lourds et regroupe les maillages par meuble.
# Usage : python3 filtrer_obj.py diolly_def2.obj filtered.obj
import sys,re,collections
src,dst=sys.argv[1],sys.argv[2]
DROP=['Chris','Machine_à_café','Fruit_bowl','armoire__Books','armoire__LIVRES5','armoire__Livres-','armoire__livrechat',
      'armoire__Magazine_Stack','armoire__FF_Letter_Stack','armoire__Panasonic_telephone','armoire__téléphone_fixe',
      'armoire__Real_Chinese_vase','armoire__vase_','armoire__Component_1470881']
def key(n):
    n=re.sub(r'^mesh_\d+_ROOT__','',n); n=re.sub(r'_Layer.*$','',n); p=n.split('__')
    return n, ('__'.join(p[:2]) if len(p)>1 else p[0])
out=open(dst,'w',encoding='utf-8'); skip=False; last=None; kept=collections.Counter(); dropped=0
for line in open(src,encoding='utf-8',errors='replace'):
    if line.startswith('o '):
        full,k=key(line[2:].strip())
        skip=any(d in full for d in DROP)
        if skip: dropped+=1; continue
        k={'Groupe#12':'structure_rez','Groupe#45':'structure_etage'}.get(k,k)
        k=k.replace('Groupe#12__','rez__').replace('Groupe#45__','etage__')
        if k!=last: out.write(f'o {k}\n'); last=k
        kept[k]+=1; continue
    if skip and line[:2] in ('f ','us'):
        continue
    if line.startswith('usemtl') and skip: continue
    out.write(line)
out.close()
print('dropped meshes',dropped,'items',len(kept))

# Renomme les objets dont le nom apparaît plusieurs fois (ex. etage__Velux -> etage__Velux_2)
seen=collections.Counter(); L=open(dst,encoding='utf-8').readlines()
for i,l in enumerate(L):
    if l.startswith('o '):
        n=l[2:].strip(); seen[n]+=1
        if seen[n]>1: L[i]=f'o {n}_{seen[n]}\n'
open(dst,'w',encoding='utf-8').writelines(L)
