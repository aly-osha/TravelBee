const express = require('express');
const router = express.Router();
const store = require('../services/store');
const { authenticateToken } = require('../middleware/security');

// Helper to calculate distance between coordinates (km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

// 1. Get Nearby Travelers (with location privacy protection)
router.get('/nearby', authenticateToken, (req, res) => {
  const currentUser = store.findUserById(req.user.id);
  if (!currentUser) return res.status(404).json({ error: 'User not found.' });

  // Only return users who are Travelers and have optInLocation = true
  let nearbyTravelers = store.users.filter(u => 
    u.id !== currentUser.id && 
    u.role === 'Traveler' && 
    u.optInLocation &&
    u.location
  );

  // If currentUser does not have coordinates, or did not opt-in, we cannot calculate distance
  const userLat = currentUser.location ? currentUser.location.lat : null;
  const userLng = currentUser.location ? currentUser.location.lng : null;

  const result = nearbyTravelers.map(u => {
    let distanceStr = 'Location hidden';
    let distanceVal = 9999;
    
    if (userLat && userLng) {
      const distance = calculateDistance(userLat, userLng, u.location.lat, u.location.lng);
      distanceVal = distance;
      distanceStr = `${distance} km away`;
    }

    return {
      id: u.id,
      name: u.name,
      interests: u.interests,
      distanceStr,
      distance: distanceVal,
      // CRITICAL: We NEVER expose u.location coordinates directly
      location: null 
    };
  }).sort((a, b) => a.distance - b.distance);

  res.json(result);
});

// 2. Get Suggested Travelers (incorporating the 6-factor recommendation formula)
router.get('/suggested', authenticateToken, (req, res) => {
  const currentUser = store.findUserById(req.user.id);
  if (!currentUser) return res.status(404).json({ error: 'User not found.' });

  const travelers = store.users.filter(u => u.id !== currentUser.id && u.role === 'Traveler');

  const suggested = travelers.map(u => {
    let score = 0;
    let breakDown = {};

    // 1. Distance (30%) - closer yields higher score (max 30 pts if < 2km)
    let distScore = 0;
    if (currentUser.location && u.location) {
      const d = calculateDistance(currentUser.location.lat, currentUser.location.lng, u.location.lat, u.location.lng);
      if (d <= 2) distScore = 30;
      else if (d <= 5) distScore = 20;
      else if (d <= 15) distScore = 10;
    }
    score += distScore;
    breakDown.distance = distScore;

    // 2. Shared Interests (20%) - each match is 5 pts (max 20 pts)
    let interestScore = 0;
    if (currentUser.interests && u.interests) {
      const common = currentUser.interests.filter(i => u.interests.includes(i));
      interestScore = Math.min(common.length * 5, 20);
    }
    score += interestScore;
    breakDown.interests = interestScore;

    // 3. Common Destinations (15%) - Simulated match
    const commonDestScore = Math.random() > 0.5 ? 15 : 0;
    score += commonDestScore;
    breakDown.destinations = commonDestScore;

    // 4. Similar Discoveries (15%) - Simulated match
    const similarDiscoveriesScore = Math.random() > 0.4 ? 15 : 0;
    score += similarDiscoveriesScore;
    breakDown.discoveries = similarDiscoveriesScore;

    // 5. Mutual Followers (10%) - Simulated match
    const mutualFollowersScore = Math.random() > 0.6 ? 10 : 0;
    score += mutualFollowersScore;
    breakDown.mutualFollowers = mutualFollowersScore;

    // 6. Activity (10%) - Simulated match
    const activityScore = Math.random() > 0.3 ? 10 : 0;
    score += activityScore;
    breakDown.activity = activityScore;

    return {
      id: u.id,
      name: u.name,
      interests: u.interests,
      recommendationScore: score,
      breakDown
    };
  }).sort((a, b) => b.recommendationScore - a.recommendationScore);

  res.json(suggested);
});

