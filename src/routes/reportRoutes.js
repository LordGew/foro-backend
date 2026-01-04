const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');
const path = require('path');

// Middleware para autenticación
router.use(authMiddleware);

// Rutas de reportes (todos los usuarios)
router.post('/', reportController.createReport);
router.get('/my-reports', reportController.getUserReports);
router.get('/:reportId', reportController.getReportDetails);
router.post('/:reportId/evidence', reportController.uploadEvidence);

// Rutas de administración (solo admin/moderator)
router.get('/admin/pending', reportController.getPendingReports);
router.get('/admin/stats', reportController.getReportStats);
router.put('/:reportId/review', reportController.reviewReport);
router.put('/:reportId/escalate', reportController.escalateReport);

// Servir archivos estáticos de evidencia
router.use('/uploads/reports', express.static(path.join(__dirname, '../uploads/reports')));

module.exports = router;
