// AmiBuzz Cloud Functions entry point (plain JavaScript / CommonJS).
// Each exported function lives in its own file under src/ — this file just
// wires them up for `firebase deploy`.

const { initializeApp } = require('firebase-admin/app');
initializeApp();

exports.sendEmailOtp = require('./src/auth/sendEmailOtp').sendEmailOtp;
exports.verifyEmailOtp = require('./src/auth/verifyEmailOtp').verifyEmailOtp;
exports.sendSmsOtp = require('./src/auth/sendSmsOtp').sendSmsOtp;
exports.verifySmsOtp = require('./src/auth/verifySmsOtp').verifySmsOtp;

exports.consumeGeneration = require('./src/usage/consumeGeneration').consumeGeneration;
exports.getUsage = require('./src/usage/consumeGeneration').getUsage;

exports.generateSticker = require('./src/generation/generateSticker').generateSticker;
exports.enhancePrompt = require('./src/generation/generateSticker').enhancePrompt;

exports.createRazorpayOrder = require('./src/payments/createRazorpayOrder').createRazorpayOrder;
exports.verifyRazorpayPayment = require('./src/payments/verifyRazorpayPayment').verifyRazorpayPayment;
exports.razorpayWebhook = require('./src/payments/razorpayWebhook').razorpayWebhook;

exports.createStripeCheckoutSession = require('./src/payments/createStripeCheckoutSession').createStripeCheckoutSession;
exports.createStripePortalSession = require('./src/payments/createStripePortalSession').createStripePortalSession;
exports.stripeWebhook = require('./src/payments/stripeWebhook').stripeWebhook;

exports.cleanupExpiredOtps = require('./src/maintenance/cleanupOtps').cleanupExpiredOtps;
exports.expireSubscriptions = require('./src/maintenance/expireSubscriptions').expireSubscriptions;
