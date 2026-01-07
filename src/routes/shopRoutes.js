const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');
const shopController = require('../controllers/shopController');

// Rutas públicas/autenticadas
router.get('/', shopController.getAllShopItems);
router.post('/:itemId/purchase', authMiddleware, shopController.purchaseShopItem);

// Rutas de administración (solo Admin)
router.post('/', authMiddleware, rbacMiddleware(['Admin']), shopController.createShopItem);
router.put('/:itemId', authMiddleware, rbacMiddleware(['Admin']), shopController.updateShopItem);
router.delete('/:itemId', authMiddleware, rbacMiddleware(['Admin']), shopController.deleteShopItem);

module.exports = router;
