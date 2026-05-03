// Hard guard: refuse to run tests against a non-test database.
export default function globalSetup() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("feedbackme_test")) {
    throw new Error(
      `Refusing to run tests: DATABASE_URL must point to feedbackme_test. Got: ${url}`,
    );
  }
}
