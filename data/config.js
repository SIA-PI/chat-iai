require('dotenv').config();

const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL,
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
  },
  recaptcha: {
    siteKey: process.env.RECAPTCHA_SITE_KEY,
    secretKey: process.env.RECAPTCHA_SECRET_KEY
  },
  server: {
    port: process.env.PORT || 3000
  }
};

function validateConfig() {
  const errors = [];
  if (!config.openai.apiKey) errors.push('OPENAI_API_KEY');
  if (!config.openai.baseUrl) errors.push('OPENAI_BASE_URL');
  if (!config.recaptcha.secretKey) errors.push('RECAPTCHA_SECRET_KEY');
  return errors;
}

module.exports = { config, validateConfig };
