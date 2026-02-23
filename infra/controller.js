// Utilitários compartilhados entre todas as rotas da API.
//
// - errorHandlers: objeto passado direto ao next-connect, que usa onNoMatch
//   (método HTTP errado) e onError (qualquer throw dentro de um handler).
// - setSessionCookie / clearSessionCookie: gerenciam o cookie de sessão.
//
// Quando response.json(error) é chamado nos handlers, o JSON.stringify
// interno encontra o toJSON() das nossas classes de erro (infra/errors.js)
// e serializa apenas { name, message, action, status_code }.
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
 *
 * @example
 * // Passado ao next-connect via router.handler(controller.errorHandlers):
 * const router = createRouter();
 * export default router.handler(controller.errorHandlers);
 * // DELETE /api/v1/status → 405 { name: "MethodNotAllowedError", ... }
 */
function onNoMatchHandler(request, response) {
  const publicErrorObject = new MethodNotAllowedError();
  response.status(publicErrorObject.statusCode).json(publicErrorObject);
}

/**
 * Handler global de erros. Toda exceção lançada dentro de um handler do
 * next-connect cai aqui. A cascata de instanceof decide o tratamento:
 *
 * 1. ValidationError / NotFoundError → repassa direto com seu status code.
 * 2. UnauthorizedError → limpa o cookie de sessão antes de responder,
 *    invalidando a sessão no browser.
 * 3. Qualquer outro erro → encapsula num InternalServerError (500) e loga
 *    no console para debugging. O erro original fica em cause, mas o
 *    cliente recebe apenas a mensagem genérica (sem detalhes internos).
 *
 * @param {Error} error - Erro capturado pelo next-connect.
 * @param {import("http").IncomingMessage} request
 * @param {import("http").ServerResponse} response
 */
function onErrorHandler(error, request, response) {
  // Erros de validação e not found: o cliente enviou algo errado,
  // então a mensagem específica pode ir direto na resposta.
  if (error instanceof ValidationError || error instanceof NotFoundError) {
    return response.status(error.statusCode).json(error);
  }

  // Não autenticado: além de responder 401, limpa o cookie para
  // que o browser não reenvie um token inválido nas próximas requests.
  if (error instanceof UnauthorizedError) {
    clearSessionCookie(response);
    return response.status(error.statusCode).json(error);
  }

  // Qualquer erro não previsto vira 500. O console.error preserva o
  // stack trace para debugging, mas o cliente recebe só a mensagem genérica.
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
 *
 * @example
 * const newSession = await session.create(user.id);
 * await controller.setSessionCookie(newSession.token, response);
 */
async function setSessionCookie(sessionToken, response) {
  const setCookie = cookie.serialize("session_id", sessionToken, {
    path: "/",
    // maxAge do cookie espera segundos, mas a constante está em milissegundos,
    // então dividimos por 1000 para converter (30 dias em ms → 30 dias em s).
    maxAge: session.EXPIRATION_IN_MILLISECONDS / 1000,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });

  response.setHeader("Set-Cookie", setCookie);
}

/**
 * Remove o cookie `session_id` da resposta HTTP.
 *
 * Define o cookie com valor "invalid" e `maxAge` negativo,
 * instruindo o browser a descartá-lo imediatamente.
 *
 * @param {import("http").ServerResponse} response - Objeto de resposta do Next.js.
 *
 * @example
 * // Chamado no logout (DELETE /api/v1/sessions) e automaticamente
 * // pelo onErrorHandler quando o erro é UnauthorizedError.
 * await controller.clearSessionCookie(response);
 */
async function clearSessionCookie(response) {
  const setCookie = cookie.serialize("session_id", "invalid", {
    path: "/",
    // maxAge negativo instrui o browser a descartar o cookie imediatamente.
    maxAge: -1,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });

  response.setHeader("Set-Cookie", setCookie);
}

const controller = {
  // Objeto passado ao router.handler() do next-connect nas rotas da API:
  // export default router.handler(controller.errorHandlers)
  errorHandlers: {
    onNoMatch: onNoMatchHandler,
    onError: onErrorHandler,
  },
  setSessionCookie,
  clearSessionCookie,
};

export default controller;
