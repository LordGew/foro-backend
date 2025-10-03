const Category = require('../models/Category');

const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const category = new Category({ name });
    await category.save();
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const category = await Category.findByIdAndUpdate(req.params.id, { name }, { new: true });
    res.json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔥 Nuevo: Obtener una sola categoría por ID
//const getCategoryById = async (req, res) => {
  //try {
   // const category = await Category.findById(req.params.id);
   // if (!category) {
    //  return res.status(404).json({ message: 'Categoría no encontrada' });
   // }
   // res.json(category);
 // } catch (err) {
   // res.status(500).json({ message: err.message });
 // }
//};
// Obtener categoría por ID o slug
const getCategoryByParam = async (req, res) => {
  try {
    const param = req.params.param;
    console.log('Procesando categoría por param:', param); // Depuración

    let category;
    if (mongoose.Types.ObjectId.isValid(param)) {
      // Si es un ID válido, buscar por ID
      category = await Category.findById(param);
    } else {
      // Si no, buscar por slug
      category = await Category.findOne({ slug: param });
    }

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    res.json(category);
  } catch (err) {
    console.error('Error al obtener categoría por param:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};


module.exports = { createCategory, getCategories, updateCategory, deleteCategory, getCategoryByParam };