const VipReward = require('../models/VipReward');
const RewardItem = require('../models/RewardItem');
const Badge = require('../models/Badge');
const User = require('../models/User');
const { allVipRewards } = require('../data/vip-rewards-data');

/**
 * Seed VIP rewards into the database.
 * Creates RewardItem/Badge entries and links them to VipReward records.
 * Idempotent - skips existing rewards.
 */
const seedVipRewards = async (req, res) => {
  try {
    let created = 0;
    let skipped = 0;

    for (const data of allVipRewards) {
      const existing = await VipReward.findOne({ name: data.name });
      if (existing) {
        skipped++;
        continue;
      }

      let rewardItemId = null;
      let badgeId = null;

      if (data.type === 'badge') {
        // Create a Badge entry
        let badge = await Badge.findOne({ name: data.name });
        if (!badge) {
          badge = new Badge({
            name: data.name,
            description: data.description,
            icon: data.icon,
            category: 'special',
            rarity: data.rarity === 'rare' ? 'rare' : data.rarity === 'epic' ? 'epic' : 'legendary',
            price: 0,
            requiredLevel: 1,
            stock: -1,
            available: true,
            displayOrder: data.displayOrder
          });
          await badge.save();
        }
        badgeId = badge._id;
      } else {
        // Create a RewardItem entry (theme, frame, title)
        let rewardItem = await RewardItem.findOne({ name: data.name });
        if (!rewardItem) {
          rewardItem = new RewardItem({
            name: data.name,
            description: data.description,
            type: data.type,
            content: data.content,
            rarity: data.rarity,
            cost: 0,
            isActive: true,
            iconHtml: data.icon
          });
          await rewardItem.save();
        }
        rewardItemId = rewardItem._id;
      }

      const vipReward = new VipReward({
        name: data.name,
        description: data.description,
        type: data.type,
        content: data.content,
        icon: data.icon,
        rarity: data.rarity,
        requiredTier: data.requiredTier,
        requiredMonths: data.requiredMonths,
        rewardItemId,
        badgeId,
        displayOrder: data.displayOrder,
        isActive: true
      });
      await vipReward.save();
      created++;
    }
    if (res) {
      return res.json({ message: `VIP Rewards: ${created} creadas, ${skipped} ya existían`, created, skipped });
    }
    return { created, skipped };
  } catch (err) {
    console.error('Error seeding VIP rewards:', err);
    if (res) {
      return res.status(500).json({ message: 'Error al crear recompensas VIP', error: err.message });
    }
    throw err;
  }
};

/**
 * Get all VIP rewards with unlock status for the current user.
 */
const getVipRewards = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    const rewards = await VipReward.find({ isActive: true })
      .populate('rewardItemId')
      .populate('badgeId')
      .sort({ type: 1, requiredTier: 1, displayOrder: 1 });

    let userMonths = 0;
    let isLifetime = false;
    let unlockedRewardIds = [];
    let unlockedBadgeIds = [];

    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        userMonths = user.vipMonthsAccumulated || 0;
        isLifetime = user.vipTier === 'lifetime';
        unlockedRewardIds = user.ownedRewards.map(r => r.rewardId?.toString());
        unlockedBadgeIds = (user.badges || []).map(b => b.toString());
      }
    }

    const rewardsWithStatus = rewards.map(reward => {
      const r = reward.toObject();
      
      // Check if unlocked based on months or lifetime
      let isUnlockable = false;
      if (isLifetime) {
        isUnlockable = true;
      } else if (r.requiredMonths === 0) {
        isUnlockable = isLifetime; // Tier 5 only for lifetime
      } else {
        isUnlockable = userMonths >= r.requiredMonths;
      }

      // Check if already owned
      let isOwned = false;
      if (r.type === 'badge' && r.badgeId) {
        isOwned = unlockedBadgeIds.includes(r.badgeId._id?.toString() || r.badgeId.toString());
      } else if (r.rewardItemId) {
        isOwned = unlockedRewardIds.includes(r.rewardItemId._id?.toString() || r.rewardItemId.toString());
      }

      return {
        ...r,
        isUnlockable,
        isOwned,
        userMonths,
        isLifetime
      };
    });

    // Group by type
    const grouped = {
      themes: rewardsWithStatus.filter(r => r.type === 'theme'),
      frames: rewardsWithStatus.filter(r => r.type === 'frame'),
      titles: rewardsWithStatus.filter(r => r.type === 'title'),
      badges: rewardsWithStatus.filter(r => r.type === 'badge'),
      userMonths,
      isLifetime
    };

    res.json(grouped);
  } catch (err) {
    console.error('Error getting VIP rewards:', err);
    res.status(500).json({ message: 'Error al obtener recompensas VIP', error: err.message });
  }
};

