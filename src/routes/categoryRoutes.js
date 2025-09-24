const express = require('express');
const router = express.Router();
const { createCategory, getCategories, updateCategory, deleteCategory, getCategoryById } = require('../controllers/categoryController');
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');

router.post('/', authMiddleware, rbacMiddleware('Admin'), createCategory);
router.get('/', getCategories); // Público
router.get('/:id', getCategoryById); // 👈 Nuevo endpoint público
router.put('/:id', authMiddleware, rbacMiddleware('Admin'), updateCategory);
router.delete('/:id', authMiddleware, rbacMiddleware('Admin'), deleteCategory);

module.exports = router;