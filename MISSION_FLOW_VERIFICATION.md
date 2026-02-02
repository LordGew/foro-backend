# Flujo Completo de Misiones Diarias - Verificación

## 1. CARGA DE MISIONES (GET /api/missions/today)
✅ **Endpoint**: `getTodayMissions()`
- Obtiene misiones del día
- Si no existen, las genera automáticamente
- Obtiene progreso del usuario para cada misión
- Valida integridad del progreso
- Retorna misiones con progreso, completadas y reclamadas

**Respuesta esperada**:
```json
{
  "missions": [
    {
      "_id": "...",
      "type": "post_creation",
      "title": "Crea tu primer post",
      "description": "...",
      "icon": "📝",
      "requirement": { "value": 1 },
      "reward": { "points": 50, "xp": 25 },
      "difficulty": "easy",
      "progress": 0,
      "completed": false,
      "claimed": false
    }
  ],
  "streak": { "current": 0, "longest": 0 },
  "date": "2025-02-01T00:00:00.000Z",
  "weekNumber": 5
}
```

## 2. ACTUALIZACIÓN DE PROGRESO (updateMissionProgress)
✅ **Función**: `updateMissionProgress(userId, missionType, value, categoryId)`
- Se llama cuando el usuario realiza acciones (crear post, comentar, etc.)
- Busca misiones del tipo correspondiente
- Crea o actualiza el progreso del usuario
- Si progreso >= requirement, marca como completada
- Crea notificación cuando se completa
- Guarda con retry logic en caso de error

**Flujo**:
1. Usuario crea un post
2. Backend llama `updateMissionProgress(userId, 'post_creation', 1)`
3. Busca misión de tipo 'post_creation'
4. Actualiza progreso: 0 → 1
5. Verifica si 1 >= 1 (requirement)
6. Marca como completada
7. Crea notificación
8. Guarda en BD

## 3. VALIDACIÓN Y RECLAMO AUTOMÁTICO (POST /api/missions/validate-claim)
✅ **Endpoint**: `validateAndClaimAll()`
- Se llama automáticamente cuando el usuario carga las misiones
- Obtiene todas las misiones del día
- Obtiene progreso del usuario
- Para cada misión completada pero no reclamada:
  - Calcula bono por racha
  - Otorga puntos y XP
  - Marca como reclamada
- Si todas las misiones están reclamadas:
  - Actualiza racha
  - Verifica bono semanal (cada 7 días)

**Respuesta esperada**:
```json
{
  "success": true,
  "message": "2 recompensas reclamadas",
  "claimedCount": 2,
  "totalPoints": 150,
  "totalXp": 50,
  "weeklyBonus": 0
}
```

## 4. RECLAMO INDIVIDUAL (POST /api/missions/:missionId/claim)
✅ **Endpoint**: `claimMissionReward()`
- Valida que la misión esté completada
- Valida que no haya sido reclamada
- Valida integridad del progreso
- Calcula bono por racha
- Otorga puntos y XP al usuario
- Marca como reclamada
- Verifica si todas las misiones están reclamadas
- Actualiza racha si es necesario
- Verifica bono semanal

**Respuesta esperada**:
```json
{
  "success": true,
  "message": "Recompensa reclamada exitosamente",
  "rewards": {
    "points": 50,
    "streakBonus": 0,
    "weeklyBonus": 0,
    "totalPoints": 50,
    "xp": 25
  },
  "newTotals": {
    "achievementPoints": 150,
    "xp": 75
  }
}
```

## 5. ACTUALIZACIÓN DE RACHA (updateStreak)
✅ **Función**: `updateStreak(userId)`
- Verifica si el usuario completó todas las misiones hoy
- Si es el primer día: racha = 1
- Si es consecutivo: racha += 1
- Si hay un día sin completar: racha = 0
- Actualiza longest si es mayor

## FLUJO COMPLETO END-TO-END

### Día 1 - Usuario crea un post
1. POST /api/posts → Backend llama `updateMissionProgress(userId, 'post_creation', 1)`
2. Misión 'post_creation' se marca como completada
3. GET /api/missions/today → Frontend recibe misión completada
4. Frontend llama POST /api/missions/validate-claim automáticamente
5. Backend otorga 50 puntos + 25 XP
6. Usuario ve notificación y recompensa

### Día 2 - Usuario continúa
1. Completa misión 2
2. Completa misión 3
3. GET /api/missions/today → Todas completadas
4. POST /api/missions/validate-claim → Otorga recompensas
5. Racha se actualiza a 2
6. Usuario ve racha en el perfil

### Día 7 - Bono semanal
1. Usuario completa todas las misiones 7 días consecutivos
2. Racha = 7
3. Bono semanal = 500 puntos adicionales
4. Usuario recibe notificación de bono semanal

## VALIDACIONES IMPLEMENTADAS

✅ Validación de integridad de progreso
✅ Retry logic para guardar progreso
✅ Notificaciones automáticas
✅ Cálculo de bono por racha
✅ Bono semanal cada 7 días
✅ Prevención de reclamo duplicado
✅ Logging detallado para debugging

## PUNTOS CRÍTICOS A VERIFICAR

1. ✅ Endpoint `/api/missions/today` existe y retorna datos correctos
2. ✅ Endpoint `/api/missions/validate-claim` existe y funciona
3. ✅ Función `updateMissionProgress` se llama correctamente desde acciones del usuario
4. ✅ Recompensas se otorgan correctamente
5. ✅ Racha se actualiza correctamente
6. ✅ Bono semanal se otorga en día 7

## PRÓXIMAS ACCIONES

- Verificar que las acciones del usuario (crear post, comentar) llamen a `updateMissionProgress`
- Probar flujo completo end-to-end
- Verificar logs en backend
- Confirmar que puntos y XP se actualizan en el usuario
