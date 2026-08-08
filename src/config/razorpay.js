// Import official Razorpay SDK library
const Razorpay = require('razorpay');

// Instantiate Razorpay client using key ID and key secret from environment variables
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder',
});

// Export the configured Razorpay instance for payment processing
module.exports = razorpay;
