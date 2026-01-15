# Guía de Migración - Sistema de Misiones Refactorizado

## 📋 Problemas Identificados y Solucionados

### 1. **Progreso se detiene en 2/3**
- **Causa:** Índice único incorrecto en `UserMissionProgress`
- **Solución:** Nuevo índice compuesto `(userId, missionId, date)` y validación de integridad

### 2. **Misiones simples no completan**
- **Causa:** Manejo inconsistente de fechas y zonas horarias
- **Solución:** Utilidad `DateUtils` para manejo estandarizado de fechas

### 3. **Misiones duplicadas en la semana**
- **Causa:** Sin control de ocurrencias semanales
- **Solución:** Sistema de prevención con `maxWeeklyOccurrences`

### 4. **Logging insuficiente**
- **Causa:** Logs básicos sin contexto
- **Solución:** Sistema de logging estructurado con `Logger`

## 🔄 Pasos para la Migración

### Paso 1: Backup de Datos
```bash
# Exportar datos existentes
mongodump --db foro --collection dailymissions --out backup/
mongodump --db foro --collection usermissionprogresses --out backup/
```

### Paso 2: Reemplazar Archivos
```bash
# Backup de archivos originales
mv src/controllers/missionController.js src/controllers/missionController_old.js
mv src/models/UserMissionProgress.js src/models/UserMissionProgress_old.js
mv src/models/DailyMission.js src/models/DailyMission_old.js

# Mover archivos refactorizados
mv src/controllers/missionController_refactored.js src/controllers/missionController.js
mv src/models/UserMissionProgress_fixed.js src/models/UserMissionProgress.js
mv src/models/DailyMission_fixed.js src/models/DailyMission.js
```

### Paso 3: Actualizar Rutas
```bash
# Actualizar rutas en el app principal
mv src/routes/missionRoutes.js src/routes/missionRoutes_old.js
mv src/routes/missionRoutes_refactored.js src/routes/missionRoutes.js
```

### Paso 4: Reiniciar Servidor
```bash
npm restart
# o
pm2 restart foro-backend
```

## 🧪 Verificación Post-Migración

### 1. Verificar Integridad
```bash
curl -H "Authorization: Bearer <token>" \
  https://foro-backend-9j93.onrender.com/api/missions/validate-integrity
```

### 2. Probar Generación de Misiones
```bash
curl -H "Authorization: Bearer <token>" \
  https://foro-backend-9j93.onrender.com/api/missions/today
```

### 3. Forzar Login (si es necesario)
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  https://foro-backend-9j93.onrender.com/api/missions/force-login
```

### 4. Obtener Debug Info
```bash
curl -H "Authorization: Bearer <token>" \
  https://foro-backend-9j93.onrender.com/api/missions/debug
```

## 🔍 Nuevas Funcionalidades

### 1. **Sistema de Prevención de Duplicados**
- Cada plantilla tiene `maxWeeklyOccurrences`
- Verificación automática antes de generar misiones
- Logging de decisiones de rechazo

### 2. **Validación de Integridad**
- Validación automática de progreso
- Detección de anomalías
- Corrección automática de inconsistencias

### 3. **Logging Mejorado**
- Logs estructurados con timestamps
- Niveles de severidad (INFO, WARNING, ERROR)
- Contexto completo para debugging

### 4. **Manejo de Fechas Robusto**
- Utilidad `DateUtils` para operaciones consistentes
- Manejo correcto de semanas (lunes a domingo)
- Prevención de problemas de zona horaria

### 5. **Endpoints de Depuración**
- `/api/missions/debug` - Información completa del estado
- `/api/missions/validate-integrity` - Validación de datos
- `/api/missions/reset-test` - Reset para pruebas

## 📊 Métricas y Monitoreo

### Logs Clave a Monitorear
- `🎯 [MISIÓN]` - Operaciones de misiones
- `📊 [PROGRESO]` - Actualizaciones de progreso
- `❌ [ERROR]` - Errores críticos
- `⚠️ [ADVERTENCIA]` - Problemas no críticos

### Indicadores de Salud
- **Tasa de éxito en actualizaciones de progreso**
- **Número de misiones duplicadas por semana**
- **Tiempo de respuesta de endpoints**
- **Número de errores de integridad**

## 🚨 Rollback Plan

### Si algo falla:
```bash
# Restaurar archivos originales
mv src/controllers/missionController.js src/controllers/missionController_refactored.js
mv src/models/UserMissionProgress.js src/models/UserMissionProgress_fixed.js
mv src/models/DailyMission.js src/models/DailyMission_fixed.js

mv src/controllers/missionController_old.js src/controllers/missionController.js
mv src/models/UserMissionProgress_old.js src/models/UserMissionProgress.js
mv src/models/DailyMission_old.js src/models/DailyMission.js

# Restaurar datos
mongorestore --db foro --collection dailymissions backup/foro/dailymissions.bson
mongorestore --db foro --collection usermissionprogresses backup/foro/usermissionprogresses.bson

# Reiniciar servidor
npm restart
```

## 📞 Soporte

### Problemas Comunes y Soluciones

1. **"Progreso no encontrado"**
   - Verificar que las misiones se generaron para hoy
   - Usar `/api/missions/debug` para verificar estado

2. **"Misión no completada" pero debería estarlo**
   - Verificar integridad con `/api/missions/validate-integrity`
   - Forzar actualización con `/api/missions/force-login`

3. **"Misiones duplicadas"**
   - Revisar logs de generación
   - Verificar `maxWeeklyOccurrences` en plantillas

4. **"Error de zona horaria"**
   - Verificar configuración del servidor
   - Revisar logs de `DateUtils`

## 🎯 Pruebas Recomendadas

### 1. Prueba Básica
- Iniciar sesión
- Crear 3 posts
- Verificar que la misión se complete al 100%

### 2. Prueba de Semana
- Generar misiones por 7 días
- Verificar que no haya duplicados del mismo tipo

### 3. Prueba de Estrés
- Múltiples usuarios simultáneos
- Actualizaciones rápidas de progreso
- Verificar integridad de datos

### 4. Prueba de Edge Cases
- Login a medianoche
- Cambios de zona horaria
- Conexiones intermitentes
