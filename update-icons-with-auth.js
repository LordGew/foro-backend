// Script to get admin token and update reward icons
const axios = require('axios');

const BASE_URL = 'https://foro-backend-9j93.onrender.com';

async function updateRewardIcons() {
  try {
    // Step 1: Login to get token (replace with your admin credentials)
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@example.com', // Replace with your admin email
      password: 'admin123' // Replace with your admin password
    });

    const token = loginResponse.data.token;
    console.log('Token obtained:', token);

    // Step 2: Call the update reward icons endpoint
    const updateResponse = await axios.post(
      `${BASE_URL}/api/referrals/update-reward-icons`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Update response:', updateResponse.data);
    console.log('✅ Reward icons updated successfully!');
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

updateRewardIcons();
