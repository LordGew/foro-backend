# 🔍 Verificación de Endpoints - Misiones y Badges

## Estado del Deploy
- **Commit actual**: `9c3d5eee` - Forzar redeploy de Render
- **Commit anterior**: `911ce3bc` - Sistema de moderación en chat
- **Fecha**: 7 de enero 2026

## ✅ Archivos Verificados en Repositorio

### Modelos
- ✅ `src/models/DailyMission.js` - Modelo de misiones diarias
- ✅ `src/models/UserMissionProgress.js` - Progreso de usuario en misiones
- ✅ `src/models/Badge.js` - Modelo de badges/insignias

### Controladores
- ✅ `src/controllers/missionController.js` - Lógica de misiones (404 líneas)
- ✅ `src/controllers/badgeController.js` - Lógica de badges (205 líneas)

### Rutas
- ✅ `src/routes/missionRoutes.js` - Rutas de misiones
- ✅ `src/routes/badgeRoutes.js` - Rutas de badges

### Registro en Server.js
- ✅ Línea 269: `const missionRoutes = require('./src/routes/missionRoutes');`
- ✅ Línea 268: `const badgeRoutes = require('./src/routes/badgeRoutes');`
- ✅ Línea 300: `app.use('/api/missions', missionRoutes);`
- ✅ Línea 299: `app.use('/api/badges', badgeRoutes);`

## 🧪 Endpoints para Probar (una vez desplegado Render)

### 1. Misiones Diarias

**Obtener misiones del día**
```bash
GET https://tu-backend.onrender.com/api/missions/today
Headers: Authorization: Bearer YOUR_TOKEN
```

**Reclamar recompensa de misión**
```bash
POST https://tu-backend.onrender.com/api/missions/:missionId/claim
Headers: Authorization: Bearer YOUR_TOKEN
```

**Obtener estadísticas de misiones**
```bash
GET https://tu-backend.onrender.com/api/missions/stats
Headers: Authorization: Bearer YOUR_TOKEN
```

### 2. Badges/Insignias

**Obtener todos los badges disponibles**
```bash
GET https://tu-backend.onrender.com/api/badges
Query params opcionales: ?category=achievement&rarity=legendary&sort=price_desc
```

**Comprar un badge**
```bash
POST https://tu-backend.onrender.com/api/badges/:badgeId/purchase
Headers: Authorization: Bearer YOUR_TOKEN
```

**Obtener badges de un usuario**
```bash
GET https://tu-backend.onrender.com/api/badges/user/:userId
```

### 3. Crear Badge (Solo Admin)
```bash
POST https://tu-backend.onrender.com/api/badges
Headers: Authorization: Bearer ADMIN_TOKEN
Body: {
  "name": "Veterano",
  "description": "Usuario con más de 1 año en la comunidad",
  "icon": "🎖️",
  "price": 5000,
  "category": "achievement",
  "rarity": "epic"
}
```

## 🔧 Troubleshooting

### Si los endpoints devuelven 404:
1. Verificar que Render terminó el deploy (revisar dashboard de Render)
2. Verificar logs de Render: buscar errores de importación
3. Verificar que las variables de entorno están configuradas

### Si los endpoints devuelven 500:
1. Revisar logs de Render para ver el error específico
2. Verificar conexión a MongoDB
3. Verificar que los modelos se importan correctamente

### Comandos útiles para verificar:
```bash
# Ver último commit en GitHub
git log -1 --oneline

# Ver archivos en el commit
git show HEAD --name-only

# Ver contenido de server.js en el commit
git show HEAD:server.js | grep -A 2 "missionRoutes"
```

## 📊 Respuestas Esperadas

### Misiones del día (exitoso):
```json
{
  "success": true,
  "missions": [
    {
      "_id": "...",
      "type": "create_post",
      "title": "Comparte tu conocimiento",
      "description": "Crea 1 post(s) en cualquier categoría",
      "icon": "📝",
      "targetValue": 1,
      "reward": 100,
      "progress": 0,
      "completed": false
    }
  ],
  "streak": 0,
  "nextResetAt": "2026-01-08T05:00:00.000Z"
}
```

### Badges disponibles (exitoso):
```json
{
  "success": true,
  "badges": [
    {
      "_id": "...",
      "name": "Novato",
      "description": "Primera insignia",
      "icon": "🌟",
      "price": 100,
      "category": "achievement",
      "rarity": "common",
      "available": true
    }
  ],
  "total": 1
}
```

## ⏱️ Tiempo Estimado de Deploy
- Render tarda aproximadamente **2-3 minutos** en desplegar después del push
- Puedes verificar el estado en: https://dashboard.render.com

## 🎯 Próximos Pasos
1. Esperar a que Render termine el deploy
2. Probar endpoints con Postman o Thunder Client
3. Si hay errores, revisar logs de Render
4. Verificar que el frontend puede consumir estos endpoints
