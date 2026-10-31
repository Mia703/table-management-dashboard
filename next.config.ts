import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
const config: NextConfig = { reactStrictMode: true };
// Source maps upload only when SENTRY_AUTH_TOKEN is set (e.g. in Vercel); builds work without it.
export default withSentryConfig(config, {
	org: "amyas-organisation",
	project: process.env.SENTRY_PROJECT,
	authToken: process.env.SENTRY_AUTH_TOKEN,
	silent: !process.env.CI,
	widenClientFileUpload: true,
});
