const express = require('express');
const router = express.Router();
const store = require('../services/store');
const { authenticateToken } = require('../middleware/security');

// Utility function to calculate distance between two coordinates in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return parseFloat(d.toFixed(1));
}

// 1. Get all places (with optional location search/filters)
router.get('/', (req, res) => {
  const { category, search, lat, lng } = req.query;
  let filtered = [...store.places];

  // Filters by approval status (non-moderators can only see approved places)
  // For simplicity, default to approved places
  filtered = filtered.filter(p => p.approved);

  if (category) {
    filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.description.toLowerCase().includes(q)
    );
  }

  // Calculate distances if coordinates are provided
  if (lat && lng) {
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    filtered = filtered.map(p => ({
      ...p,
      distance: calculateDistance(userLat, userLng, p.location.lat, p.location.lng)
    })).sort((a, b) => a.distance - b.distance);
  }

  res.json(filtered);
});

// 2. Get single place details
router.get('/:id', (req, res) => {
  const place = store.places.find(p => p.id === req.params.id);
  if (!place) {
    return res.status(404).json({ error: 'Place not found.' });
  }
  res.json(place);
});

// 3. Submit a new location (requires login)
router.post('/', authenticateToken, (req, res) => {
  const { name, category, description, lat, lng, photos } = req.body;

  if (!name || !category || !description || !lat || !lng) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  const newPlace = store.addPlace({
    name,
    category,
    description,
    location: { lat: parseFloat(lat), lng: parseFloat(lng) },
    photos: photos && photos.length ? photos : ['https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800'],
    submittedBy: req.user.id,
    approved: false // Moderation review required out of the box!
  });

  const ip = req.ip || req.connection.remoteAddress;
  store.addSecurityLog({
    type: 'PLACE_SUBMISSION',
    severity: 'INFO',
    message: `User ${req.user.email} submitted hidden location: ${name} (Awaiting Moderation)`,
    ip: ip,
    details: { placeId: newPlace.id, name }
  });

  res.status(201).json(newPlace);
});

// 4. Rate and Review a place
router.post('/:id/reviews', authenticateToken, (req, res) => {
  const { rating, comment } = req.body;
  const place = store.places.find(p => p.id === req.params.id);

  if (!place) {
    return res.status(404).json({ error: 'Place not found.' });
  }

  if (rating === undefined || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Valid rating (1 to 5) is required.' });
  }

  // Update rating score
  const totalRating = (place.rating * place.reviewsCount) + rating;
  place.reviewsCount += 1;
  place.rating = parseFloat((totalRating / place.reviewsCount).toFixed(1));

  res.status(201).json(place);
});

module.exports = router;
