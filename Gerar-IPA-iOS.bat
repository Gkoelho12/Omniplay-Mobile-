@echo off
chcp 65001 >nul
title OmniPlay Mobile — Gerar IPA para iOS na Nuvem (EAS Build)
SET "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

echo ========================================================
echo   OMNIPLAY MOBILE — GERAR FICHEIRO .IPA PARA iOS
echo ========================================================
echo.
echo Este script usa o Expo EAS na nuvem para compilar o ficheiro
echo nativo de iOS (.ipa) no Windows sem precisares de um Mac.
echo (Requer login na tua conta Expo gratuita e conta Apple).
echo.
npx.cmd eas-cli@latest build --platform ios --profile preview
pause
