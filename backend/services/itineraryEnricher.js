const { Op } = require('sequelize');
const { Guide, User } = require('../models');
const { publicGuide } = require('../controllers/guideController');

const MARKETPLACE_GUIDE_LIMIT = 10;

async function findRegionGuides(destination) {
  return Guide.findAll({
    where: {
      isAvailable: true,
      region: { [Op.iLike]: `%${destination}%` },
    },
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'role'] }],
    order: [['pricePerDay', 'ASC'], ['createdAt', 'ASC']],
    limit: MARKETPLACE_GUIDE_LIMIT,
  });
}

function buildMarketplace(destination, guides) {
  return {
    region: destination,
    guides: guides.map((guide) => publicGuide(guide)),
    lodging: [],
    dining: [],
  };
}

function activityNeedsData(activity) {
  return activity && (activity.needsMarketplaceData === true || activity.needs_marketplace_data === true);
}

function enrichActivities(activities, marketplace) {
  if (!Array.isArray(activities) || !activities.some(activityNeedsData)) {
    return activities;
  }
  return activities.map((activity) => (activityNeedsData(activity) ? { ...activity, marketplace } : activity));
}

async function enrichItinerary(days, trip) {
  const dayNeedsData = days.some((day) => day.needsMarketplaceData);
  const activityNeeds = days.some((day) => Array.isArray(day.activities) && day.activities.some(activityNeedsData));

  if (!dayNeedsData && !activityNeeds) {
    return days;
  }

  const guides = await findRegionGuides(trip.destination);
  const marketplace = buildMarketplace(trip.destination, guides);

  return days.map((day) => {
    const activities = enrichActivities(day.activities, marketplace);
    if (day.needsMarketplaceData) {
      return { ...day, activities, marketplace };
    }
    if (activities !== day.activities) {
      return { ...day, activities };
    }
    return day;
  });
}

module.exports = { enrichItinerary, findRegionGuides, buildMarketplace, MARKETPLACE_GUIDE_LIMIT };
