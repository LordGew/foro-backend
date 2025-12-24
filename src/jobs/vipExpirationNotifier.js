const cron = require('node-cron');
const User = require('../models/User');
const Notification = require('../models/Notification');

const startVipExpirationNotifier = () => {
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('🔔 Ejecutando verificación de expiración VIP...');
      
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const expiringUsers = await User.find({
        vip: true,
        vipExpiresAt: { 
          $ne: null,
          $lte: sevenDaysFromNow, 
          $gte: new Date() 
        }
      }).select('_id username email vipExpiresAt');
      
      console.log(`📊 Encontrados ${expiringUsers.length} usuarios con VIP por expirar`);
      
      for (const user of expiringUsers) {
        const daysRemaining = Math.ceil((user.vipExpiresAt - new Date()) / (1000 * 60 * 60 * 24));
        
        const existingNotification = await Notification.findOne({
          user: user._id,
          type: 'vip_expiration',
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        
        if (!existingNotification) {
          await Notification.create({
            user: user._id,
            message: `⚠️ Tu membresía VIP expira en ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}. ¡Renueva ahora para mantener tus beneficios!`,
            type: 'vip_expiration',
            link: '/profile'
          });
          
          console.log(`✅ Notificación enviada a ${user.username} (${daysRemaining} días restantes)`);
        }
      }
      
      const expiredUsers = await User.find({
        vip: true,
        vipExpiresAt: { 
          $ne: null,
          $lt: new Date() 
        }
      });
      
      for (const user of expiredUsers) {
        user.vip = false;
        user.vipTier = 'none';
        await user.save();
        
        await Notification.create({
          user: user._id,
          message: '❌ Tu membresía VIP ha expirado. Renueva para recuperar tus beneficios exclusivos.',
          type: 'vip_expired',
          link: '/profile'
        });
        
        console.log(`⏰ VIP expirado para ${user.username}`);
      }
      
      console.log(`✅ Verificación de expiración VIP completada. ${expiringUsers.length} notificaciones enviadas, ${expiredUsers.length} VIP expirados.`);
    } catch (error) {
      console.error('❌ Error en verificación de expiración VIP:', error);
    }
  });
  
  console.log('✅ Cron job de expiración VIP iniciado (ejecuta diariamente a las 9 AM)');
};

module.exports = { startVipExpirationNotifier };
