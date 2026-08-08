// CRITICAL SECURITY RULE: Wallet operations are strictly user-scoped to req.user.id.
// Signature verification MUST verify HMAC-SHA256 digests before modifying balance.

const prisma = require('../../config/prisma');
const razorpay = require('../../config/razorpay');
const crypto = require('crypto');

class WalletService {
  /**
   * Retrieves or creates user wallet.
   */
  async getWallet(currentUser) {
    let wallet = await prisma.wallet.findUnique({
      where: { userId: currentUser.id },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: currentUser.id,
          balance: 0.0,
        },
        include: {
          transactions: true,
        },
      });
    }

    return wallet;
  }

  /**
   * Creates a Razorpay order for wallet recharge.
   */
  async createRechargeOrder(currentUser, amount) {
    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';

    // If test placeholder keys are active, return a simulated orderId for test mock compatibility
    if (keyId.startsWith('rzp_test_placeholder')) {
      const orderId = `order_sim_${Date.now()}`;
      return {
        orderId,
        amount,
        currency: 'INR',
        keyId,
      };
    }

    const options = {
      amount: Math.round(amount * 100), // Razorpay accepts amount in paise
      currency: 'INR',
      receipt: `w_recharge_${currentUser.id.slice(0, 8)}_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    return {
      orderId: order.id,
      amount,
      currency: order.currency,
      keyId,
    };
  }

  /**
   * Verifies Razorpay payment signature and credits wallet balance atomically.
   */
  async verifyRecharge(currentUser, { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount }) {
    if (amount <= 0 || isNaN(Number(amount))) {
      const error = new Error('Recharge amount must be a positive number');
      error.statusCode = 400;
      throw error;
    }

    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder';

    // Verify HMAC-SHA256 signature with constant-time comparison
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const actualBuf = Buffer.from(razorpay_signature || '', 'utf8');

    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      const error = new Error('Invalid payment signature verification failed');
      error.statusCode = 400;
      throw error;
    }

    // Verify payment amount against Razorpay if real credentials are used
    if (!keyId.startsWith('rzp_test_placeholder')) {
      try {
        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
        const expectedPaise = Math.round(amount * 100);
        if (paymentDetails.amount !== expectedPaise) {
          const error = new Error('Payment amount mismatch against gateway record');
          error.statusCode = 400;
          throw error;
        }
      } catch (err) {
        if (err.statusCode) throw err;
        const error = new Error('Failed to verify payment details with gateway');
        error.statusCode = 400;
        throw error;
      }
    }

    // Atomic wallet update transaction with idempotency (replay protection)
    return await prisma.$transaction(async (tx) => {
      // Replay check: ensure this payment ID hasn't been credited already
      const existingTx = await tx.walletTransaction.findFirst({
        where: {
          reason: { contains: razorpay_payment_id },
        },
      });

      if (existingTx) {
        const error = new Error('Payment has already been processed');
        error.statusCode = 400;
        throw error;
      }

      let wallet = await tx.wallet.findUnique({
        where: { userId: currentUser.id },
      });

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId: currentUser.id, balance: 0.0 },
        });
      }

      const newBalance = Number(wallet.balance) + Number(amount);

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount,
          reason: `Wallet recharge via Razorpay payment ${razorpay_payment_id}`,
        },
      });

      return {
        message: 'Wallet recharge successful',
        balance: updatedWallet.balance,
        transactionId: razorpay_payment_id,
      };
    });
  }
}

module.exports = new WalletService();
