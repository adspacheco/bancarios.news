import nodemailer from "nodemailer";

/**
 * Transporter do Nodemailer configurado via variáveis de ambiente.
 *
 * Em produção usa conexão segura (TLS); em desenvolvimento
 * conecta sem TLS (ex: MailCatcher na porta 1025).
 */
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SMTP_HOST,
  port: process.env.EMAIL_SMTP_PORT,
  auth: {
    user: process.env.EMAIL_SMTP_USER,
    pass: process.env.EMAIL_SMTP_PASSWORD,
  },
  secure: process.env.NODE_ENV === "production" ? true : false,
});

/**
 * Envia um email usando o transporter configurado.
 *
 * @param {import("nodemailer").SendMailOptions} mailOptions - Opções do email (from, to, subject, html, etc.).
 * @returns {Promise<void>}
 */
async function send(mailOptions) {
  await transporter.sendMail(mailOptions);
}

const email = {
  send,
};

export default email;
