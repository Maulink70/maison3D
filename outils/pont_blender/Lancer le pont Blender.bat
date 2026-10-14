@echo off
rem Pont Blender de Maison3D : laisse cette fenetre ouverte (et Blender ouvert). Ctrl+C pour arreter.
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul && (py -3 pont_blender.py %*) || (python pont_blender.py %*)
pause
