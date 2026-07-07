import { dev } from '$app/environment';
import { injectAnalytics } from '@vercel/analytics/sveltekit';

// Web MIDI is a browser-only API, so render entirely on the client.
export const ssr = false;
export const prerender = false;

injectAnalytics({ mode: dev ? 'development' : 'production' });
