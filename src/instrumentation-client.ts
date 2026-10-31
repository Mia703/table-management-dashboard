import * as Sentry from "@sentry/nextjs";

// Browser errors. No session replay: it would record guest names and dietary notes.
Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
	tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
	sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
