@echo off
setlocal enabledelayedexpansion
REM Mastaler App - Deploy zu GitHub Pages
REM Doppelklick genuegt. Liegt im Repo-Ordner.

cd /d "%~dp0"

echo.
echo === Mastaler App: Deploy ===
echo.

git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
  echo FEHLER: Dieser Ordner ist kein Git-Repository.
  echo Lege deploy.bat in den Ordner, in dem auch .git liegt.
  echo.
  pause
  exit /b 1
)

REM Aktuellen Branch ermitteln
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set BRANCH=%%b
if "!BRANCH!"=="" set BRANCH=main
if "!BRANCH!"=="HEAD" set BRANCH=main

echo Branch: !BRANCH!
echo.
echo Aenderungen:
git status --short
echo.

REM Auf Aenderungen pruefen - erfasst auch neue, noch nicht verfolgte Dateien
set CHANGED=
for /f "delims=" %%i in ('git status --porcelain') do set CHANGED=1
if not defined CHANGED (
  echo Nichts zu tun - keine Aenderungen.
  echo.
  pause
  exit /b 0
)

set "MSG="
set /p MSG="Commit-Nachricht (Enter = Standard): "
if "!MSG!"=="" set MSG=App aktualisiert

git add -A
if errorlevel 1 (
  echo FEHLER bei git add.
  echo.
  pause
  exit /b 1
)

git commit -m "!MSG!"
if errorlevel 1 (
  echo.
  echo FEHLER beim Commit. Falls Git nach Name und E-Mail fragt:
  echo    git config --global user.name "Dein Name"
  echo    git config --global user.email "deine@mail.de"
  echo.
  pause
  exit /b 1
)

REM Existiert schon ein Upstream-Branch?
git rev-parse --abbrev-ref --symbolic-full-name @{u} >nul 2>&1
if errorlevel 1 (
  echo Erster Push - Branch wird auf dem Server angelegt.
  git push -u origin !BRANCH!
) else (
  git push
  if errorlevel 1 (
    echo.
    echo Push abgelehnt. Auf dem Server liegen neuere Commits.
    echo Das passiert regelmaessig, weil der Kalender-Workflow selbst committet.
    echo Hole sie und versuche es erneut...
    echo.
    git pull --rebase
    if errorlevel 1 (
      echo.
      echo FEHLER beim Zusammenfuehren. Vermutlich ein Konflikt.
      echo Pruefe mit:  git status
      echo Danach:      git rebase --continue
      echo Abbrechen:   git rebase --abort
      echo.
      pause
      exit /b 1
    )
    git push
  )
)

if errorlevel 1 (
  echo.
  echo FEHLER beim Push. Haeufige Ursachen:
  echo   - Kein Internet
  echo   - Anmeldedaten abgelaufen
  echo   - Konflikt beim Zusammenfuehren, siehe oben
  echo   - Branch heisst anders als !BRANCH!:
  echo       git push -u origin HEAD
  echo.
  pause
  exit /b 1
)

echo.
echo Fertig. GitHub Pages braucht etwa eine Minute.
echo    https://zneptunz.github.io/App/
echo.
echo Auf dem Handy einmal mit Strg+Shift+R neu laden,
echo damit der neue Service Worker greift.
echo.
pause
