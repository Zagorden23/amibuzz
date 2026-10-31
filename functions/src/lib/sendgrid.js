const sgMail = require('@sendgrid/mail');
const { config } = require('../config');

let initialized = false;
function ensureInitialized() {
  if (!initialized) {
    if (!config.sendgrid.apiKey) {
      throw new Error('SENDGRID_API_KEY is not configured — see functions/.env.example.');
    }
    sgMail.setApiKey(config.sendgrid.apiKey);
    initialized = true;
  }
}

async function sendEmailOtp(toEmail, otp) {
  // Emulator-only fallback: with no SendGrid key configured locally, print the
  // code to the Functions emulator console so local sign-in is testable.
  // FUNCTIONS_EMULATOR is set only by the Firebase CLI emulator, never in
  // deployed Functions, so this can't leak a production code.
  if (process.env.FUNCTIONS_EMULATOR === 'true' && !config.sendgrid.apiKey) {
    console.log(`[emulator] Email OTP for ${toEmail}: ${otp}`);
    return;
  }

  ensureInitialized();
  if (!config.sendgrid.fromEmail) {
    throw new Error('SENDGRID_FROM_EMAIL is not configured — see functions/.env.example.');
  }
  await sgMail.send({
    to: toEmail,
    from: config.sendgrid.fromEmail,
    subject: `${otp} is your AmiBuzz verification code`,
    text: `Your AmiBuzz verification code is ${otp}. It expires in 5 minutes. If you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: auto;">
        <h2 style="color:#ef4444;">AmiBuzz</h2>
        <p>Your verification code is:</p>
        <p style="font-size: 32px; font-weight: 800; letter-spacing: 6px;">${otp}</p>
        <p style="color:#666; font-size: 13px;">This code expires in 5 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendEmailOtp };
