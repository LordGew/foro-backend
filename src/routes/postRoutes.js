const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const rbacMiddleware = require('../middlewares/rbacMiddleware');
const uploadSingleImage = require('../middlewares/uploadMiddleware');
const optionalAuth = require('../middlewares/optionalAuthMiddleware');
const {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  dislikePost,
  getPostsByCategoryParam,
  getPostsCount,
  deletePostByAdmin
} = require('../controllers/postController');

// Upload inline image for editor (returns Cloudinary URL)
const multerInline = require('multer');
const cloudinaryInline = require('cloudinary').v2;
const { CloudinaryStorage: CStorageInline } = require('multer-storage-cloudinary');
const inlineStorage = new CStorageInline({
  cloudinary: cloudinaryInline,
  params: {
    folder: 'wow-forum/inline',
    allowed_formats: ['jpeg', 'png', 'jpg', 'gif', 'webp'],
    resource_type: 'image',
    transformation: [{ width: 800, crop: 'limit', quality: 'auto' }]
  }
});
const uploadInline = multerInline({ storage: inlineStorage, limits: { fileSize: 5 * 1024 * 1024 } });
router.post('/upload-inline-image', authMiddleware, uploadInline.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image provided' });
  }
  res.json({ url: req.file.path });
});

// Crear post (upload primero, luego auth)
router.post('/', uploadSingleImage, authMiddleware, createPost);

// Obtener posts
router.get('/', getPosts);

// Obtener conteo de posts (nueva ruta)
router.get('/count', getPostsCount);

// Obtener posts por categoría (auth opcional para verificar acceso VIP)
router.get('/category/:id', optionalAuth, getPostsByCategoryParam);

// Obtener post por ID o slug (auth opcional para verificar acceso VIP)
router.get('/:param', optionalAuth, getPostById);

// Actualizar post
router.put('/:id', uploadSingleImage, authMiddleware, updatePost);

// Eliminar post (autor o moderador)
router.delete('/:id', authMiddleware, rbacMiddleware(['GameMaster', 'Admin']), deletePost);

// Eliminar post por admin
router.delete('/admin/:id', authMiddleware, rbacMiddleware('Admin'), deletePostByAdmin);

// Like post
router.post('/:id/like', authMiddleware, likePost);

// Dislike post
router.post('/:id/dislike', authMiddleware, dislikePost);

const multer = require('multer');
const uploadReplyImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WebP)'));
  }
});

// Ruta para crear respuestas (reenvía a replyRoutes, pero como frontend llama /posts/:id/replies, agregamos esta ruta)
router.post('/:id/replies', authMiddleware, uploadReplyImages.array('images', 5), (req, res, next) => {
  req.params.postId = req.params.id;
  next();
}, require('../controllers/replyController').createReply);

// Ruta para obtener respuestas (reenvía a replyRoutes) - Público
router.get('/:id/replies', (req, res, next) => {
  req.params.postId = req.params.id;
  next();
}, require('../controllers/replyController').getReplies);

module.exports = router;