/**
 * Erro genérico para falhas internas inesperadas.
 * Encapsula o erro original em `cause` e responde com status 500 por padrão.
 *
 * @extends {Error}
 */
export class InternalServerError extends Error {
  /**
   * @param {object} params
   * @param {Error} [params.cause] - Erro original que causou a falha.
   * @param {number} [params.statusCode=500] - Código HTTP de resposta.
   */
  constructor({ cause, statusCode }) {
    super("Um erro interno não esperado aconteceu.", {
      cause,
    });
    this.name = "InternalServerError";
    this.action = "Entre em contato com o suporte.";
    this.statusCode = statusCode || 500;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.statusCode,
    };
  }
}

/**
 * Erro para quando um serviço externo (banco de dados, API, etc.) está indisponível.
 * Responde com status 503.
 *
 * @extends {Error}
 */
export class ServiceError extends Error {
  /**
   * @param {object} params
   * @param {Error} [params.cause] - Erro original vindo do serviço.
   * @param {string} [params.message="Serviço indisponível no momento."] - Mensagem descritiva do erro.
   */
  constructor({ cause, message }) {
    super(message || "Serviço indisponível no momento.", {
      cause,
    });
    this.name = "ServiceError";
    this.action = "Verifique se o serviço está disponível.";
    this.statusCode = 503;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.statusCode,
    };
  }
}

/**
 * Erro para quando os dados enviados pelo cliente são inválidos.
 * Responde com status 400.
 *
 * @extends {Error}
 */
export class ValidationError extends Error {
  /**
   * @param {object} params
   * @param {Error} [params.cause] - Erro original que causou a validação.
   * @param {string} [params.message="Um erro de validação ocorreu."] - Mensagem descritiva do erro.
   * @param {string} [params.action="Ajuste os dados enviados e tente novamente."] - Instrução para o cliente corrigir o problema.
   */
  constructor({ cause, message, action }) {
    super(message || "Um erro de validação ocorreu.", {
      cause,
    });
    this.name = "ValidationError";
    this.action = action || "Ajuste os dados enviados e tente novamente.";
    this.statusCode = 400;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.statusCode,
    };
  }
}

/**
 * Erro para quando o cliente usa um método HTTP não suportado pelo endpoint.
 * Responde com status 405.
 *
 * @extends {Error}
 */
export class MethodNotAllowedError extends Error {
  constructor() {
    super("Método não permitido para este endpoint.");
    this.name = "MethodNotAllowedError";
    this.action =
      "Verifique se o método HTTP enviado é válido para este endpoint.";
    this.statusCode = 405;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.statusCode,
    };
  }
}
