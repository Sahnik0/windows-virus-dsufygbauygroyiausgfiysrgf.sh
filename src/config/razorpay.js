const Razorpay = require('razorpay');

// Instantiate Razorpay instance with key ID and key secret from environment
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder',
});

module.exports = razorpay;
