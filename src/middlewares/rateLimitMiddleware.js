const { RateLimiterMemory } = require('rate-limiter-flexible');

const isProduction = process.env.NODE_ENV === 'production';

const generalLimiter = new RateLimiterMemory({
  points: isProduction ? 50 : 100,
  duration: 60,
});

const postLimiter = new RateLimiterMemory({
  points: isProduction ? 5 : 20,
  duration: 60,
});

const replyLimiter = new RateLimiterMemory({
  points: isProduction ? 10 : 30,
  duration: 60,
});

const loginLimiter = new RateLimiterMemory({
  points: 5,
  duration: 300,
});

const rateLimitGeneral = async (req, res, next) => {
  try {
    await generalLimiter.consume(req.ip);
    next();
  } catch (err) {
    res.status(429).json({ 
      message: 'Demasiadas solicitudes. Por favor, intenta más tarde.',
      retryAfter: Math.ceil(err.msBeforeNext / 1000)
    });
  }
};

const rateLimitPosts = async (req, res, next) => {
  try {
    const key = req.user?.userId || req.ip;
    await postLimiter.consume(key);
    next();
  } catch (err) {
    res.status(429).json({ 
      message: 'Límite de creación de posts alcanzado. Espera un momento.',
      retryAfter: Math.ceil(err.msBeforeNext / 1000)
    });
  }
};

const rateLimitReplies = async (req, res, next) => {
  try {
    const key = req.user?.userId || req.ip;
    await replyLimiter.consume(key);
    next();
  } catch (err) {
    res.status(429).json({ 
      message: 'Límite de respuestas alcanzado. Espera un momento.',
      retryAfter: Math.ceil(err.msBeforeNext / 1000)
    });
  }
};

const rateLimitLogin = async (req, res, next) => {
  try {
    await loginLimiter.consume(req.ip);
    next();
  } catch (err) {
    res.status(429).json({ 
      message: 'Demasiados intentos de inicio de sesión. Intenta en 5 minutos.',
      retryAfter: Math.ceil(err.msBeforeNext / 1000)
    });
  }
};

module.exports = {
  rateLimitGeneral,
  rateLimitPosts,
  rateLimitReplies,
  rateLimitLogin
};
