import * as Sentry from "@sentry/nextjs";

// Edge runtime config; same settings as sentry.server.config.ts.
Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
	tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
	sendDefaultPii: false,
});
