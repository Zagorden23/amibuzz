const { config } = require('../config');

const MSG91_FLOW_URL = 'https://control.msg91.com/api/v5/flow/';

/**
 * Sends an SMS OTP via MSG91's Flow (templated SMS) API. We generate and
 * verify the OTP ourselves (see functions/src/lib/otp.js + auth/sendSmsOtp.js)
 * so this just delivers the code through a pre-approved DLT template — it
 * does not use MSG91's own OTP widget/verify endpoints.
 *
 * Requires a template created in the MSG91 dashboard with a variable named
 * `OTP` in its body, e.g.: "Your AmiBuzz verification code is ##OTP##".
 */
async function sendSmsOtp(phoneE164, otp) {
  // Emulator-only fallback: with no MSG91 key configured locally, print the
  // code to the Functions emulator console so local sign-in is testable.
  // FUNCTIONS_EMULATOR is set only by the Firebase CLI emulator, never in
  // deployed Functions, so this can't leak a production code.
  if (process.env.FUNCTIONS_EMULATOR === 'true' && !config.msg91.authKey) {
    console.log(`[emulator] SMS OTP for ${phoneE164}: ${otp}`);
    return;
  }

  if (!config.msg91.authKey || !config.msg91.templateId) {
    throw new Error('MSG91_AUTH_KEY / MSG91_TEMPLATE_ID are not configured — see functions/.env.example.');
  }

  // MSG91 expects the mobile number with country code but no leading '+'.
  const mobile = phoneE164.replace(/^\+/, '');

  const res = await fetch(MSG91_FLOW_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authkey: config.msg91.authKey,
    },
    body: JSON.stringify({
      template_id: config.msg91.templateId,
      short_url: '0',
      recipients: [{ mobiles: mobile, OTP: otp }],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.type === 'error') {
    throw new Error(`MSG91 error: ${data.message || res.statusText}`);
  }
}

module.exports = { sendSmsOtp };
