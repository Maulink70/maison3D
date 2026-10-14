@echo off
rem Pont Blender de Maison3D : laisse cette fenetre ouverte (et Blender ouvert). Ctrl+C pour arreter.
chcp 65001 >nul
cd /d "%~dp0"
rem py si Python est installe avec son lanceur, sinon python (le pont arrete ne relance rien)
where py >nul 2>nul
if %errorlevel%==0 (py -3 pont_blender.py %*) else (python pont_blender.py %*)
pause