/**
 * Claim a VIP reward (add to user's ownedRewards or badges).
 */
const claimVipReward = async (req, res) => {
  try {
    const { rewardId } = req.params;
    const userId = req.user.userId;

    const vipReward = await VipReward.findById(rewardId);
    if (!vipReward || !vipReward.isActive) {
      return res.status(404).json({ message: 'Recompensa VIP no encontrada' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (!user.vip) {
      return res.status(403).json({ message: 'Necesitas ser VIP para reclamar recompensas' });
    }

    // Check tier eligibility
    const userMonths = user.vipMonthsAccumulated || 0;
    const isLifetime = user.vipTier === 'lifetime';

    let eligible = false;
    if (isLifetime) {
      eligible = true;
    } else if (vipReward.requiredMonths === 0) {
      eligible = isLifetime;
    } else {
      eligible = userMonths >= vipReward.requiredMonths;
    }

    if (!eligible) {
      return res.status(403).json({ 
        message: `Necesitas ${vipReward.requiredMonths} meses VIP acumulados para desbloquear esta recompensa`,
        required: vipReward.requiredMonths,
        current: userMonths
      });
    }

    if (vipReward.type === 'badge') {
      // Add badge
      if (!vipReward.badgeId) {
        return res.status(400).json({ message: 'Badge no configurado para esta recompensa' });
      }
      const alreadyHas = user.badges.some(b => b.toString() === vipReward.badgeId.toString());
      if (alreadyHas) {
        return res.status(400).json({ message: 'Ya posees esta insignia' });
      }
      user.badges.push(vipReward.badgeId);
      await user.save();

      const badge = await Badge.findById(vipReward.badgeId);
      return res.json({ 
        message: `Insignia "${vipReward.name}" desbloqueada`,
        badge,
        type: 'badge'
      });
    } else {
      // Add reward item (theme, frame, title)
      if (!vipReward.rewardItemId) {
        return res.status(400).json({ message: 'RewardItem no configurado para esta recompensa' });
      }
      const alreadyOwned = user.ownedRewards.some(r => r.rewardId?.toString() === vipReward.rewardItemId.toString());
      if (alreadyOwned) {
        return res.status(400).json({ message: 'Ya posees esta recompensa' });
      }
      user.ownedRewards.push({
        rewardId: vipReward.rewardItemId,
        purchasedAt: new Date()
      });
      await user.save();

      const rewardItem = await RewardItem.findById(vipReward.rewardItemId);
      return res.json({ 
        message: `Recompensa "${vipReward.name}" desbloqueada`,
        reward: rewardItem,
        type: vipReward.type
      });
    }
  } catch (err) {
    console.error('Error claiming VIP reward:', err);
    res.status(500).json({ message: 'Error al reclamar recompensa VIP', error: err.message });
  }
};

/**
 * Auto-unlock VIP rewards based on accumulated months.
 * Called internally when VIP is activated/renewed.
 */
const autoUnlockVipRewards = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.vip) return { unlocked: [] };

    const userMonths = user.vipMonthsAccumulated || 0;
    const isLifetime = user.vipTier === 'lifetime';

    const rewards = await VipReward.find({ isActive: true });
    const unlocked = [];

    for (const reward of rewards) {
      let eligible = false;
      if (isLifetime) {
        eligible = true;
      } else if (reward.requiredMonths === 0) {
        eligible = isLifetime;
      } else {
        eligible = userMonths >= reward.requiredMonths;
      }

      if (!eligible) continue;

      if (reward.type === 'badge' && reward.badgeId) {
        const alreadyHas = user.badges.some(b => b.toString() === reward.badgeId.toString());
        if (!alreadyHas) {
          user.badges.push(reward.badgeId);
          unlocked.push({ name: reward.name, type: 'badge' });
        }
      } else if (reward.rewardItemId) {
        const alreadyOwned = user.ownedRewards.some(r => r.rewardId?.toString() === reward.rewardItemId.toString());
        if (!alreadyOwned) {
          user.ownedRewards.push({
            rewardId: reward.rewardItemId,
            purchasedAt: new Date()
          });
          unlocked.push({ name: reward.name, type: reward.type });
        }
      }
    }

    if (unlocked.length > 0) {
      await user.save();
    }

    return { unlocked };
  } catch (err) {
    console.error('Error auto-unlocking VIP rewards:', err);
    return { unlocked: [], error: err.message };
  }
};

module.exports = {
  seedVipRewards,
  getVipRewards,
  claimVipReward,
  autoUnlockVipRewards
};
