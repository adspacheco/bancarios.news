// Módulo de envio de emails via SMTP usando Nodemailer.
//
// O transporter é configurado uma vez na inicialização e reutilizado
// em todas as chamadas de send(). A diferença entre ambientes:
//
// - Desenvolvimento: conecta no MailCatcher (porta 1025 SMTP, 1080 HTTP).
//   O MailCatcher intercepta todos os emails sem enviá-los de verdade,
//   permitindo inspecionar o conteúdo pela interface web (localhost:1080).
//   Não usa TLS (secure: false) pois é tráfego local.
//
// - Produção: conecta no servidor SMTP real com TLS (secure: true),
//   garantindo que credenciais e conteúdo trafeguem criptografados.
import nodemailer from "nodemailer";

/**
 * Transporter do Nodemailer configurado via variáveis de ambiente.
 *
 * @type {import("nodemailer").Transporter}
 */
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SMTP_HOST,
  port: process.env.EMAIL_SMTP_PORT,
  // Credenciais SMTP. Em dev o MailCatcher aceita qualquer valor;
  // em produção são as credenciais reais do provedor de email.
  auth: {
    user: process.env.EMAIL_SMTP_USER,
    pass: process.env.EMAIL_SMTP_PASSWORD,
  },
  // TLS: true em produção (criptografa a conexão), false em dev
  // (MailCatcher não suporta TLS e não precisa, pois é local).
  secure: process.env.NODE_ENV === "production" ? true : false,
});

/**
 * Envia um email usando o transporter configurado.
 *
 * @param {import("nodemailer").SendMailOptions} mailOptions - Opções do email (from, to, subject, html, etc.).
 * @returns {Promise<void>}
 * @throws {Error} Se a conexão SMTP falhar ou o envio for rejeitado.
 *
 * @example
 * await email.send({
 *   from: "noreply@bancarios.news",
 *   to: "fulano@email.com",
 *   subject: "Recuperação de senha",
 *   html: "<p>Seu link de recuperação: ...</p>",
 * });
 */
async function send(mailOptions) {
  await transporter.sendMail(mailOptions);
}

const email = {
  send,
};

export default email;
