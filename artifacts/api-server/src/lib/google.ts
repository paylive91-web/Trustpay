import { OAuth2Client } from "google-auth-library";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

const client = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
};

/**
 * Verify a Google Identity Services ID token (JWT) issued for our web client.
 * Returns the verified identity, or throws on any failure.
 *
 * The audience check is enforced inside `verifyIdToken` against
 * GOOGLE_CLIENT_ID, so a token issued for a different OAuth app cannot be
 * replayed against TrustPay.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  if (!client || !GOOGLE_CLIENT_ID) {
    throw new Error("Google verification not configured on server");
  }
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Missing Google credential");
  }
  const ticket = await client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload) throw new Error("Invalid Google credential");
  if (!payload.email || !payload.email_verified) {
    throw new Error("Google account has no verified email");
  }
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: !!payload.email_verified,
    name: payload.name,
    picture: payload.picture,
  };
}

export function googleConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID;
}

export function googleClientId(): string {
  return GOOGLE_CLIENT_ID;
}
