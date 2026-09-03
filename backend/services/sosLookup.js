const DEFAULT_RADIUS_METERS = 20000;
const MAX_RESULTS = 8;
const EARTH_RADIUS_KM = 6371;

const EMERGENCY_NUMBERS = {
  PK: [
    { label: 'Rescue 1122', number: '1122' },
    { label: 'Police', number: '15' },
    { label: 'Ambulance (Edhi)', number: '115' },
    { label: 'Fire Brigade', number: '16' },
  ],
};

const MOCK_SERVICES = [
  { name: 'District Headquarters Hospital', category: 'hospital', latitude: 36.3202, longitude: 74.6519, phone: '+92 5813 920011' },
  { name: 'Aliabad Rescue Post', category: 'rescue', latitude: 36.3105, longitude: 74.6462, phone: '1122' },
  { name: 'Karimabad Police Station', category: 'police', latitude: 36.3268, longitude: 74.6601, phone: '15' },
  { name: 'Hunza Pharmacy & Clinic', category: 'pharmacy', latitude: 36.3151, longitude: 74.6488, phone: '+92 300 1234567' },
];

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function distanceKm(fromLat, fromLng, toLat, toLng) {
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function emergencyNumbersFor(countryCode) {
  return EMERGENCY_NUMBERS[countryCode] || EMERGENCY_NUMBERS.PK;
}

function isRealProviderConfigured() {
  return false;
}

async function findNearestServices({ latitude, longitude, radiusMeters = DEFAULT_RADIUS_METERS }) {
  const services = MOCK_SERVICES
    .map((service) => ({
      ...service,
      distanceKm: Number(distanceKm(latitude, longitude, service.latitude, service.longitude).toFixed(3)),
    }))
    .filter((service) => service.distanceKm * 1000 <= radiusMeters)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, MAX_RESULTS);

  return {
    provider: 'mock',
    mocked: true,
    radiusMeters,
    services,
    emergencyNumbers: emergencyNumbersFor('PK'),
  };
}

module.exports = {
  findNearestServices,
  isRealProviderConfigured,
  emergencyNumbersFor,
  distanceKm,
  DEFAULT_RADIUS_METERS,
};
