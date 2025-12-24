const validator = require('validator');

const validateRegister = (req, res, next) => {
  const { username, email, password } = req.body;
  const errors = [];

  if (!username || typeof username !== 'string') {
    errors.push('Username es requerido');
  } else if (username.length < 3 || username.length > 30) {
    errors.push('Username debe tener entre 3 y 30 caracteres');
  } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username solo puede contener letras, números, guiones y guiones bajos');
  }

  if (!email || !validator.isEmail(email)) {
    errors.push('Email inválido');
  }

  if (!password || password.length < 8) {
    errors.push('Password debe tener al menos 8 caracteres');
  } else if (password.length > 128) {
    errors.push('Password no puede exceder 128 caracteres');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: 'Errores de validación', errors });
  }

  next();
};

const validateCreatePost = (req, res, next) => {
  const { title, content, category } = req.body;
  const errors = [];

  if (!title || typeof title !== 'string') {
    errors.push('Título es requerido');
  } else if (title.trim().length < 5) {
    errors.push('Título debe tener al menos 5 caracteres');
  } else if (title.length > 200) {
    errors.push('Título no puede exceder 200 caracteres');
  }

  if (!content || typeof content !== 'string') {
    errors.push('Contenido es requerido');
  } else if (content.trim().length < 10) {
    errors.push('Contenido debe tener al menos 10 caracteres');
  } else if (content.length > 50000) {
    errors.push('Contenido no puede exceder 50,000 caracteres');
  }

  if (!category || typeof category !== 'string') {
    errors.push('Categoría es requerida');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: 'Errores de validación', errors });
  }

  next();
};

const validateCreateReply = (req, res, next) => {
  const { content } = req.body;
  const errors = [];

  if (!content || typeof content !== 'string') {
    errors.push('Contenido es requerido');
  } else if (content.trim().length < 1) {
    errors.push('Contenido no puede estar vacío');
  } else if (content.length > 10000) {
    errors.push('Contenido no puede exceder 10,000 caracteres');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: 'Errores de validación', errors });
  }

  next();
};

const validateUpdatePassword = (req, res, next) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;
  const errors = [];

  if (!currentPassword) {
    errors.push('Contraseña actual es requerida');
  }

  if (!newPassword || newPassword.length < 8) {
    errors.push('Nueva contraseña debe tener al menos 8 caracteres');
  } else if (newPassword.length > 128) {
    errors.push('Nueva contraseña no puede exceder 128 caracteres');
  }

  if (newPassword !== confirmNewPassword) {
    errors.push('Las contraseñas no coinciden');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: 'Errores de validación', errors });
  }

  next();
};

const validateSearchQuery = (req, res, next) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ message: 'Query parameter "q" es requerido' });
  }

  if (q.length < 2) {
    return res.status(400).json({ message: 'Query debe tener al menos 2 caracteres' });
  }

  if (q.length > 100) {
    return res.status(400).json({ message: 'Query no puede exceder 100 caracteres' });
  }

  next();
};

const sanitizeInput = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  next();
};

module.exports = {
  validateRegister,
  validateCreatePost,
  validateCreateReply,
  validateUpdatePassword,
  validateSearchQuery,
  sanitizeInput
};
