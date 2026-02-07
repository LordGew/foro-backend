const Banner = require('../models/Banner');
const fs = require('fs');
const path = require('path');

// Crear banner - Versión para Cloudinary
const createBanner = async (req, res) => {
  try {
    const { location, link_url, alt_text, order_index, display_duration, remaining_shows } = req.body;
    
    // Esta validación ya la hace uploadSingleImage, pero por si acaso
    if (!req.file) {
      return res.status(400).json({ message: 'Se requiere una imagen' });
    }
    // Cloudinary devuelve la URL en req.file.path
    const image_url = req.file.path;
    const banner = new Banner({
      location,
      image_url,
      link_url: link_url || '',
      alt_text: alt_text || '',
      order_index: order_index || 0,
      display_duration: display_duration || 3,
      remaining_shows: remaining_shows || -1,
      active: true
    });

    await banner.save();
    res.status(201).json(banner);
  } catch (error) {
    console.error('Error creando banner:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// Actualizar banner para Cloudinary
const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Si se subió una nueva imagen, usar la URL de Cloudinary
    if (req.file) {
      updateData.image_url = req.file.path;
      // NOTA: Con Cloudinary no necesitas eliminar la imagen anterior manualmente
      // Cloudinary maneja el almacenamiento automáticamente
    }

    const banner = await Banner.findByIdAndUpdate(id, updateData, { new: true });
    
    if (!banner) {
      return res.status(404).json({ message: 'Banner no encontrado' });
    }

    res.json(banner);
  } catch (error) {
    console.error('Error actualizando banner:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// Obtener banners por ubicación
const getBanners = async (req, res) => {
  try {
    const { location } = req.query;
    
    if (!location) {
      return res.status(400).json({ message: 'Parámetro location requerido' });
    }

    const banners = await Banner.find({ 
      location, 
      active: true,
      $or: [
        { remaining_shows: -1 },
        { remaining_shows: { $gt: 0 } }
      ]
    }).sort({ order_index: 1 });

    res.json(banners);
  } catch (error) {
    console.error('Error obteniendo banners:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// Actualizar banner

// Eliminar banner
const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findById(id);
    
    if (!banner) {
      return res.status(404).json({ message: 'Banner no encontrado' });
    }

    // Eliminar la imagen del sistema de archivos
    if (banner.image_url) {
      const imagePath = path.join(__dirname, '..', 'public', banner.image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Banner.findByIdAndDelete(id);
    res.json({ message: 'Banner eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando banner:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// Reordenar banners
const reorderBanners = async (req, res) => {
  try {
    const { banners } = req.body;
    
    for (const item of banners) {
      await Banner.findByIdAndUpdate(item.id, { order_index: item.order_index });
    }

    res.json({ message: 'Banners reordenados correctamente' });
  } catch (error) {
    console.error('Error reordenando banners:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// Registrar visualización de banner
const recordView = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findById(id);
    
    if (!banner) {
      return res.status(404).json({ message: 'Banner no encontrado' });
    }

    // Decrementar el contador de visualizaciones si no es ilimitado
    if (banner.remaining_shows > 0) {
      banner.remaining_shows -= 1;
      
      // Desactivar banner si ya no quedan visualizaciones
      if (banner.remaining_shows === 0) {
        banner.active = false;
      }
      
      await banner.save();
    }

    res.json({ message: 'Visualización registrada' });
  } catch (error) {
    console.error('Error registrando visualización:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// Establecer duración de visualización
const setDuration = async (req, res) => {
  try {
    const { id } = req.params;
    const { display_duration } = req.body;
    
    if (!display_duration || display_duration <= 0) {
      return res.status(400).json({ message: 'Duración inválida' });
    }

    const banner = await Banner.findByIdAndUpdate(
      id, 
      { display_duration }, 
      { new: true }
    );
    
    if (!banner) {
      return res.status(404).json({ message: 'Banner no encontrado' });
    }

    res.json(banner);
  } catch (error) {
    console.error('Error estableciendo duración:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// Establecer remaining shows
const setRemaining = async (req, res) => {
  try {
    const { id } = req.params;
    const { remaining_shows } = req.body;
    
    if (remaining_shows === undefined || remaining_shows < -1) {
      return res.status(400).json({ message: 'Valor de remaining inválido' });
    }

    const updateData = { 
      remaining_shows,
      active: remaining_shows !== 0
    };

    const banner = await Banner.findByIdAndUpdate(id, updateData, { new: true });
    
    if (!banner) {
      return res.status(404).json({ message: 'Banner no encontrado' });
    }

    res.json(banner);
  } catch (error) {
    console.error('Error estableciendo remaining:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

// Actualizar configuración de texto del banner
const updateTextConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      text, text_position, text_color, text_font_size,
      text_font_weight, text_background_color, text_opacity,
      text_padding, text_border_radius
    } = req.body;

    const updateData = {};
    if (text !== undefined) updateData.text = text;
    if (text_position !== undefined) updateData.text_position = text_position;
    if (text_color !== undefined) updateData.text_color = text_color;
    if (text_font_size !== undefined) updateData.text_font_size = text_font_size;
    if (text_font_weight !== undefined) updateData.text_font_weight = text_font_weight;
    if (text_background_color !== undefined) updateData.text_background_color = text_background_color;
    if (text_opacity !== undefined) updateData.text_opacity = text_opacity;
    if (text_padding !== undefined) updateData.text_padding = text_padding;
    if (text_border_radius !== undefined) updateData.text_border_radius = text_border_radius;

    const banner = await Banner.findByIdAndUpdate(id, updateData, { new: true });

    if (!banner) {
      return res.status(404).json({ message: 'Banner no encontrado' });
    }

    res.json(banner);
  } catch (error) {
    console.error('Error actualizando texto del banner:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

module.exports = {
  createBanner,
  getBanners,
  updateBanner,
  deleteBanner,
  reorderBanners,
  recordView,
  setDuration,
  setRemaining,
  updateTextConfig
};