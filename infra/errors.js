// Classes de erro customizadas para padronizar as respostas HTTP da API.
//
// Todas seguem a mesma estrutura:
// - Estendem Error nativo do JavaScript (para funcionar com throw/catch).
// - Recebem parâmetros via objeto desestruturado ({ message, cause, action }).
// - cause: armazena o erro original para debugging (não vai pro cliente).
// - action: instrução amigável dizendo o que o usuário pode fazer.
// - statusCode: código HTTP que o controller usa para montar a resposta.
// - toJSON(): converte o erro em um objeto limpo para resposta da API,
//   expondo apenas name, message, action e status_code (sem stack trace).
//
// Por que toJSON() é necessário?
// O JSON.stringify() só serializa propriedades enumeráveis de um objeto.
// As propriedades padrão do Error (name, message, stack) são NÃO enumeráveis,
// então JSON.stringify(new Error("falhou")) retorna apenas "{}".
// O toJSON() resolve isso: quando o JSON.stringify() encontra um objeto
// que tem toJSON(), ele chama esse método e serializa o que ele retornar,
// nos dando controle total sobre o que vai na resposta da API.
//
// O controller.js chama toJSON() no error handler global (onError),
// garantindo que toda resposta de erro siga o mesmo formato:
// { name, message, action, status_code }

/**
 * Erro genérico para falhas internas inesperadas.
 * Encapsula o erro original em `cause` e responde com status 500 por padrão.
 *
 * @extends {Error}
 *
 * @example
 * throw new InternalServerError({ cause: originalError });
 * // Resposta: { name: "InternalServerError", message: "Um erro interno...", action: "Entre em contato...", status_code: 500 }
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

  /**
   * Converte o erro em objeto para resposta da API.
   * Expõe apenas informações seguras (sem stack trace ou cause).
   *
   * @returns {{ name: string, message: string, action: string, status_code: number }}
   */
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
 *
 * @example
 * throw new ServiceError({
 *   message: "Erro na conexão com Banco ou na Query.",
 *   cause: originalError,
 * });
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

  /** @see InternalServerError.prototype.toJSON */
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
 *
 * @example
 * throw new ValidationError({
 *   message: "O username informado já está sendo utilizado.",
 *   action: "Utilize outro username para realizar o cadastro.",
 * });
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

  /** @see InternalServerError.prototype.toJSON */
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
 * Erro para quando o recurso solicitado não foi encontrado no sistema.
 * Responde com status 404.
 *
 * @extends {Error}
 *
 * @example
 * throw new NotFoundError({
 *   message: "O username informado não foi encontrado no sistema.",
 * });
 */
export class NotFoundError extends Error {
  /**
   * @param {object} params
   * @param {Error} [params.cause] - Erro original que causou a falha.
   * @param {string} [params.message="Não foi possível encontrar este recurso no sistema."] - Mensagem descritiva do erro.
   * @param {string} [params.action="Verifique se os parâmetros enviados na consulta estão certos."] - Instrução para o cliente corrigir o problema.
   */
  constructor({ cause, message, action }) {
    super(message || "Não foi possível encontrar este recurso no sistema.", {
      cause,
    });
    this.name = "NotFoundError";
    this.action =
      action || "Verifique se os parâmetros enviados na consulta estão certos.";
    this.statusCode = 404;
  }

  /** @see InternalServerError.prototype.toJSON */
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
 * Erro para quando o usuário não está autenticado ou as credenciais são inválidas.
 * Responde com status 401.
 *
 * No controller.js, este erro tem um tratamento especial: além de responder
 * com 401, o error handler limpa o cookie de sessão automaticamente.
 *
 * @extends {Error}
 *
 * @example
 * throw new UnauthorizedError({
 *   message: "Usuário não autenticado.",
 *   action: "Faça novamente o login para continuar.",
 * });
 */
export class UnauthorizedError extends Error {
  /**
   * @param {object} params
   * @param {Error} [params.cause] - Erro original que causou a falha.
   * @param {string} [params.message="Usuário não autenticado."] - Mensagem descritiva do erro.
   * @param {string} [params.action="Faça novamente o login para continuar."] - Instrução para o cliente.
   */
  constructor({ cause, message, action }) {
    super(message || "Usuário não autenticado.", {
      cause,
    });
    this.name = "UnauthorizedError";
    this.action = action || "Faça novamente o login para continuar.";
    this.statusCode = 401;
  }

  /** @see InternalServerError.prototype.toJSON */
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
 * Diferente das outras classes, não recebe parâmetros — a mensagem e a action
 * são sempre fixas, pois o contexto é sempre o mesmo (método HTTP errado).
 *
 * @extends {Error}
 *
 * @example
 * // Usado no controller.js como handler do onNoMatch do next-connect
 * onNoMatch: (request, response) => { throw new MethodNotAllowedError(); }
 */
export class MethodNotAllowedError extends Error {
  constructor() {
    super("Método não permitido para este endpoint.");
    this.name = "MethodNotAllowedError";
    this.action =
      "Verifique se o método HTTP enviado é válido para este endpoint.";
    this.statusCode = 405;
  }

  /** @see InternalServerError.prototype.toJSON */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.statusCode,
    };
  }
}
