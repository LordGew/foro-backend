const mongoose = require('mongoose');
require('dotenv').config();

const achievementSchema = new mongoose.Schema({
  name: String,
  requirement: {
    type: String,
    value: Number
  }
}, { collection: 'achievements' });

const Achievement = mongoose.model('Achievement', achievementSchema);

async function updateAchievementsXP() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');
    
    const levelUpdates = [
      { name: 'Primer Paso', xp: 10 },
      { name: 'Explorador Curioso', xp: 40 },
      { name: 'Aventurero Novato', xp: 160 },
      { name: 'Cazador Hábil', xp: 360 },
      { name: 'Guerrero Experimentado', xp: 810 },
      { name: 'Campeón Valiente', xp: 1960 },
      { name: 'Héroe de Azeroth', xp: 3610 },
      { name: 'Señor de la Guerra', xp: 5760 },
      { name: 'Leyenda Viviente', xp: 8410 },
      { name: 'Titán de Azeroth', xp: 15210 },
      { name: 'Dios de la Guerra', xp: 24010 }
    ];
    
    console.log('🔄 Actualizando logros de nivel...');
    
    for (const update of levelUpdates) {
      const result = await Achievement.updateOne(
        { name: update.name },
        { $set: { 'requirement.value': update.xp } }
      );
      
      if (result.matchedCount > 0) {
        console.log(`  ✅ ${update.name}: ${update.xp} XP ${result.modifiedCount > 0 ? '(actualizado)' : '(ya correcto)'}`);
      } else {
        console.log(`  ⚠️  ${update.name}: No encontrado`);
      }
    }
    
    console.log('\n✅ Actualización completada');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateAchievementsXP();
