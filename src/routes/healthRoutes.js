const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Database connection test
router.get('/db-test', async (req, res) => {
  try {
    const User = require('../models/User');
    const count = await User.countDocuments();
    
    res.json({
      status: 'ok',
      database: 'connected',
      userCount: count
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'error',
      message: error.message
    });
  }
});

module.exports = router;
