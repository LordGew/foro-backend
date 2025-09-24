const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Configurar variables de entorno
dotenv.config();

// Conectar a la base de datos CORREGIDA: wow-creador
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wow-creador', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Importar el modelo Banner
const Banner = require('./src/models/Banner');

async function fixBannerPaths() {
  try {
    console.log('Conectando a la base de datos wow-creador...');
    
    // Esperar a que la conexión se establezca
    await mongoose.connection.once('open', () => {
      console.log('Conectado a MongoDB - Base de datos:', mongoose.connection.name);
    });

    console.log('Buscando banners con rutas antiguas...');
    
    // Buscar todos los banners
    const banners = await Banner.find({});
    console.log(`Encontrados ${banners.length} banners en total`);

    let updatedCount = 0;
    
    for (const banner of banners) {
      const oldUrl = banner.image_url;
      
      // Verificar si la URL contiene "wow-forum"
      if (oldUrl && oldUrl.includes('wow-forum')) {
        // Extraer solo el nombre del archivo
        const fileName = oldUrl.substring(oldUrl.lastIndexOf('/') + 1);
        const newUrl = `/uploads/banners/${fileName}`;
        
        console.log(`Actualizando: ${oldUrl} -> ${newUrl}`);
        
        // Actualizar la ruta en la base de datos
        banner.image_url = newUrl;
        await banner.save();
        updatedCount++;
      }
    }

    console.log(`¡Proceso completado! ${updatedCount} banners actualizados.`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Manejar errores de conexión
mongoose.connection.on('error', (err) => {
  console.error('Error de conexión a MongoDB:', err);
  process.exit(1);
});

// Ejecutar la función
fixBannerPaths();