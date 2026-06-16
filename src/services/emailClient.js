import { createGmailClient } from "./gmailClient.js";
import { createResendClient } from "./resendClient.js";

export function createEmailClient(config) {
  if (config.emailProvider === "gmail") {
    return createGmailClient(config);
  }

  if (config.emailProvider === "resend") {
    return createResendClient(config);
  }

  throw new Error(`Unsupported EMAIL_PROVIDER: ${config.emailProvider}`);
}
