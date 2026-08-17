const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Simulated DB tables
const users = [];
const places = [];
const messages = [];
const securityLogs = [];
const blockedIps = new Set();
const lockedAccounts = new Set();
const loginAttempts = {}; // { email: { count: 0, lockUntil: null } }

// Helper to pre-populate mock data
async function initializeData() {
  const salt = await bcrypt.genSalt(10);
  
  // Travelers
  users.push({
    id: 'user-traveler-1',
    name: 'Rahul Kumar',
    email: 'rahul@travelbee.com',
    password: await bcrypt.hash('password123', salt),
    role: 'Traveler',
    interests: ['History', 'Photography'],
    location: { lat: 12.9716, lng: 77.5946 }, // Bangalore
    optInLocation: true,
    createdAt: new Date()
  });

  users.push({
    id: 'user-traveler-2',
    name: 'Maria Santos',
    email: 'maria@travelbee.com',
    password: await bcrypt.hash('password123', salt),
    role: 'Traveler',
    interests: ['Nature', 'Architecture'],
    location: { lat: 12.9800, lng: 77.6000 },
    optInLocation: true,
    createdAt: new Date()
  });

  users.push({
    id: 'user-traveler-3',
    name: 'John Doe',
    email: 'john@travelbee.com',
    password: await bcrypt.hash('password123', salt),
    role: 'Traveler',
    interests: ['Food', 'Culture'],
    location: { lat: 13.0000, lng: 77.6200 },
    optInLocation: false,
    createdAt: new Date()
  });

  // Moderator
  users.push({
    id: 'user-moderator-1',
    name: 'Sarah Chen (Moderator)',
    email: 'moderator@travelbee.com',
    password: await bcrypt.hash('moderatorpass', salt),
    role: 'Moderator',
    createdAt: new Date()
  });

  // Security Analyst
  users.push({
    id: 'user-analyst-1',
    name: 'David Miller (Sec Analyst)',
    email: 'security@travelbee.com',
    password: await bcrypt.hash('securitypass', salt),
    role: 'Security Analyst',
    createdAt: new Date()
  });

  // Super Admin
  users.push({
    id: 'user-admin-1',
    name: 'Alice Johnson (Super Admin)',
    email: 'admin@travelbee.com',
    password: await bcrypt.hash('adminpass', salt),
    role: 'Super Admin',
    createdAt: new Date()
  });

  // Initial places
  places.push({
    id: 'place-1',
    name: 'Old Railway Bridge',
    category: 'Historical',
    description: 'An ancient iron railway bridge built during the British era, now serving as a sunset spot.',
    rating: 4.8,
    reviewsCount: 34,
    location: { lat: 12.9722, lng: 77.5950 },
    photos: ['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800'],
    submittedBy: 'System',
    approved: true
  });

  places.push({
    id: 'place-2',
    name: 'Secret Forest Clearing',
    category: 'Hidden Spot',
    description: 'A beautiful hidden glade inside the city park, surrounded by ancient oak trees.',
    rating: 4.9,
    reviewsCount: 12,
    location: { lat: 12.9810, lng: 77.6015 },
    photos: ['https://images.unsplash.com/photo-1448375240586-882707db888b?w=800'],
    submittedBy: 'user-traveler-2',
    approved: true
  });

  places.push({
    id: 'place-3',
    name: 'Clock Tower Bistro',
    category: 'Community Spot',
    description: 'A vintage cafe located right next to the historic city clock tower, famous for coffee.',
    rating: 4.5,
    reviewsCount: 52,
    location: { lat: 12.9690, lng: 77.5900 },
    photos: ['https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800'],
    submittedBy: 'System',
    approved: true
  });

  // Initial messages
  messages.push({
    id: 'msg-1',
    senderId: 'user-traveler-2', // Maria
    receiverId: 'user-traveler-1', // Rahul
    content: 'Hi Rahul! Are you planning to visit the Old Railway Bridge today?',
    timestamp: new Date(Date.now() - 3600000),
    read: true
  });

  messages.push({
    id: 'msg-2',
    senderId: 'user-traveler-1', // Rahul
    receiverId: 'user-traveler-2', // Maria
    content: 'Hey Maria! Yes, I was thinking of heading there around 5 PM.',
    timestamp: new Date(Date.now() - 1800000),
    read: true
  });

  // Initial logs
  securityLogs.push({
    id: 'log-1',
    timestamp: new Date(Date.now() - 7200000),
    type: 'AUTHENTICATION_SUCCESS',
    severity: 'INFO',
    message: 'User security@travelbee.com logged in successfully.',
    ip: '127.0.0.1',
    details: { email: 'security@travelbee.com' }
  });

  securityLogs.push({
    id: 'log-2',
    timestamp: new Date(Date.now() - 3600000),
    type: 'RATE_LIMIT_EXCEEDED',
    severity: 'WARNING',
    message: 'IP 192.168.1.15 exceeded API limit on /api/auth/login.',
    ip: '192.168.1.15',
    details: { path: '/api/auth/login' }
  });
}

initializeData();

module.exports = {
  users,
  places,
  messages,
  securityLogs,
  blockedIps,
  lockedAccounts,
  loginAttempts,
  
  // Utility models functions
  findUserByEmail: (email) => {
    if (typeof email !== 'string') return null;
    return users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },
  findUserById: (id) => users.find(u => u.id === id),
  
  addUser: (user) => {
    user.id = user.id || `user-${uuidv4()}`;
    user.createdAt = user.createdAt || new Date();
    users.push(user);
    return user;
  },

  addPlace: (place) => {
    place.id = place.id || `place-${uuidv4()}`;
    place.createdAt = new Date();
    place.reviewsCount = 0;
    place.rating = 0;
    places.push(place);
    return place;
  },

  addMessage: (msg) => {
    msg.id = `msg-${uuidv4()}`;
    msg.timestamp = new Date();
    msg.read = false;
    messages.push(msg);
    return msg;
  },

  addSecurityLog: (log) => {
    const newLog = {
      id: `log-${uuidv4()}`,
      timestamp: new Date(),
      ...log
    };
    securityLogs.unshift(newLog); // Newer logs first
    return newLog;
  }
};
