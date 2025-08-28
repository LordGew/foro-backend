const Banner = require('../models/Banner');

const createBanner = async (req, res) => {
  try {
    const { location, link_url, alt_text, order_index, active } = req.body;

    // Validar location
    if (!['sidebar', 'central'].includes(location)) {
      return res.status(400).json({ message: 'Invalid location' });
    }

    // ✅ Ahora image_url siempre existe gracias al middleware
    const image_url = `/uploads/${req.file.filename}`;

    const banner = new Banner({
      location,
      image_url,
      link_url,
      alt_text,
      order_index,
      active
    });

    await banner.save();
    res.status(201).json(banner);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getBanners = async (req, res) => {
  try {
    const banners = await Banner.find({ location: req.params.location, active: true }).sort({ order_index: 1 });
    res.json(banners);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateBanner = async (req, res) => {
  try {
    const updates = req.body;
    if (req.file) updates.image_url = req.file.location;
    const banner = await Banner.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(banner);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteBanner = async (req, res) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    res.json({ message: 'Banner deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const reorderBanners = async (req, res) => {
  try {
    const { banners } = req.body; // Array de {id, order_index}
    await Promise.all(banners.map(b => Banner.findByIdAndUpdate(b.id, { order_index: b.order_index })));
    res.json({ message: 'Banners reordered' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createBanner, getBanners, updateBanner, deleteBanner, reorderBanners };