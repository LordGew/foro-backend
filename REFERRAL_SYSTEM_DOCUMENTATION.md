# 📋 SISTEMA DE REFERIDOS - DOCUMENTACIÓN COMPLETA

## 🎯 OBJETIVO
El sistema de referidos permite a los usuarios invitar amigos y ganar puntos que pueden canjear por recompensas exclusivas en la tienda.

---

## 💎 PUNTOS Y RECOMPENSAS

### Puntos por Referido
- **100 puntos** por cada referido que complete todos los requisitos

### Estados de Referidos
1. **Pending (Pendiente)** - El usuario se registró pero aún no cumple los requisitos
2. **Completed (Completado)** - El referido cumplió todos los requisitos, puntos acreditados
3. **Cancelled (Cancelado)** - El referido no cumplió los requisitos en 30 días

---

## ✅ REQUISITOS PARA VALIDACIÓN

Para que un referido sea válido y otorgue puntos, debe cumplir **TODOS** estos requisitos:

### 1. Validaciones Anti-Fraude
- ❌ **No se permite** usar el propio código de referido
- ❌ **No se permite** usar un código más de una vez
- ❌ **No se permite** registrarse desde la misma IP que el referente
- ✅ **Debe ser** una cuenta única y real

### 2. Perfil Completo
- Tener username válido
- Tener email verificado

### 3. Actividad Mínima
El referido debe cumplir **AL MENOS UNA** de estas condiciones:
- Crear **1 post** o más
- Crear **3 comentarios** o más

### 4. Tiempo Mínimo
- Permanecer activo por **7 días** desde el registro

---

## ⏱️ PROCESO DE VALIDACIÓN

### Flujo Completo

1. **Usuario A** comparte su código de referido
2. **Usuario B** se registra usando el código
3. El sistema crea un referido con estado **"pending"**
4. **Usuario B** debe completar los requisitos:
   - ✅ Perfil completo
   - ✅ Actividad mínima (1 post o 3 comentarios)
   - ✅ 7 días de actividad
5. Un **job automático** verifica diariamente los referidos pendientes
6. Cuando se cumplen todos los requisitos:
   - Estado cambia a **"completed"**
   - Se acreditan **100 puntos** a **Usuario A**
   - Se envía notificación a **Usuario A**

### Cancelación Automática
- Si después de **30 días** el referido no cumple los requisitos, el estado cambia a **"cancelled"**
- No se acreditan puntos

---

## 🔧 ENDPOINTS DEL BACKEND

### Para Usuarios

#### Obtener mi código de referido
```
GET /api/referrals/my-code
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "referralCode": "A1B2C3D4",
  "referralLink": "https://wow-community.com/register?ref=A1B2C3D4",
  "totalReferrals": 5,
  "referralPoints": 300
}
```

#### Aplicar código de referido
```
POST /api/referrals/apply
Authorization: Bearer {token}
Content-Type: application/json

{
  "referralCode": "A1B2C3D4"
}
```

**Respuesta (Éxito):**
```json
{
  "message": "Código de referido aplicado. Los puntos se acreditarán cuando completes los requisitos de actividad.",
  "status": "pending",
  "requirements": {
    "profileComplete": false,
    "minimumActivity": "Crear 1 post o 3 comentarios",
    "minimumDays": 7,
    "pointsToEarn": 100
  },
  "referrer": {
    "username": "UsuarioA",
    "_id": "..."
  }
}
```

#### Verificar estado de mi referido
```
GET /api/referrals/check-status
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "status": "pending",
  "referrer": "UsuarioA",
  "pointsToEarn": 100,
  "requirements": {
    "profileComplete": {
      "completed": true,
      "description": "Perfil completo con username y email"
    },
    "minimumActivity": {
      "completed": false,
      "description": "Crear 1 post o 3 comentarios",
      "progress": {
        "posts": 0,
        "replies": 1
      }
    },
    "minimumDays": {
      "completed": false,
      "description": "Permanecer activo por 7 días",
      "progress": {
        "current": 3,
        "required": 7
      }
    }
  },
  "completedAt": null
}
```

