// Update reward icons via API
const RewardItem = require('./src/models/RewardItem');
const rewardsData = require('./src/data/rewards-data');

// Add this to your referralController.js
exports.updateRewardIcons = async (req, res) => {
  try {
    console.log('Updating reward icons...');
    
    // Get all rewards from database
    const existingRewards = await RewardItem.find({});
    console.log(`Found ${existingRewards.length} existing rewards`);
    
    let updatedCount = 0;
    
    // Update each reward with iconUrl based on slug
    for (const reward of existingRewards) {
      const dataReward = rewardsData.find(r => r.slug === reward.slug);
      if (dataReward && dataReward.iconUrl && !reward.iconUrl) {
        reward.iconUrl = dataReward.iconUrl;
        await reward.save();
        updatedCount++;
        console.log(`Updated iconUrl for reward: ${reward.name} -> ${reward.iconUrl}`);
      }
    }
    
    console.log(`Reward icons update completed! Updated ${updatedCount} rewards.`);
    
    res.json({
      message: 'Reward icons update completed',
      totalRewards: existingRewards.length,
      updatedCount: updatedCount
    });
  } catch (error) {
    console.error('Error updating reward icons:', error);
    res.status(500).json({ message: 'Error updating reward icons', error: error.message });
  }
};
