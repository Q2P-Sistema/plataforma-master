import { authenticator } from 'otplib';
import QRCode from 'qrcode';

// Allow 1 window before/after (90s total tolerance for clock drift)
authenticator.options = { window: 1 };

const ISSUER = 'Atlas';

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function generateOtpauthUrl(secret: string, email: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export async function generateQRCodeDataUrl(
  secret: string,
  email: string,
): Promise<string> {
  const otpauthUrl = generateOtpauthUrl(secret, email);
  return QRCode.toDataURL(otpauthUrl);
}

export function verifyCode(secret: string, code: string): boolean {
  return authenticator.verify({ token: code, secret });
}
