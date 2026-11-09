@echo off
chcp 65001 >nul
title OmniPlay Mobile — Executar no iOS (Expo Go)
SET "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

echo ========================================================
echo   OMNIPLAY MOBILE (React Native) — MODO iOS (iPhone/iPad)
echo ========================================================
echo.
echo 1. Instala a app gratuita "Expo Go" na App Store do teu iPhone.
echo 2. Assim que aparecer o QR Code abaixo, abre a Camara do iPhone
echo    e aponta para o QR Code para abrir a aplicacao OmniPlay!
echo.
npx.cmd expo start --tunnel
pause
