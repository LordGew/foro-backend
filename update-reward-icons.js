const RewardItem = require('./src/models/RewardItem');
const rewardsData = require('./src/data/rewards-data');

async function updateRewardIcons() {
  try {
    console.log('Updating reward icons...');
    
    // Get all rewards from database
    const existingRewards = await RewardItem.find({});
    console.log(`Found ${existingRewards.length} existing rewards`);
    
    // Update each reward with iconUrl based on slug
    for (const reward of existingRewards) {
      const dataReward = rewardsData.find(r => r.slug === reward.slug);
      if (dataReward && dataReward.iconUrl) {
        reward.iconUrl = dataReward.iconUrl;
        await reward.save();
        console.log(`Updated iconUrl for reward: ${reward.name} -> ${reward.iconUrl}`);
      } else {
        console.log(`No iconUrl found for reward: ${reward.name} (slug: ${reward.slug})`);
      }
    }
    
    console.log('Reward icons update completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error updating reward icons:', error);
    process.exit(1);
  }
}

updateRewardIcons();
