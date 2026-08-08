// CRITICAL SECURITY RULE: SavedPlace operations are personal convenience features strictly scoped to req.user.id.
// One user cannot see or edit another user's saved places.

const prisma = require('../../config/prisma');

class SavedPlacesService {
  /**
   * Creates a saved place for the authenticated user.
   */
  async createSavedPlace(currentUser, { label, address, latitude, longitude }) {
    return await prisma.savedPlace.create({
      data: {
        userId: currentUser.id,
        label,
        address,
        latitude,
        longitude,
      },
    });
  }

  /**
   * Lists all saved places owned by the authenticated user.
   */
  async getSavedPlaces(currentUser) {
    return await prisma.savedPlace.findMany({
      where: { userId: currentUser.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Gets a specific saved place by ID (owner-only).
   */
  async getSavedPlaceById(currentUser, placeId) {
    const place = await prisma.savedPlace.findUnique({
      where: { id: placeId },
    });

    if (!place) {
      const error = new Error('Saved place not found');
      error.statusCode = 404;
      throw error;
    }

    if (place.userId !== currentUser.id) {
      const error = new Error('Forbidden: Cannot access another user’s saved place');
      error.statusCode = 403;
      throw error;
    }

    return place;
  }

  /**
   * Updates a saved place (owner-only).
   */
  async updateSavedPlace(currentUser, placeId, { label, address, latitude, longitude }) {
    const place = await prisma.savedPlace.findUnique({ where: { id: placeId } });

    if (!place) {
      const error = new Error('Saved place not found');
      error.statusCode = 404;
      throw error;
    }

    if (place.userId !== currentUser.id) {
      const error = new Error('Forbidden: Cannot edit another user’s saved place');
      error.statusCode = 403;
      throw error;
    }

    return await prisma.savedPlace.update({
      where: { id: placeId },
      data: {
        ...(label !== undefined && { label }),
        ...(address !== undefined && { address }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
      },
    });
  }

  /**
   * Deletes a saved place (owner-only).
   */
  async deleteSavedPlace(currentUser, placeId) {
    const place = await prisma.savedPlace.findUnique({ where: { id: placeId } });

    if (!place) {
      const error = new Error('Saved place not found');
      error.statusCode = 404;
      throw error;
    }

    if (place.userId !== currentUser.id) {
      const error = new Error('Forbidden: Cannot delete another user’s saved place');
      error.statusCode = 403;
      throw error;
    }

    await prisma.savedPlace.delete({ where: { id: placeId } });
    return { message: 'Saved place deleted successfully' };
  }
}

module.exports = new SavedPlacesService();
