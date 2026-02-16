import { InternalServerError, MethodNotAllowedError } from "infra/errors.js";

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
 * Handler global de erros. Encapsula qualquer erro não tratado em um
 * `InternalServerError` e responde com o status code apropriado.
 *
 * @param {Error} error - Erro capturado pelo next-connect.
 * @param {import("http").IncomingMessage} request
 * @param {import("http").ServerResponse} response
 */
function onErrorHandler(error, request, response) {
  const publicErrorObject = new InternalServerError({
    statusCode: error.statusCode,
    cause: error,
  });

  console.error(publicErrorObject);

  response.status(publicErrorObject.statusCode).json(publicErrorObject);
}

const controller = {
  errorHandlers: {
    onNoMatch: onNoMatchHandler,
    onError: onErrorHandler,
  },
};

export default controller;
