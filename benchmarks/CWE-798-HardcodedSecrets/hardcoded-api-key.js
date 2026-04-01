// Vulnerable: Hardcoded secrets (benchmark file — all keys are intentionally fake)
const OPENAI_API_KEY = "sk-proj-FAKE000000000000000000000000000000000000000000000";

const dbConfig = {
  host: "db.example.com",
  port: 5432,
  database: "production",
  user: "admin",
  password: "SuperSecret123!"
};

const STRIPE_SECRET_KEY = "sk_test_FAKE0000000000000000000000000000000000";
const WEBHOOK_SECRET = "whsec_FAKE00000000000000000000000000000000";

module.exports = { OPENAI_API_KEY, dbConfig, STRIPE_SECRET_KEY, WEBHOOK_SECRET };
