const prisma = require('../../config/prisma');
const { assertTripParticipant } = require('../../utils/tripAuth');

// Service class containing business logic for in-trip messaging
class ChatService {
  // Saves a new chat message to the database for an authorized trip participant
  async sendMessage(currentUser, tripId, content) {
    await assertTripParticipant(currentUser.id, tripId);

    const message = await prisma.message.create({
      data: {
        tripId,
        senderId: currentUser.id,
        content,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    return message;
  }

  // Returns paginated chat history for a trip (ordered chronologically)
  async getMessages(currentUser, tripId, page = 1, limit = 50) {
    await assertTripParticipant(currentUser.id, tripId);

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { tripId },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.message.count({ where: { tripId } }),
    ]);

    return {
      messages: messages.reverse(), // Reverse to present oldest-to-newest reading order
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Marks unread messages from other participants as read
  async markAsRead(currentUser, tripId) {
    await assertTripParticipant(currentUser.id, tripId);

    const result = await prisma.message.updateMany({
      where: {
        tripId,
        senderId: { not: currentUser.id },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { message: 'Messages marked as read', count: result.count };
  }
}

module.exports = new ChatService();