#### Obtener mis referidos
```
GET /api/referrals/my-referrals
Authorization: Bearer {token}
```

### Para Administradores

#### Validar referidos pendientes (Manual)
```
POST /api/referrals/validate-pending
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "message": "Validación de referidos completada",
  "validated": 3,
  "cancelled": 1,
  "stillPending": 5
}
```

---

## 🤖 JOB AUTOMÁTICO

### Configuración Recomendada

Ejecutar diariamente a las 00:00 UTC:

```javascript
// Ejemplo con node-cron
const cron = require('node-cron');
const referralController = require('./controllers/referralController');

// Ejecutar todos los días a medianoche
cron.schedule('0 0 * * *', async () => {
  console.log('🔄 Ejecutando validación automática de referidos...');
  try {
    await referralController.validatePendingReferrals(null, null);
  } catch (error) {
    console.error('❌ Error en validación automática:', error);
  }
});
```

---

## 📊 MODELO DE DATOS

### Referral Schema
```javascript
{
  referrer: ObjectId,        // Usuario que refirió
  referred: ObjectId,        // Usuario referido
  referralCode: String,      // Código usado
  pointsAwarded: Number,     // Puntos a otorgar (100)
  status: String,            // 'pending', 'completed', 'cancelled'
  completedAt: Date,         // Fecha de completación
  createdAt: Date            // Fecha de creación
}
```

---

## 🚨 CASOS DE ERROR

### Error: Código inválido
```json
{
  "message": "Código de referido inválido"
}
```

### Error: Código propio
```json
{
  "message": "No puedes usar tu propio código de referido"
}
```

### Error: Ya usado
```json
{
  "message": "Ya has usado un código de referido"
}
```

### Error: Detección de fraude
```json
{
  "message": "No se puede validar el referido. Contacta con soporte si crees que es un error.",
  "reason": "fraud_detection"
}
```

---

## 📝 LOGS Y MONITOREO

### Logs Importantes

```
✅ Referido validado: UsuarioB -> UsuarioA (+100 puntos)
❌ Referido cancelado por inactividad: UsuarioC -> UsuarioA
⚠️ Intento de fraude detectado: Misma IP 192.168.1.1 para referrer 123 y referred 456
📊 Resultado de validación de referidos: { validated: 3, cancelled: 1, stillPending: 5 }
```

---

## 🔐 SEGURIDAD

### Medidas Implementadas

1. **Validación de IP** - Detecta registros desde la misma IP
2. **Índice único** - Previene referidos duplicados en la base de datos
3. **Validación de propiedad** - No se puede usar el propio código
4. **Límite de uso** - Solo se puede usar un código de referido por cuenta
5. **Cancelación automática** - Referidos inactivos se cancelan después de 30 días

---

## 📈 MÉTRICAS RECOMENDADAS

### KPIs a Monitorear

- Total de referidos pendientes
- Tasa de conversión (pending → completed)
- Tasa de cancelación
- Tiempo promedio de validación
- Intentos de fraude detectados
- Puntos totales otorgados

---

## 🔄 MANTENIMIENTO

### Tareas Periódicas

1. **Diario**: Ejecutar validación automática de referidos
2. **Semanal**: Revisar logs de intentos de fraude
3. **Mensual**: Analizar métricas de conversión
4. **Trimestral**: Ajustar requisitos si es necesario

---

## 📞 SOPORTE

Si un usuario reporta problemas con su referido:

1. Verificar el estado con `GET /api/referrals/check-status`
2. Revisar logs del backend para detectar errores
3. Verificar que cumple todos los requisitos
4. Si es necesario, ejecutar validación manual con `POST /api/referrals/validate-pending`

---

**Última actualización:** Diciembre 2024
**Versión:** 2.0
