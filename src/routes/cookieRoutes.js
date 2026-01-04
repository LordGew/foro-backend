const express = require('express');
const router = express.Router();
const cookieController = require('../controllers/cookieController');
const authMiddleware = require('../middlewares/authMiddleware');

/**
 * 🍪 Rutas de Gestión de Cookies y Política de Privacidad
 */

// Página de política de cookies (pública)
router.get('/policy', cookieController.getCookiePolicy);

// Obtener preferencias actuales de cookies
router.get('/preferences', cookieController.getCookiePreferences);

// Guardar preferencias de cookies
router.post('/preferences', cookieController.saveCookiePreferences);

// Actualizar preferencia específica de cookies
router.put('/preferences', cookieController.updateCookiePreferences);

// Retirar consentimiento de cookies
router.delete('/consent', cookieController.withdrawCookieConsent);

// Obtener detalles de cookies utilizadas
router.get('/details', cookieController.getCookieDetails);

// Obtener resumen de privacidad
router.get('/privacy-summary', cookieController.getPrivacySummary);

// Endpoint para verificar estado de consentimiento (útil para frontend)
router.get('/consent-status', (req, res) => {
  res.json({
    hasConsent: req.cookieConsent.hasConsent,
    consentDate: req.cookieConsent.consentDate,
    preferences: req.cookieConsent.preferences,
    requiresAction: !req.cookieConsent.hasConsent
  });
});

module.exports = router;
