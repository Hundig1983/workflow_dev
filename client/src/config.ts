/**
 * EXPO_PUBLIC_* values are inlined into the shipped bundle at build time, so this
 * must never carry a credential — only the address of the API to talk to.
 */
const DEFAULT_API_URL = 'http://127.0.0.1:3000';

export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;
