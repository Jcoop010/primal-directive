import { createServerFn } from "@tanstack/react-start";
/** Public configuration booleans only, never credential values. */
export const signInCapabilities = createServerFn({ method: "GET" }).handler(async () => ({
  microsoft: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
}));
