module.exports = {
  // Generar string aleatorio para emails y usernames únicos
  randomString: function(context, events, done) {
    context.vars.randomString = Math.random().toString(36).substring(2, 15);
    return done();
  },

  // Generar ID de categoría aleatorio
  randomCategoryId: function(context, events, done) {
    const categoryIds = [
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439012',
      '507f1f77bcf86cd799439013'
    ];
    context.vars.categoryId = categoryIds[Math.floor(Math.random() * categoryIds.length)];
    return done();
  },

  // Logging personalizado para debugging
  logResponse: function(requestParams, response, context, ee, next) {
    console.log(`Status: ${response.statusCode}, URL: ${requestParams.url}`);
    return next();
  },

  // Validar respuesta exitosa
  validateResponse: function(requestParams, response, context, ee, next) {
    if (response.statusCode >= 400) {
      console.error(`Error ${response.statusCode} en ${requestParams.url}`);
    }
    return next();
  }
};
