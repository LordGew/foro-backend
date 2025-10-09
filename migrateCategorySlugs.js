require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./src/models/Category');
const slugify = require('slugify');

const migrateSlugs = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb+srv://wiggles:5NHMNxzxsQBVgQ2D@my-wow-co.veztxhf.mongodb.net/?retryWrites=true&w=majority&appName=my-wow-co';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Conectado a la base de datos:', mongoUri);

    const categories = await Category.find();
    let updatedCount = 0;

    for (const category of categories) {
      if (!category.slug) {
        let slug = slugify(category.name, { lower: true, strict: true });
        let suffix = 1;
        let uniqueSlug = slug;

        // Verificar si el slug ya existe, excluyendo la categoría actual
        let existing = await Category.findOne({ slug: uniqueSlug });
        if (existing && existing._id.toString() !== category._id.toString()) {
          console.log(`Slug duplicado encontrado: ${uniqueSlug} para categoría ${category.name}, generando alternativo`);
          uniqueSlug = `${slug}-${suffix}`;
          suffix++;
          while (await Category.findOne({ slug: uniqueSlug })) {
            uniqueSlug = `${slug}-${suffix}`;
            suffix++;
          }
        }

        category.slug = uniqueSlug;
        await category.save();
        console.log(`Slug generado para categoría: ${category.name} -> ${category.slug}`);
        updatedCount++;
      }
    }

    console.log(`Migración completada. ${updatedCount} categorías actualizadas.`);
    mongoose.connection.close();
  } catch (err) {
    console.error('Error en la migración:', err);
    mongoose.connection.close();
    process.exit(1);
  }
};

migrateSlugs();