const express = require('express');
const router = express.Router();
const { createCategory, getCategories, updateCategory, deleteCategory, getCategoryByParam, } = require('../controllers/categoryController');
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');

router.post('/', authMiddleware, rbacMiddleware('Admin'), createCategory);
router.get('/', authMiddleware, getCategories); // Público
router.get('/:param', authMiddleware, getCategoryByParam);
router.put('/:id', authMiddleware, rbacMiddleware('Admin'), updateCategory);
router.delete('/:id', authMiddleware, rbacMiddleware('Admin'), deleteCategory);
router.get('/posts/category/:param', require('../controllers/postController').getPostsByCategoryParam);

module.exports = router;