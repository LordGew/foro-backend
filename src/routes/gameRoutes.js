const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');
const gameController = require('../controllers/gameController');

// Rutas públicas
router.get('/', gameController.getAllGames);
router.get('/:slug', gameController.getGameBySlug);
router.get('/:slug/categories', gameController.getGameCategories);

// Rutas de administración (solo Admin)
router.post('/', authMiddleware, rbacMiddleware(['Admin']), gameController.createGame);
router.put('/:id', authMiddleware, rbacMiddleware(['Admin']), gameController.updateGame);
router.delete('/:id', authMiddleware, rbacMiddleware(['Admin']), gameController.deleteGame);
router.put('/reorder', authMiddleware, rbacMiddleware(['Admin']), gameController.reorderGames);

// Rutas de categorías por juego (Admin)
router.post('/:gameId/categories', authMiddleware, rbacMiddleware(['Admin']), gameController.createGameCategory);
router.put('/categories/:categoryId', authMiddleware, rbacMiddleware(['Admin']), gameController.updateGameCategory);
router.delete('/categories/:categoryId', authMiddleware, rbacMiddleware(['Admin']), gameController.deleteGameCategory);

module.exports = router;
