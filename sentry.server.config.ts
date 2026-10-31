import * as Sentry from "@sentry/nextjs";

// Disabled until NEXT_PUBLIC_SENTRY_DSN is set. sendDefaultPii stays off so IP
// addresses, cookies and request bodies (guest and staff details) are not sent.
Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
	tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
	sendDefaultPii: false,
});
