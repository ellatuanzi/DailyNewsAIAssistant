import { google } from "googleapis";
import { Buffer } from "node:buffer";

function encodeHeader(value) {
  if (!/[^\x00-\x7F]/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function createOAuth2Client(config) {
  const client = new google.auth.OAuth2(
    config.gmailClientId,
    config.gmailClientSecret
  );

  client.setCredentials({
    refresh_token: config.gmailRefreshToken
  });

  return client;
}

export function createGmailClient(config) {
  const auth = createOAuth2Client(config);
  const gmail = google.gmail({ version: "v1", auth });

  return {
    async search(query, maxResults = 10) {
      const response = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults
      });

      return response.data.messages || [];
    },

    async hasSentMessage({ to, subject }) {
      const query = [
        "in:sent",
        `to:${to}`,
        `subject:\"${subject.replace(/\"/g, "\\\"")}\"`
      ].join(" ");
      const messages = await this.search(query, 1);
      return messages.length > 0;
    },

    async sendMail({ to, subject, body }) {
      const raw = [
        `From: ${config.emailSender}`,
        `To: ${to}`,
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: 8bit",
        "MIME-Version: 1.0",
        `Subject: ${encodeHeader(subject)}`,
        "",
        body
      ].join("\n");

      const encoded = Buffer.from(raw)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encoded }
      });

      return response.data;
    }
  };
}
