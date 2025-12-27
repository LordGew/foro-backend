# Sistema de Pruebas - WOW Community Backend

Este documento describe el sistema completo de pruebas implementado para garantizar la calidad, seguridad y rendimiento del backend.

## 📋 Tabla de Contenidos

1. [Instalación](#instalación)
2. [Tipos de Pruebas](#tipos-de-pruebas)
3. [Ejecución de Pruebas](#ejecución-de-pruebas)
4. [Cobertura de Código](#cobertura-de-código)
5. [Pruebas de Estrés](#pruebas-de-estrés)
6. [Interpretación de Resultados](#interpretación-de-resultados)

## 🚀 Instalación

### Dependencias Necesarias

```bash
# Instalar dependencias de testing
npm install --save-dev jest supertest mongodb-memory-server

# Instalar Artillery para pruebas de estrés
npm install -g artillery
```

### Configuración

Las pruebas están configuradas para usar:
- **Jest**: Framework de testing
- **Supertest**: Testing de APIs HTTP
- **MongoDB Memory Server**: Base de datos en memoria para tests aislados
- **Artillery**: Pruebas de carga y estrés

## 🧪 Tipos de Pruebas

### 1. Pruebas Unitarias

Ubicación: `tests/unit/`

**Cobertura:**
- ✅ **Autenticación** (`auth.test.js`)
  - Registro de usuarios
  - Login y validación de credenciales
  - Generación y validación de JWT tokens
  - Manejo de errores de autenticación

- ✅ **Sistema de Referidos** (`referrals.test.js`)
  - Generación de códigos de referido
  - Flujo de registro con código
  - Validación de requisitos (2 días, perfil completo, actividad)
  - Otorgamiento de puntos (50 para referido, 100 para referidor)
  - Estadísticas de referidos

- ✅ **Seguridad** (`security.test.js`)
  - Protección contra SQL Injection
  - Protección contra XSS
  - Seguridad de contraseñas (hashing, complejidad)
  - Validación de inputs
  - Rate limiting
  - Prevención de exposición de datos sensibles
  - Seguridad en subida de archivos

### 2. Pruebas de Integración

Ubicación: `tests/integration/`

**Cobertura:**
- ✅ **Flujos completos de usuario**
  - Registro → Login → Actualización de perfil
  - Sistema de referidos completo
  
- ✅ **Creación de contenido**
  - Posts con categorías y juegos
  - Incremento de contadores
  
- ✅ **Relaciones de datos**
  - Categorías y juegos
  - Posts por categoría/juego
  
- ✅ **Permisos y roles**
  - Usuario normal, Admin, Moderador
  
- ✅ **Búsqueda y filtrado**
  - Búsqueda de usuarios
  - Filtrado de posts
  
- ✅ **Paginación y ordenamiento**

### 3. Pruebas de Estrés

Ubicación: `tests/stress/`

**Escenarios de carga:**

| Fase | Usuarios/seg | Duración | Objetivo |
|------|--------------|----------|----------|
| Warm up | 10 | 30s | Calentamiento del sistema |
| Normal load | 50 | 2min | Carga normal de operación |
| Peak load | 100 | 1min | Picos de tráfico |
| Stress test | 200 | 30s | Límites del sistema |
| Recovery | 20 | 30s | Recuperación |

**Endpoints probados:**
- Registro de usuarios (20% del tráfico)
- Login (30% del tráfico)
- Obtener posts (25% del tráfico)
- Crear posts (15% del tráfico)
- Perfil de usuario (10% del tráfico)
- Sistema de mensajería (10% del tráfico)
- Sistema de referidos (5% del tráfico)
- Búsqueda de usuarios (10% del tráfico)
- Categorías (15% del tráfico)
- WebSocket simulation (5% del tráfico)

## 🏃 Ejecución de Pruebas

### Pruebas Unitarias e Integración

```bash
# Ejecutar todas las pruebas
npm test

# Ejecutar pruebas específicas
npm test auth.test.js
npm test referrals.test.js
npm test security.test.js
npm test api.test.js

# Ejecutar con cobertura
npm test -- --coverage

# Modo watch (desarrollo)
npm test -- --watch

# Ejecutar solo pruebas modificadas
npm test -- --onlyChanged
```

### Pruebas de Estrés

```bash
# Ejecutar prueba de carga completa
artillery run tests/stress/load-test.yml

# Ejecutar con reporte HTML
artillery run tests/stress/load-test.yml --output report.json
artillery report report.json

# Prueba rápida (solo warm up y normal load)
artillery quick --duration 60 --rate 10 https://foro-backend-9j93.onrender.com/api/posts

# Monitoreo en tiempo real
artillery run tests/stress/load-test.yml --output report.json | artillery report --output report.html
```

## 📊 Cobertura de Código

### Objetivos de Cobertura

- **Statements**: ≥ 80%
- **Branches**: ≥ 75%
- **Functions**: ≥ 80%
- **Lines**: ≥ 80%

### Ver Reporte de Cobertura

```bash
# Generar reporte
npm test -- --coverage

# Ver reporte HTML
# El reporte se genera en: coverage/lcov-report/index.html
```

## 📈 Interpretación de Resultados

### Pruebas Unitarias/Integración

**Resultado exitoso:**
```
PASS  tests/unit/auth.test.js
PASS  tests/unit/referrals.test.js
PASS  tests/unit/security.test.js
PASS  tests/integration/api.test.js

Test Suites: 4 passed, 4 total
Tests:       XX passed, XX total
```

**Errores comunes:**
- ❌ **Connection timeout**: Verificar conexión a MongoDB
- ❌ **Token invalid**: Verificar JWT_SECRET en variables de entorno
- ❌ **Model not found**: Verificar que los modelos estén correctamente importados

### Pruebas de Estrés

**Métricas clave:**

1. **Response Time (Tiempo de respuesta)**
   - ✅ Excelente: < 200ms
   - ⚠️ Aceptable: 200-500ms
   - ❌ Problemático: > 500ms

2. **Throughput (Rendimiento)**
   - Requests por segundo procesados
   - Objetivo: > 100 req/s

3. **Error Rate (Tasa de errores)**
   - ✅ Excelente: < 1%
   - ⚠️ Aceptable: 1-5%
   - ❌ Problemático: > 5%

4. **HTTP Status Codes**
   - 2xx: Exitoso
   - 4xx: Error del cliente
   - 5xx: Error del servidor (crítico)

**Ejemplo de reporte Artillery:**

```
Summary report @ 12:00:00(+0000)
  Scenarios launched:  1000
  Scenarios completed: 980
  Requests completed:  4900
  Mean response/sec: 98.5
  Response time (msec):
    min: 45
    max: 1250
    median: 180
    p95: 450
    p99: 850
  Scenario counts:
    User Registration: 200 (100%)
  Codes:
    200: 900
    201: 80
    400: 15
    500: 5
```

## 🔍 Análisis de Seguridad

### Vulnerabilidades Probadas

✅ **SQL Injection**: Protegido mediante Mongoose ODM
✅ **XSS**: Sanitización de inputs
✅ **CSRF**: Tokens CSRF implementados
✅ **Rate Limiting**: Límites de peticiones por IP
✅ **Password Security**: Bcrypt con salt rounds
✅ **JWT Security**: Tokens con expiración
✅ **File Upload**: Validación de tipos y tamaños
✅ **Data Exposure**: Contraseñas nunca expuestas

### Recomendaciones de Seguridad

1. **Mantener dependencias actualizadas**
   ```bash
   npm audit
   npm audit fix
   ```

2. **Revisar logs regularmente**
   - Intentos de login fallidos
   - Errores 500
   - Patrones sospechosos

3. **Monitorear rate limiting**
   - Ajustar límites según tráfico real
   - Implementar captcha para endpoints críticos

## 🐛 Debugging de Pruebas

### Modo Verbose

```bash
# Ver logs detallados
npm test -- --verbose

# Ver solo errores
npm test -- --silent
```

### Variables de Entorno para Testing

```bash
# .env.test
NODE_ENV=test
JWT_SECRET=test-secret-key-for-testing-only
MONGODB_URI=mongodb://localhost:27017/test-db
```

### Troubleshooting

**Problema: Tests colgados**
```bash
# Forzar salida después de tests
npm test -- --forceExit
```

**Problema: Puerto en uso**
```bash
# Limpiar procesos
pkill -f node
```

**Problema: Base de datos no limpia**
```bash
# Verificar setup.js afterEach hook
```

## 📝 Mejores Prácticas

1. **Ejecutar pruebas antes de cada commit**
   ```bash
   git add .
   npm test && git commit -m "mensaje"
   ```

2. **Mantener tests aislados**
   - Cada test debe ser independiente
   - Usar beforeEach/afterEach para limpiar

3. **Nombres descriptivos**
   ```javascript
   it('debe rechazar login con contraseña incorrecta', ...)
   ```

4. **Probar casos límite**
   - Valores nulos
   - Strings vacíos
   - Números negativos
   - Arrays vacíos

5. **Actualizar tests con nuevas features**
   - Cada nueva funcionalidad debe tener tests
   - Mantener cobertura > 80%

## 🚨 CI/CD Integration

### GitHub Actions (ejemplo)

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
      - run: npm test -- --coverage
```

## 📞 Soporte

Si encuentras problemas con las pruebas:

1. Verificar que todas las dependencias estén instaladas
2. Revisar variables de entorno
3. Consultar logs de error detallados
4. Verificar versión de Node.js (22.x requerida)

---

**Última actualización**: Diciembre 2024
**Versión**: 1.0.0
