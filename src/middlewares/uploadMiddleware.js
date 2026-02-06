// src/middlewares/uploadMiddleware.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'wow-forum',
    allowed_formats: ['jpeg', 'png', 'jpg', 'gif', 'webp'],
    resource_type: 'image',
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fieldSize: 10 * 1024 * 1024 }
});

const uploadSingleImage = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    // La imagen es opcional - permitir continuar sin ella
    next();
  });
};

// Asegúrate de que esta línea esté al final
module.exports = uploadSingleImage;