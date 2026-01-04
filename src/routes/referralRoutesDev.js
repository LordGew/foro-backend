const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const referralControllerDev = require('../controllers/referralControllerDev');

/**
 * 🔧 RUTAS DE DESARROLLO - SISTEMA DE REFERIDOS
 * 
 * Estas rutas omiten las validaciones de producción para facilitar el desarrollo.
 * 
 * IMPORTANTE: Estas rutas deben ser eliminadas o protegidas antes de ir a producción.
 */

// Obtener código de referido en modo desarrollo
router.get('/dev/my-code', authMiddleware, referralControllerDev.getMyReferralCodeDev);

// Aplicar código de referido sin validación de IP y con recompensa inmediata
router.post('/dev/apply', authMiddleware, referralControllerDev.applyReferralCodeDev);

// Validar referido específico sin requisitos de tiempo ni actividad
router.post('/dev/validate/:referralId', authMiddleware, referralControllerDev.validateReferralDev);

// Resetear todos los referidos del usuario (para testing)
router.delete('/dev/reset', authMiddleware, referralControllerDev.resetMyReferralsDev);

// Crear usuarios de prueba con referidos automáticos
router.post('/dev/create-test-users', authMiddleware, referralControllerDev.createTestUsersWithReferrals);

module.exports = router;
