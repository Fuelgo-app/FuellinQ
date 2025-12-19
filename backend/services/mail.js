await sendMail({
  to: user.email,
  subject: "Welkom bij FuelLinq 🚗",
  html: `<p>Hi ${user.name},</p><p>Je account is succesvol aangemaakt. Log in via <a href="${WEB_BASE_URL}/login">fuellinq.app</a>.</p>`
});
