const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to update lastActivity for authenticated users
// Optionally parses JWT from Authorization header if req.user is not yet set
// Uses updateOne to avoid triggering pre-save hooks (password hashing, etc.)
// Throttles updates to once per minute to reduce DB writes
const activityCache = new Map(); // userId -> lastUpdateTimestamp

const trackActivity = (req, res, next) => {
  try {
    let userId = req.user?.userId;
    
    // If no user yet (middleware runs before authMiddleware on some routes),
    // try to extract userId from the Authorization header
    if (!userId) {
      const authHeader = req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7).trim();
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          userId = decoded.userId;
        } catch (e) {
          // Invalid/expired token - just skip tracking
        }
      }
    }
    
    if (userId) {
      const now = Date.now();
      const lastUpdate = activityCache.get(userId) || 0;
      
      // Only update DB once per minute per user
      if (now - lastUpdate > 60000) {
        activityCache.set(userId, now);
        // Fire-and-forget: don't await, don't block the request
        User.updateOne(
          { _id: userId },
          { $set: { lastActivity: new Date() } }
        ).exec().catch(() => {});
      }
    }
  } catch (e) {
    // Never block the request due to activity tracking errors
  }
  next();
};

module.exports = trackActivity;
