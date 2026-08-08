/**
 * Haversine formula to compute straight-line distance between two lat/lng coordinates in kilometers.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

/**
 * Calls OSRM public demo routing service with fallback to Haversine straight-line distance on error or timeout.
 * @param {{ lat: number, lng: number }} origin - Pickup coordinate
 * @param {{ lat: number, lng: number }} destination - Destination coordinate
 * @returns {Promise<{ distanceKm: number, durationMinutes: number, routeGeometry: string|null, routeSource: string }>}
 */
async function getRoute(origin, destination) {
  const baseUrl = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
  const url = `${baseUrl}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for public demo server

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM API error status ${response.status}`);
    }

    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distanceKm = parseFloat((route.distance / 1000).toFixed(2));
      const durationMinutes = parseFloat((route.duration / 60).toFixed(2));
      const routeGeometry = JSON.stringify(route.geometry);

      return {
        distanceKm,
        durationMinutes,
        routeGeometry,
        routeSource: 'osrm_driving',
      };
    }
    throw new Error('OSRM returned no valid routes');
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn(`[Routing] OSRM call failed (${error.message}). Falling back to Haversine calculation.`);

    const distanceKm = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    // Assumed average urban driving speed 30 km/h -> ~2 minutes per km
    const durationMinutes = parseFloat((distanceKm * 2).toFixed(2));

    return {
      distanceKm,
      durationMinutes,
      routeGeometry: null,
      routeSource: 'fallback_haversine',
    };
  }
}

module.exports = {
  getRoute,
  haversineDistance,
};
