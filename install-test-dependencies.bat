@echo off
echo ========================================
echo Instalando dependencias de testing
echo ========================================
echo.

echo [1/3] Instalando dependencias de desarrollo...
call npm install --save-dev mongodb-memory-server@^9.1.6
echo.

echo [2/3] Instalando Artillery globalmente...
call npm install -g artillery
echo.

echo [3/3] Verificando instalacion...
call npm list mongodb-memory-server
call artillery --version
echo.

echo ========================================
echo Instalacion completada!
echo ========================================
echo.
echo Para ejecutar las pruebas:
echo   npm test              - Todas las pruebas
echo   npm run test:unit     - Solo pruebas unitarias
echo   npm run test:security - Solo pruebas de seguridad
echo   npm run stress:test   - Pruebas de estres
echo.
pause
