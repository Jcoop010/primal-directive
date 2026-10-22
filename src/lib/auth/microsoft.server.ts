import { refreshAccessToken } from "better-auth/oauth2";
/** Email claims never authorize implicit linking. Explicit linking requires a
 * signed-in user, signed OAuth state and possession of the provider identity. */
export const MICROSOFT_LINKING_POLICY = {
  allowDifferentEmails: true,
  disableImplicitLinking: true,
  trustedProviders: ["microsoft"],
};
export function microsoftOAuthOptions(clientId: string, clientSecret: string) {
  return {
    clientId,
    clientSecret,
    tenantId: "common",
    disableDefaultScope: true,
    scope: ["openid", "profile", "email"],
    prompt: "consent" as const,
    disableProfilePhoto: true,
    // Omit scope on refresh: Microsoft's default provider otherwise narrows the
    // renewed token to login scopes and drops explicitly consented mail scopes.
    refreshAccessToken: (token: string) =>
      refreshAccessToken({
        refreshToken: token,
        options: { clientId, clientSecret },
        tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      }),
    mapProfileToUser: (profile: { email?: string; preferred_username?: string }) => ({
      image: undefined,
      emailVerified: false,
      email:
        profile.email ??
        (profile.preferred_username?.includes("@") ? profile.preferred_username : undefined),
    }),
  };
}
