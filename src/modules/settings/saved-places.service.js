const prisma = require('../../config/prisma');

// Service class containing business logic for personal Saved Places
class SavedPlacesService {
  // Creates a personal saved place for the authenticated user (bound strictly to currentUser.id)
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

  // Lists all personal saved places owned by the authenticated user
  async getSavedPlaces(currentUser) {
    return await prisma.savedPlace.findMany({
      where: { userId: currentUser.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Fetches a single saved place record by ID (owner-only)
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

  // Updates a saved place record (owner-only)
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

  // Deletes a saved place record (owner-only)
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
