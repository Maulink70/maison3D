// Corrige le GLB : murs roses de l etage (Material_363) en blanc + renomme les objets aux noms peu clairs.
// Usage : node corriger_glb.mjs entree.glb sortie.glb
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const doc=await io.read(process.argv[2]);
const lin=v=>Math.pow(v/255,2.2);
for(const m of doc.getRoot().listMaterials()) if(m.getName()==='Material_363') m.setBaseColorFactor([lin(242),lin(240),lin(236),1]);
const ren={'rez__Groupe#1':'rez__cloison','rez__Groupe#5':'rez__element_mural','rez__Groupe#34':'rez__store_fenetre','etage__CNS-WHT-963SPP':'etage__wc'};
for(const n of doc.getRoot().listNodes()) if(ren[n.getName()]) n.setName(ren[n.getName()]);
await io.write(process.argv[3],doc);
