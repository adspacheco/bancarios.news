import * as cookie from "cookie";
import session from "models/session.js";

import {
  InternalServerError,
  MethodNotAllowedError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
} from "infra/errors.js";

/**
 * Handler para quando a rota existe mas o método HTTP não é suportado.
 * Responde com 405 (Method Not Allowed).
 *
 * @param {import("http").IncomingMessage} request
 * @param {import("http").ServerResponse} response
 */
function onNoMatchHandler(request, response) {
  const publicErrorObject = new MethodNotAllowedError();
  response.status(publicErrorObject.statusCode).json(publicErrorObject);
}

/**
 * Handler global de erros. Se o erro for um `ValidationError` ou `NotFoundError`,
 * repassa direto com seu status code. Qualquer outro erro é encapsulado em um
 * `InternalServerError`.
 *
 * @param {Error} error - Erro capturado pelo next-connect.
 * @param {import("http").IncomingMessage} request
 * @param {import("http").ServerResponse} response
 */
function onErrorHandler(error, request, response) {
  if (
    error instanceof ValidationError ||
    error instanceof NotFoundError ||
    error instanceof UnauthorizedError
  ) {
    return response.status(error.statusCode).json(error);
  }

  const publicErrorObject = new InternalServerError({
    cause: error,
  });

  console.error(publicErrorObject);

  response.status(publicErrorObject.statusCode).json(publicErrorObject);
}

/**
 * Define o cookie `session_id` na resposta HTTP.
 *
 * Usa `httpOnly` para impedir acesso via JavaScript no browser (proteção contra XSS)
 * e `secure` em produção para trafegar apenas via HTTPS.
 * O `maxAge` é derivado da constante de expiração da sessão (30 dias).
 *
 * @param {string} sessionToken - Token da sessão para armazenar no cookie.
 * @param {import("http").ServerResponse} response - Objeto de resposta do Next.js.
 */
async function setSessionCookie(sessionToken, response) {
  const setCookie = cookie.serialize("session_id", sessionToken, {
    path: "/",
    maxAge: session.EXPIRATION_IN_MILLISECONDS / 1000,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });

  response.setHeader("Set-Cookie", setCookie);
}

const controller = {
  errorHandlers: {
    onNoMatch: onNoMatchHandler,
    onError: onErrorHandler,
  },
  setSessionCookie,
};

export default controller;