// 3. Get Conversation History with IDOR Guard
router.get('/messages/:targetUserId', authenticateToken, (req, res) => {
  const requesterId = req.user.id;
  const targetId = req.params.targetUserId;

  // IDOR Guard: User cannot request conversations between two other parties.
  // The route specifies :targetUserId, meaning they fetch messages with targetUserId.
  // If they pass query params to spoof requesterId or try to query another conversation, we block it.
  const querySender = req.query.senderId;
  const queryReceiver = req.query.receiverId;
  
  if ((querySender && querySender !== requesterId) || (queryReceiver && queryReceiver !== requesterId && queryReceiver !== targetId)) {
    const ip = req.ip || req.connection.remoteAddress;
    store.addSecurityLog({
      type: 'IDOR_ATTEMPT',
      severity: 'HIGH',
      message: `User ${req.user.email} attempted insecure query of messages belonging to user ${querySender || queryReceiver}`,
      ip: ip,
      details: { requesterId, targetId, querySender, queryReceiver }
    });
    return res.status(403).json({ error: 'Access denied: IDOR validation failed.' });
  }

  // Filter messages involving both users
  const chatHistory = store.messages.filter(m => 
    (m.senderId === requesterId && m.receiverId === targetId) ||
    (m.senderId === targetId && m.receiverId === requesterId)
  ).sort((a, b) => a.timestamp - b.timestamp);

  res.json(chatHistory);
});

// 4. Follow traveler (Simulated social interaction)
const followedUsers = {}; // { userId: Set(followedUserIds) }
router.post('/follow/:targetUserId', authenticateToken, (req, res) => {
  const targetId = req.params.targetUserId;
  const myId = req.user.id;

  if (!followedUsers[myId]) {
    followedUsers[myId] = new Set();
  }

  if (followedUsers[myId].has(targetId)) {
    followedUsers[myId].delete(targetId);
    res.json({ following: false, message: 'Unfollowed traveler.' });
  } else {
    followedUsers[myId].add(targetId);
    res.json({ following: true, message: 'Following traveler.' });
  }
});

// 5. Explicit IDOR Test Endpoint (for demonstrating attack defense in the Attack Lab)
router.get('/idor-test/messages', authenticateToken, (req, res) => {
  // Simulates an attacker trying to query other users messages directly via query parameters
  const { senderId, receiverId } = req.query;

  if (senderId !== req.user.id && receiverId !== req.user.id) {
    const ip = req.ip || req.connection.remoteAddress;
    store.addSecurityLog({
      type: 'IDOR_ATTEMPT',
      severity: 'HIGH',
      message: `Insecure Direct Object Reference (IDOR) blocked. Attacker ${req.user.email} tried to fetch private messages between ${senderId} and ${receiverId}.`,
      ip: ip,
      details: { attacker: req.user.email, query: req.query }
    });
    return res.status(403).json({ error: 'Forbidden: You do not have permissions to read these messages.' });
  }

  res.json({ message: 'Success: Authorized conversation view.' });
});

// 6. Save a new message (used by realtime broker and frontend)
router.post('/messages', authenticateToken, (req, res) => {
  const { receiverId, content, placeShare } = req.body;
  const senderId = req.user.id;

  if (!receiverId || (!content && !placeShare)) {
    return res.status(400).json({ error: 'Receiver ID and content/placeshare are required.' });
  }

  const newMessage = store.addMessage({
    senderId,
    receiverId,
    content: content || '',
    placeShare: placeShare || null
  });

  res.status(201).json(newMessage);
});

// 7. Update current user location coordinates
router.post('/location', authenticateToken, (req, res) => {
  const { lat, lng } = req.body;
  const user = store.findUserById(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Latitude and longitude coordinates are required.' });
  }

  user.location = {
    lat: parseFloat(lat),
    lng: parseFloat(lng)
  };

  // Keep location optIn active
  user.optInLocation = true;

  res.json({
    message: 'Location updated successfully.',
    location: user.location
  });
});

module.exports = router;
