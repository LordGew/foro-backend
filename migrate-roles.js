// migrate-roles.js
// Script para migrar roles antiguos a nuevos valores
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

const migrateRoles = async () => {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Mapeo de roles antiguos a nuevos
    const roleMapping = {
      'user': 'Player',
      'moderator': 'GameMaster',
      'admin': 'Admin'
    };

    console.log('\n📊 Verificando usuarios con roles antiguos...\n');

    for (const [oldRole, newRole] of Object.entries(roleMapping)) {
      const count = await usersCollection.countDocuments({ role: oldRole });
      
      if (count > 0) {
        console.log(`🔄 Migrando ${count} usuarios de '${oldRole}' a '${newRole}'...`);
        
        const result = await usersCollection.updateMany(
          { role: oldRole },
          { $set: { role: newRole } }
        );
        
        console.log(`✅ Migrados: ${result.modifiedCount} usuarios`);
      } else {
        console.log(`ℹ️  No hay usuarios con rol '${oldRole}'`);
      }
    }

    // Verificar usuarios con roles no válidos
    const invalidUsers = await usersCollection.find({
      role: { $nin: ['Player', 'GameMaster', 'Admin'] }
    }).toArray();

    if (invalidUsers.length > 0) {
      console.log(`\n⚠️  Encontrados ${invalidUsers.length} usuarios con roles inválidos:`);
      invalidUsers.forEach(user => {
        console.log(`   - ${user.username} (${user.email}): role = '${user.role}'`);
      });
      
      console.log('\n🔄 Corrigiendo usuarios con roles inválidos a "Player"...');
      const fixResult = await usersCollection.updateMany(
        { role: { $nin: ['Player', 'GameMaster', 'Admin'] } },
        { $set: { role: 'Player' } }
      );
      console.log(`✅ Corregidos: ${fixResult.modifiedCount} usuarios`);
    }

    // Resumen final
    console.log('\n📊 Resumen de roles en la base de datos:');
    const playerCount = await usersCollection.countDocuments({ role: 'Player' });
    const gmCount = await usersCollection.countDocuments({ role: 'GameMaster' });
    const adminCount = await usersCollection.countDocuments({ role: 'Admin' });
    
    console.log(`   👤 Players: ${playerCount}`);
    console.log(`   🎮 GameMasters: ${gmCount}`);
    console.log(`   👑 Admins: ${adminCount}`);
    console.log(`   📈 Total: ${playerCount + gmCount + adminCount}`);

    console.log('\n✅ Migración completada exitosamente\n');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error en migración:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

migrateRoles();
