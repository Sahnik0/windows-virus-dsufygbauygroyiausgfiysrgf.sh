const prisma = require('../../config/prisma');
const { assertTripParticipant } = require('../../utils/tripAuth');

class ChatService {
  /**
   * Sends a message for a trip (participant authorized).
   */
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

  /**
   * Retrieves trip chat history.
   */
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
      messages: messages.reverse(),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Marks unread messages for caller as read.
   */
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
