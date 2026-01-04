/**
 * 🍪 Controlador de Gestión de Cookies y Política de Privacidad
 */

const { getCookieCategories, getDefaultPreferences } = require('../middlewares/cookieMiddleware');

/**
 * Obtener la página de política de cookies
 */
exports.getCookiePolicy = async (req, res) => {
  try {
    const categories = getCookieCategories();
    
    res.json({
      title: 'Política de Cookies',
      lastUpdated: new Date().toISOString(),
      version: '1.0',
      categories,
      sections: {
        introduction: {
          title: '¿Qué son las cookies?',
          content: 'Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas un sitio web. Nos ayudan a mejorar tu experiencia y a proporcionar funcionalidades personalizadas.'
        },
        purpose: {
          title: '¿Para qué usamos cookies?',
          content: 'Utilizamos cookies para mantener tu sesión activa, recordar tus preferencias, analizar el tráfico del sitio y mostrar contenido relevante.'
        },
        management: {
          title: '¿Cómo gestionar tus preferencias?',
          content: 'Puedes aceptar o rechazar diferentes tipos de cookies a través de nuestro panel de configuración. También puedes gestionar las cookies directamente en tu navegador.'
        },
        rights: {
          title: 'Tus derechos',
          content: 'Tienes derecho a retirar tu consentimiento en cualquier momento, eliminar cookies almacenadas y solicitar información sobre los datos que recopilamos.'
        },
        contact: {
          title: 'Contacto',
          content: 'Para cualquier pregunta sobre nuestra política de cookies, puedes contactarnos en privacy@wow-community.com'
        }
      },
      technicalInfo: {
        cookieTypes: Object.keys(categories),
        storageDuration: {
          essential: '24 horas',
          functional: '30 días',
          analytics: '1 año',
          marketing: '90 días'
        },
        thirdPartyCookies: [
          {
            name: 'Google Analytics',
            purpose: 'Análisis de tráfico',
            link: 'https://policies.google.com/privacy'
          },
          {
            name: 'Cloudflare',
            purpose: 'Seguridad y rendimiento',
            link: 'https://www.cloudflare.com/privacypolicy/'
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error getting cookie policy:', error);
    res.status(500).json({ message: 'Error al obtener política de cookies' });
  }
};

/**
 * Guardar preferencias de cookies del usuario
 */
exports.saveCookiePreferences = async (req, res) => {
  try {
    const { preferences } = req.body;
    
    // Validar que las preferencias tengan el formato correcto
    const validPreferences = {};
    const defaultPrefs = getDefaultPreferences();
    
    Object.keys(defaultPrefs).forEach(key => {
      validPreferences[key] = preferences[key] === true;
    });
    
    // Las cookies esenciales siempre deben estar activadas
    validPreferences.essential = true;
    
    // Establecer cookies de consentimiento
    res.setCookieConsent(validPreferences);
    
    res.json({
      message: 'Preferencias de cookies guardadas correctamente',
      preferences: validPreferences,
      consentDate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving cookie preferences:', error);
    res.status(500).json({ message: 'Error al guardar preferencias de cookies' });
  }
};

/**
 * Obtener preferencias actuales de cookies
 */
exports.getCookiePreferences = async (req, res) => {
  try {
    res.json({
      hasConsent: req.cookieConsent.hasConsent,
      consentDate: req.cookieConsent.consentDate,
      preferences: req.cookieConsent.preferences,
      canChangePreferences: true
    });
  } catch (error) {
    console.error('Error getting cookie preferences:', error);
    res.status(500).json({ message: 'Error al obtener preferencias de cookies' });
  }
};

/**
 * Retirar consentimiento de cookies
 */
exports.withdrawCookieConsent = async (req, res) => {
  try {
    // Eliminar todas las cookies no esenciales
    const cookieTypes = ['functional', 'analytics', 'marketing'];
    
    cookieTypes.forEach(type => {
      res.clearCookie(`cookie-${type}`);
      res.clearCookie(`${type}_data`);
    });
    
    // Eliminar cookies de consentimiento
    res.clearCookie('cookie-consent');
    res.clearCookie('cookie-preferences');
    
    res.json({
      message: 'Consentimiento de cookies retirado correctamente',
      action: 'withdrawn',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error withdrawing cookie consent:', error);
    res.status(500).json({ message: 'Error al retirar consentimiento de cookies' });
  }
};

/**
 * Obtener detalles de las cookies utilizadas
 */
exports.getCookieDetails = async (req, res) => {
  try {
    const categories = getCookieCategories();
    
    res.json({
      cookies: {
        'cookie-consent': {
          type: 'essential',
          purpose: 'Almacenar fecha de consentimiento de cookies',
          duration: '24 horas',
          essential: true
        },
        'cookie-preferences': {
          type: 'essential',
          purpose: 'Almacenar preferencias de cookies del usuario',
          duration: '24 horas',
          essential: true
        },
        'connect.sid': {
          type: 'essential',
          purpose: 'Mantener sesión de usuario autenticado',
          duration: '24 horas',
          essential: true
        },
        'user_preferences': {
          type: 'functional',
          purpose: 'Recordar preferencias de visualización y configuración',
          duration: '30 días',
          essential: false
        },
        'analytics_data': {
          type: 'analytics',
          purpose: 'Recopilar datos de uso de forma anónima',
          duration: '1 año',
          essential: false
        },
        'marketing_consent': {
          type: 'marketing',
          purpose: 'Personalizar contenido publicitario',
          duration: '90 días',
          essential: false
        }
      },
      categories,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting cookie details:', error);
    res.status(500).json({ message: 'Error al obtener detalles de cookies' });
  }
};

/**
 * Actualizar preferencias específicas de cookies
 */
exports.updateCookiePreferences = async (req, res) => {
  try {
    const { type, enabled } = req.body;
    
    // Validar tipo de cookie
    const validTypes = ['essential', 'functional', 'analytics', 'marketing'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Tipo de cookie inválido' });
    }
    
    // Las cookies esenciales no se pueden desactivar
    if (type === 'essential' && !enabled) {
      return res.status(400).json({ message: 'Las cookies esenciales no se pueden desactivar' });
    }
    
    // Obtener preferencias actuales
    const currentPreferences = { ...req.cookieConsent.preferences };
    currentPreferences[type] = enabled;
    
    // Guardar nuevas preferencias
    res.setCookieConsent(currentPreferences);
    
    res.json({
      message: `Preferencias de cookies ${type} actualizadas correctamente`,
      type,
      enabled,
      allPreferences: currentPreferences,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating cookie preferences:', error);
    res.status(500).json({ message: 'Error al actualizar preferencias de cookies' });
  }
};

/**
 * Obtener resumen de privacidad
 */
exports.getPrivacySummary = async (req, res) => {
  try {
    res.json({
      title: 'Resumen de Privacidad y Cookies',
      lastUpdated: new Date().toISOString(),
      sections: {
        dataCollection: {
          title: 'Recopilación de Datos',
          items: [
            'Datos de sesión y autenticación',
            'Preferencias de usuario',
            'Estadísticas de uso anónimas',
            'Datos de interacción con el contenido'
          ]
        },
        cookieUsage: {
          title: 'Uso de Cookies',
          items: [
            'Mantener sesión activa',
            'Personalizar experiencia',
            'Analizar tráfico del sitio',
            'Mejorar servicios'
          ]
        },
        userRights: {
          title: 'Tus Derechos',
          items: [
            'Acceder a tus datos',
            'Corregir información incorrecta',
            'Eliminar tus datos',
            'Retirar consentimiento',
            'Portabilidad de datos'
          ]
        },
        security: {
          title: 'Seguridad',
          items: [
            'Encriptación de datos',
            'Protección contra accesos no autorizados',
            'Actualizaciones de seguridad regulares',
            'Cumplimiento GDPR'
          ]
        }
      },
      contact: {
        email: 'privacy@wow-community.com',
        responseTime: '48 horas',
        gdprCompliant: true
      }
    });
  } catch (error) {
    console.error('Error getting privacy summary:', error);
    res.status(500).json({ message: 'Error al obtener resumen de privacidad' });
  }
};
