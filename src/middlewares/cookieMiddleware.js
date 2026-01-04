/**
 * 🍪 Middleware de Gestión de Cookies y Sesiones
 * 
 * Este middleware maneja:
 * - Consentimiento de cookies
 * - Mensajes informativos de cookies
 * - Gestión de preferencias de privacidad
 * - Almacenamiento de sesión segura
 */

const cookie = require('cookie');

// Configuración de tipos de cookies
const COOKIE_TYPES = {
  ESSENTIAL: 'essential',     // Cookies esenciales (sesión, seguridad)
  FUNCTIONAL: 'functional',   // Cookies funcionales (preferencias, personalización)
  ANALYTICS: 'analytics',     // Cookies de análisis (estadísticas)
  MARKETING: 'marketing'      // Cookies de marketing (publicidad)
};

// Configuración por defecto de cookies
const DEFAULT_COOKIE_CONFIG = {
  essential: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  },
  functional: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 días
  },
  analytics: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000 // 1 año
  },
  marketing: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 90 * 24 * 60 * 60 * 1000 // 90 días
  }
};

/**
 * Middleware principal de gestión de cookies
 */
const cookieMiddleware = (req, res, next) => {
  // Inicializar objeto de cookies en la solicitud
  req.cookies = req.cookies || {};
  req.signedCookies = req.signedCookies || {};

  // Parsear cookies de la solicitud
  if (req.headers.cookie) {
    req.cookies = cookie.parse(req.headers.cookie);
  }

  // Obtener consentimiento de cookies
  const cookieConsent = req.cookies['cookie-consent'];
  const cookiePreferences = req.cookies['cookie-preferences'];

  // Estado del consentimiento
  req.cookieConsent = {
    hasConsent: !!cookieConsent,
    consentDate: cookieConsent ? new Date(cookieConsent) : null,
    preferences: cookiePreferences ? JSON.parse(cookiePreferences) : getDefaultPreferences(),
    hasGivenConsent: (type) => {
      if (!cookieConsent) return false;
      const prefs = cookiePreferences ? JSON.parse(cookiePreferences) : getDefaultPreferences();
      return prefs[type] === true;
    }
  };

  // Función para establecer cookies con consentimiento
  res.setCookie = (name, value, options = {}) => {
    const type = options.type || COOKIE_TYPES.ESSENTIAL;
    
    // Verificar consentimiento para cookies no esenciales
    if (type !== COOKIE_TYPES.ESSENTIAL && !req.cookieConsent.hasGivenConsent(type)) {
      return false;
    }

    const config = { ...DEFAULT_COOKIE_CONFIG[type], ...options };
    const cookieString = cookie.serialize(name, value, config);
    
    res.setHeader('Set-Cookie', cookieString);
    return true;
  };

  // Función para eliminar cookies
  res.clearCookie = (name, options = {}) => {
    const config = { ...options, maxAge: 0 };
    const cookieString = cookie.serialize(name, '', config);
    res.setHeader('Set-Cookie', cookieString);
  };

  // Función para establecer consentimiento
  res.setCookieConsent = (preferences) => {
    const consentDate = new Date().toISOString();
    const preferencesJSON = JSON.stringify(preferences);
    
    res.setCookie('cookie-consent', consentDate, { type: COOKIE_TYPES.ESSENTIAL });
    res.setCookie('cookie-preferences', preferencesJSON, { type: COOKIE_TYPES.ESSENTIAL });
    
    req.cookieConsent.hasConsent = true;
    req.cookieConsent.consentDate = consentDate;
    req.cookieConsent.preferences = preferences;
  };

  next();
};

/**
 * Obtener preferencias por defecto
 */
const getDefaultPreferences = () => ({
  [COOKIE_TYPES.ESSENTIAL]: true,    // Siempre aceptadas
  [COOKIE_TYPES.FUNCTIONAL]: false,  // Por defecto no aceptadas
  [COOKIE_TYPES.ANALYTICS]: false,   // Por defecto no aceptadas
  [COOKIE_TYPES.MARKETING]: false    // Por defecto no aceptadas
});

/**
 * Middleware para verificar consentimiento específico
 */
const requireCookieConsent = (type) => {
  return (req, res, next) => {
    if (!req.cookieConsent.hasGivenConsent(type)) {
      return res.status(403).json({
        message: 'Se requiere consentimiento de cookies para esta funcionalidad',
        requiresConsent: true,
        cookieType: type
      });
    }
    next();
  };
};

/**
 * Middleware para mensajes informativos de cookies
 */
const cookieMessageMiddleware = (req, res, next) => {
  // Verificar si se debe mostrar mensaje de cookies
  const shouldShowCookieMessage = !req.cookieConsent.hasConsent;
  
  // Agregar información de cookies al contexto
  res.locals.cookieMessage = {
    show: shouldShowCookieMessage,
    consentRequired: true,
    preferences: req.cookieConsent.preferences
  };

  next();
};

/**
 * Middleware para sesión segura con cookies
 */
const secureSessionMiddleware = (req, res, next) => {
  // Configurar sesión segura
  if (req.session) {
    req.session.cookie.secure = process.env.NODE_ENV === 'production';
    req.session.cookie.httpOnly = true;
    req.session.cookie.sameSite = process.env.NODE_ENV === 'production' ? 'strict' : 'lax';
    req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 horas
  }

  next();
};

/**
 * Función para obtener categorías de cookies con descripciones
 */
const getCookieCategories = () => ({
  [COOKIE_TYPES.ESSENTIAL]: {
    name: 'Cookies Esenciales',
    description: 'Son cookies necesarias para el funcionamiento básico del sitio web, incluyendo la gestión de sesiones y la seguridad.',
    required: true,
    examples: ['Sesión de usuario', 'Token de autenticación', 'CSRF protection']
  },
  [COOKIE_TYPES.FUNCTIONAL]: {
    name: 'Cookies Funcionales',
    description: 'Permiten recordar las preferencias del usuario para proporcionar una experiencia personalizada.',
    required: false,
    examples: ['Idioma preferido', 'Tema oscuro/claro', 'Configuración de visualización']
  },
  [COOKIE_TYPES.ANALYTICS]: {
    name: 'Cookies de Análisis',
    description: 'Nos ayudan a entender cómo los visitantes interactúan con nuestro sitio web recopilando información de forma anónima.',
    required: false,
    examples: ['Google Analytics', 'Estadísticas de uso', 'Tiempo en página']
  },
  [COOKIE_TYPES.MARKETING]: {
    name: 'Cookies de Marketing',
    description: 'Se utilizan para mostrar publicidad relevante para el usuario basada en sus intereses.',
    required: false,
    examples: ['Google Ads', 'Facebook Pixel', 'Retargeting']
  }
});

module.exports = {
  cookieMiddleware,
  cookieMessageMiddleware,
  secureSessionMiddleware,
  requireCookieConsent,
  COOKIE_TYPES,
  getCookieCategories,
  getDefaultPreferences
};
