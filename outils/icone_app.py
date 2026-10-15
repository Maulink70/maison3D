#!/usr/bin/env python3
"""Icônes de l'application (15 octobre 2026, choix de Mauro : variante A, fond blanc, maison bleue, « 3D » écrit dessous ;
l'ancienne icône bleue se voyait mal sur le fond bleu de son téléphone). Le dessin de la maison est repris de l'ancienne
icône (icones/source-maison.png : le dessin blanc sur fond bleu, 512 px), remonté, et « 3D » (IBM Plex Sans SemiBold) dessous.
Écrit : icone2-192.png, icone2-512.png (coins arrondis), icone2-maskable-512.png (carré plein, zone sûre centrale),
apple-touch-icon2.png (180, sans transparence), favicon2-64.png. Usage : python3 outils/icone_app.py"""
import os
from PIL import Image, ImageDraw, ImageFont
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..'); IC=os.path.join(R,'icones')
BLEU=(44,90,134); BLANC=(255,255,255)
src=Image.open(os.path.join(IC,'source-maison.png')).convert('RGBA'); S=src.size[0]
# part de dessin (blanc) dans chaque pixel de l'ancienne icône : canal rouge, fond 44 → dessin 255
dessin=Image.new('L',(S,S)); px=src.load(); q=dessin.load()
for y in range(S):
    for x in range(S): q[x,y]=int(round(255*max(0.0,min(1.0,(px[x,y][0]-BLEU[0])/(255-BLEU[0])))))
bb=dessin.getbbox(); maison=dessin.crop(bb)
def carre(T):
    im=Image.new('RGBA',(T,T),BLANC+(255,))
    # maison : 50 % de large, posée à partir de 13 % de haut ; « 3D » en dessous, en gras, centré
    lm=int(T*0.50); m=maison.resize((lm,int(maison.size[1]*lm/maison.size[0])),Image.LANCZOS)
    teinte=Image.new('RGBA',m.size,BLEU+(255,)); im.paste(teinte,((T-m.size[0])//2,int(T*0.13)),m)
    d=ImageDraw.Draw(im); font=ImageFont.truetype(os.path.join(R,'polices','IBMPlexSans-SemiBold.ttf'),int(T*0.27))
    tb=d.textbbox((0,0),'3D',font=font); tw=tb[2]-tb[0]; th=tb[3]-tb[1]
    d.text(((T-tw)/2-tb[0],int(T*0.62)-tb[1]),'3D',fill=BLEU+(255,),font=font)
    return im
def arrondi(im,r):
    T=im.size[0]; m=Image.new('L',(T,T),0); ImageDraw.Draw(m).rounded_rectangle((0,0,T-1,T-1),radius=r,fill=255); im=im.copy(); im.putalpha(m); return im
base=carre(1024)
arrondi(base,230).resize((512,512),Image.LANCZOS).save(os.path.join(IC,'icone2-512.png'))
arrondi(base,230).resize((192,192),Image.LANCZOS).save(os.path.join(IC,'icone2-192.png'))
arrondi(base,230).resize((64,64),Image.LANCZOS).save(os.path.join(IC,'favicon2-64.png'))
base.resize((512,512),Image.LANCZOS).save(os.path.join(IC,'icone2-maskable-512.png'))
base.convert('RGB').resize((180,180),Image.LANCZOS).save(os.path.join(IC,'apple-touch-icon2.png'))
print('icônes écrites dans',IC)
