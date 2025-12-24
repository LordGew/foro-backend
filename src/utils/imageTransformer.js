const normalizeImageUrl = (url, type = 'profile') => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'duqywugjo';
  return `https://res.cloudinary.com/${cloudName}/image/upload/${type}/${url}`;
};

const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  
  const parts = url.split('/');
  const uploadIndex = parts.findIndex(part => part === 'upload');
  if (uploadIndex === -1) return null;
  
  const publicIdWithExt = parts.slice(uploadIndex + 2).join('/');
  return publicIdWithExt.replace(/\.[^/.]+$/, '');
};

const validateImageFile = (file) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024;
  
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Solo se permiten imágenes (JPG, PNG, GIF, WebP)');
  }
  
  if (file.size > maxSize) {
    throw new Error('La imagen no debe superar los 5MB');
  }
  
  return true;
};

module.exports = {
  normalizeImageUrl,
  getPublicIdFromUrl,
  validateImageFile
};
