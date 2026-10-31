// Central place to read server-side secrets from process.env.
// Populated from functions/.env locally (via firebase-functions/params /
// dotenv autoload in the emulator) and from deployed secrets in production
// (`firebase functions:secrets:set NAME`).

function required(name) {
  const value = process.env[name];
  return value || '';
}

const config = {
  razorpay: {
    keyId: required('RAZORPAY_KEY_ID'),
    keySecret: required('RAZORPAY_KEY_SECRET'),
    webhookSecret: required('RAZORPAY_WEBHOOK_SECRET'),
  },
  stripe: {
    secretKey: required('STRIPE_SECRET_KEY'),
    webhookSecret: required('STRIPE_WEBHOOK_SECRET'),
  },
  sendgrid: {
    apiKey: required('SENDGRID_API_KEY'),
    fromEmail: required('SENDGRID_FROM_EMAIL'),
  },
  msg91: {
    authKey: required('MSG91_AUTH_KEY'),
    templateId: required('MSG91_TEMPLATE_ID'),
  },
  appUrl: required('APP_URL') || 'http://localhost:3000',
};

module.exports = { config };
