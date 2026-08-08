const prisma = require('../../config/prisma');
const razorpay = require('../../config/razorpay');
const crypto = require('crypto');

// Service class containing business logic for trip payment processing and Razorpay webhooks
class PaymentsService {
  // Processes payment for a trip in PAYMENT_PENDING state
  async processTripPayment(currentUser, tripId, { method }) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        ride: {
          include: {
            joinRequests: {
              where: { passengerId: currentUser.id, status: 'ACCEPTED' },
            },
          },
        },
      },
    });

    if (!trip) {
      const error = new Error('Trip not found');
      error.statusCode = 404;
      throw error;
    }

    if (currentUser.role !== 'SUPER_ADMIN' && trip.ride.orgId !== currentUser.orgId) {
      const error = new Error('Unauthorized access to trip in another organization');
      error.statusCode = 403;
      throw error;
    }

    const isDriver = trip.ride.driverId === currentUser.id;
    const acceptedRequest = trip.ride.joinRequests[0];
    if (!isDriver && !acceptedRequest) {
      const error = new Error('Unauthorized: You are not a booked passenger on this trip');
      error.statusCode = 403;
      throw error;
    }

    if (trip.status !== 'PAYMENT_PENDING') {
      const error = new Error(`Payment invalid: Trip is in status ${trip.status}, expected PAYMENT_PENDING`);
      error.statusCode = 400;
      throw error;
    }

    // Determine exact payment amount from agreed fare or ride farePerSeat
    const amount = acceptedRequest ? Number(acceptedRequest.agreedFare) : Number(trip.ride.farePerSeat);

    if (method === 'WALLET') {
      return await this.payWithWallet(currentUser, trip, amount);
    } else if (method === 'CASH') {
      return await this.payWithCash(currentUser, trip, amount);
    } else if (method === 'CARD' || method === 'UPI') {
      return await this.createRazorpayTripOrder(currentUser, trip, method, amount);
    } else {
      const error = new Error('Unsupported payment method');
      error.statusCode = 400;
      throw error;
    }
  }

  // Wallet payment logic: Checks balance, debits wallet atomically, and updates trip to PAYMENT_COMPLETED
  async payWithWallet(currentUser, trip, amount) {
    return await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({
        where: { userId: currentUser.id },
      });

      if (!wallet || Number(wallet.balance) < amount) {
        const error = new Error('Insufficient wallet balance to pay for this trip');
        error.statusCode = 402; // 402 Payment Required
        throw error;
      }

      // Atomic debit check preventing double spend
      const updatedWallet = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          balance: { gte: amount },
        },
        data: {
          balance: { decrement: amount },
        },
      });

      if (updatedWallet.count === 0) {
        const error = new Error('Insufficient wallet balance to pay for this trip');
        error.statusCode = 402;
        throw error;
      }

      // Log DEBIT transaction in wallet ledger
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amount,
          reason: `Payment for trip ${trip.id}`,
        },
      });

      // Create PAID Payment record
      const payment = await tx.payment.create({
        data: {
          tripId: trip.id,
          payerId: currentUser.id,
          amount,
          method: 'WALLET',
          status: 'PAID',
        },
      });

      // Advance Trip status to PAYMENT_COMPLETED
      const updatedTrip = await tx.trip.update({
        where: { id: trip.id },
        data: { status: 'PAYMENT_COMPLETED' },
      });

      return {
        message: 'Payment completed via wallet',
        payment,
        trip: updatedTrip,
      };
    });
  }

  // Cash payment logic: Creates PAID payment record directly and advances trip status to PAYMENT_COMPLETED
  async payWithCash(currentUser, trip, amount) {
    return await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tripId: trip.id,
          payerId: currentUser.id,
          amount,
          method: 'CASH',
          status: 'PAID',
        },
      });

      const updatedTrip = await tx.trip.update({
        where: { id: trip.id },
        data: { status: 'PAYMENT_COMPLETED' },
      });

      return {
        message: 'Cash payment confirmed',
        payment,
        trip: updatedTrip,
      };
    });
  }

  // Creates Razorpay gateway order for CARD/UPI trip payments
  async createRazorpayTripOrder(currentUser, trip, method, amount) {
    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';

    let orderId;
    if (keyId.startsWith('rzp_test_placeholder')) {
      orderId = `order_trip_sim_${Date.now()}`;
    } else {
      const order = await razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt: `trip_pay_${trip.id.slice(0, 8)}`,
      });
      orderId = order.id;
    }

    const payment = await prisma.payment.create({
      data: {
        tripId: trip.id,
        payerId: currentUser.id,
        amount,
        method,
        status: 'PENDING',
        razorpayOrderId: orderId,
      },
    });

    return {
      message: 'Razorpay order created for trip payment',
      paymentId: payment.id,
      razorpayOrderId: orderId,
      amount,
      keyId,
    };
  }

  // Verifies Razorpay Webhook signature and idempotently marks trip as PAYMENT_COMPLETED on payment.captured
  async handleRazorpayWebhook(rawBody, signature) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_placeholder';

    // Verify HMAC-SHA256 signature using timing-safe buffer comparison
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const actualBuf = Buffer.from(signature || '', 'utf8');

    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      const error = new Error('Invalid webhook signature');
      error.statusCode = 400;
      throw error;
    }

    const payload = JSON.parse(rawBody.toString());
    const event = payload.event;

    if (event === 'payment.captured') {
      const paymentEntity = payload.payload.payment.entity;
      const razorpayOrderId = paymentEntity.order_id;
      const razorpayPaymentId = paymentEntity.id;

      const payment = await prisma.payment.findFirst({
        where: { razorpayOrderId },
      });

      if (payment) {
        // Idempotency check: skip if payment is already processed
        if (payment.status === 'PAID') {
          return { message: 'Webhook already processed (idempotent skip)' };
        }

        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'PAID',
              razorpayPaymentId,
            },
          });

          await tx.trip.update({
            where: { id: payment.tripId },
            data: { status: 'PAYMENT_COMPLETED' },
          });
        });

        return { message: 'Payment captured and trip marked PAYMENT_COMPLETED' };
      }
    }

    return { message: `Webhook event '${event}' acknowledged` };
  }
}

module.exports = new PaymentsService();
