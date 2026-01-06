# 🚀 Guía Rápida de Ejecución de Pruebas

## ⚡ Instalación Rápida (5 minutos)

### Paso 1: Instalar Dependencias

```bash
# Navegar al directorio del backend
cd C:\Users\Jairo\CascadeProjects\foro-backend

# Instalar dependencias de testing
npm install --save-dev mongodb-memory-server@^9.1.6

# Instalar Artillery globalmente para pruebas de estrés
npm install -g artillery
```

### Paso 2: Verificar Instalación

```bash
# Verificar que Jest esté disponible
npm test -- --version

# Verificar Artillery
artillery --version
```

---

## 🧪 Ejecutar Pruebas

### Opción 1: Todas las Pruebas (Recomendado para primera vez)

```bash
npm test
```

**Tiempo estimado**: 2-3 minutos  
**Qué hace**: Ejecuta todas las pruebas unitarias, de integración y seguridad

### Opción 2: Por Categoría

```bash
# Solo pruebas unitarias (más rápido)
npm run test:unit

# Solo pruebas de integración
npm run test:integration

# Solo pruebas de seguridad
npm run test:security
```

### Opción 3: Con Reporte de Cobertura

```bash
npm run test:coverage
```

**Resultado**: Genera reporte HTML en `coverage/lcov-report/index.html`

---

## 📊 Pruebas de Estrés

### Prueba Básica (Recomendado primero)

```bash
# Prueba rápida de 60 segundos
artillery quick --duration 60 --rate 10 https://foro-backend-9j93.onrender.com/api/posts
```

### Prueba Completa

```bash
# Ejecutar suite completa de pruebas de carga
npm run stress:test
```

**Tiempo estimado**: 4-5 minutos  
**Qué hace**: Simula 5 fases de carga con hasta 200 usuarios simultáneos

### Prueba con Reporte HTML

```bash
# Generar reporte visual
npm run stress:report
```

**Resultado**: Genera `report.json` y reporte HTML

---

## 📈 Interpretar Resultados

### Pruebas Unitarias/Integración

#### ✅ Resultado Exitoso
```
PASS  tests/unit/auth.test.js
PASS  tests/unit/referrals.test.js
PASS  tests/unit/security.test.js

Test Suites: 3 passed, 3 total
Tests:       52 passed, 52 total
Time:        15.234s
```

#### ❌ Resultado con Errores
```
FAIL  tests/unit/auth.test.js
  ● debe rechazar login con contraseña incorrecta
    Expected: 401
    Received: 200
```

**Acción**: Revisar el test fallido y corregir el código

### Pruebas de Estrés

#### Métricas Clave

| Métrica | Excelente | Aceptable | Problemático |
|---------|-----------|-----------|--------------|
| Response Time (p95) | < 200ms | 200-500ms | > 500ms |
| Error Rate | < 1% | 1-5% | > 5% |
| Throughput | > 100 req/s | 50-100 req/s | < 50 req/s |

#### Ejemplo de Resultado Bueno
```
Summary:
  Scenarios launched: 1000
  Scenarios completed: 995
  Mean response time: 185ms
  p95: 320ms
  Error rate: 0.5%
  Codes:
    200: 950
    201: 45
```

---

## 🐛 Solución de Problemas Comunes

### Error: "Cannot find module 'mongodb-memory-server'"

**Solución**:
```bash
npm install --save-dev mongodb-memory-server@^9.1.6
```

### Error: "artillery: command not found"

**Solución**:
```bash
npm install -g artillery
```

### Error: "Port already in use"

**Solución**:
```bash
# Matar procesos de Node.js
taskkill /F /IM node.exe
```

### Tests muy lentos

**Solución**: Ya está configurado con `--runInBand` para ejecución secuencial

### Error: "Timeout exceeded"

**Solución**: El timeout está configurado a 30 segundos. Si persiste, verificar conexión a internet.

---

## 📋 Checklist de Validación

Ejecuta estos comandos en orden:

- [ ] `npm test` - Todas las pruebas pasan
- [ ] `npm run test:coverage` - Cobertura ≥ 80%
- [ ] `npm run stress:test` - Sin errores críticos
- [ ] Revisar reportes generados
- [ ] Documentar cualquier error encontrado

---

## 🎯 Próximos Pasos Después de las Pruebas

### Si todas las pruebas pasan ✅

1. **Revisar cobertura de código**
   - Abrir `coverage/lcov-report/index.html`
   - Identificar áreas con baja cobertura
   - Planificar tests adicionales si es necesario

2. **Analizar métricas de rendimiento**
   - Verificar response times
   - Identificar endpoints lentos
   - Planificar optimizaciones

3. **Documentar resultados**
   - Guardar reportes
   - Crear baseline para futuras comparaciones
   - Actualizar documentación

### Si hay errores ❌

1. **Priorizar por severidad**
   - Crítico: Errores de seguridad, fallos de autenticación
   - Alto: Errores en flujos principales
   - Medio: Errores en funcionalidades secundarias
   - Bajo: Mejoras de rendimiento

2. **Corregir errores críticos primero**
   - Revisar logs detallados
   - Identificar causa raíz
   - Implementar fix
   - Re-ejecutar pruebas

3. **Crear issues para seguimiento**
   - Documentar cada error
   - Asignar prioridad
   - Planificar correcciones

---

## 📞 Obtener Ayuda

### Logs Detallados

```bash
# Ejecutar con logs verbose
npm test -- --verbose

# Ver solo errores
npm test -- --silent
```

### Debugging

```bash
# Ejecutar un test específico
npm test -- auth.test.js

# Modo watch para desarrollo
npm run test:watch
```

### Recursos

- 📖 [README Completo](tests/README.md)
- 📊 [Resumen Ejecutivo](TESTING_SUMMARY.md)
- 🔧 [Configuración Jest](jest.config.js)

---

## ⏱️ Tiempo Estimado Total

| Actividad | Tiempo |
|-----------|--------|
| Instalación | 5 min |
| Pruebas unitarias | 2 min |
| Pruebas de integración | 1 min |
| Pruebas de seguridad | 1 min |
| Cobertura de código | 3 min |
| Pruebas de estrés | 5 min |
| Análisis de resultados | 10 min |
| **TOTAL** | **~30 min** |

---

## 🎓 Comandos de Referencia Rápida

```bash
# Testing básico
npm test                    # Todas las pruebas
npm run test:unit          # Solo unitarias
npm run test:coverage      # Con cobertura

# Testing de estrés
npm run stress:test        # Prueba de carga
npm run stress:report      # Con reporte HTML

# Debugging
npm test -- --verbose      # Logs detallados
npm run test:watch         # Modo desarrollo

# Instalación
npm install --save-dev mongodb-memory-server
npm install -g artillery
```

---

**¡Listo para comenzar! Ejecuta `npm test` para empezar** 🚀
