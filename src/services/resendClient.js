function normalizeRecipients(to) {
  if (Array.isArray(to)) {
    return to;
  }

  return String(to)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createResendClient(config) {
  return {
    async sendMail({ to, subject, body }) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: config.emailSender,
          to: normalizeRecipients(to),
          subject,
          text: body
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          data?.message ||
          data?.error ||
          `Resend request failed with status ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        error.provider = "resend";
        error.details = data;
        throw error;
      }

      return {
        id: data.id
      };
    }
  };
}
