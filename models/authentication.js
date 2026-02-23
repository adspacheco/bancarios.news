// Módulo de autenticação por email + senha.
//
// Estratégia de segurança: erros específicos (email não existe, senha errada)
// são convertidos em um UnauthorizedError genérico ("Dados de autenticação
// não conferem"). Isso impede enumeração de usuários — um atacante não
// consegue descobrir se um email existe no sistema testando credenciais.
//
// O fluxo usa dois níveis de try/catch:
// 1. Interno (findUserByEmail, validatePassword): converte NotFoundError
//    e senha incorreta em UnauthorizedError com mensagens específicas
//    (úteis para debugging interno, mas que nunca chegam ao cliente).
// 2. Externo (getAuthenticatedUser): captura qualquer UnauthorizedError
//    e re-lança com mensagem genérica — essa é a que o cliente recebe.
import user from "models/user.js";
import password from "models/password.js";
import { NotFoundError, UnauthorizedError } from "infra/errors.js";

/**
 * Autentica um usuário verificando email e senha.
 *
 * O fluxo converte erros específicos (NotFoundError, senha incorreta)
 * em um UnauthorizedError genérico para não revelar qual campo está errado.
 *
 * @param {string} providedEmail - Email enviado pelo cliente.
 * @param {string} providedPassword - Senha em texto puro enviada pelo cliente.
 * @returns {Promise<import("models/user.js").User>} Objeto do usuário autenticado.
 * @throws {UnauthorizedError} Se email ou senha não conferem.
 *
 * @example
 * // POST /api/v1/sessions (login)
 * const authenticatedUser = await authentication.getAuthenticatedUser(
 *   "fulano@email.com",
 *   "senhasegura123",
 * );
 * // Sucesso → retorna o objeto do usuário
 * // Falha   → UnauthorizedError genérico (sem dizer qual campo errou)
 */
async function getAuthenticatedUser(providedEmail, providedPassword) {
  try {
    const storedUser = await findUserByEmail(providedEmail);
    await validatePassword(providedPassword, storedUser.password);

    return storedUser;
  } catch (error) {
    // Catch externo: qualquer UnauthorizedError (vindo de findUserByEmail
    // ou validatePassword) é substituído por uma mensagem genérica.
    // Erros de outro tipo (ex: ServiceError do banco) passam direto.
    if (error instanceof UnauthorizedError) {
      throw new UnauthorizedError({
        message: "Dados de autenticação não conferem.",
        action: "Verifique se os dados enviados estão corretos.",
      });
    }

    throw error;
  }

  /**
   * Busca o usuário pelo email, convertendo NotFoundError em UnauthorizedError.
   *
   * A mensagem "Email não confere" é interna — nunca chega ao cliente,
   * pois o catch externo a substitui pela mensagem genérica.
   *
   * @param {string} providedEmail
   * @returns {Promise<import("models/user.js").User>}
   * @throws {UnauthorizedError} Se o email não for encontrado.
   */
  async function findUserByEmail(providedEmail) {
    let storedUser;

    try {
      storedUser = await user.findOneByEmail(providedEmail);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new UnauthorizedError({
          message: "Email não confere.",
          action: "Verifique se este dado está correto.",
        });
      }

      throw error;
    }

    return storedUser;
  }

  /**
   * Compara a senha fornecida com o hash armazenado via bcrypt.
   *
   * A mensagem "Senha não confere" é interna — nunca chega ao cliente,
   * pois o catch externo a substitui pela mensagem genérica.
   *
   * @param {string} providedPassword - Senha em texto puro.
   * @param {string} storedPassword - Hash bcrypt armazenado no banco.
   * @throws {UnauthorizedError} Se a senha não corresponder ao hash.
   */
  async function validatePassword(providedPassword, storedPassword) {
    const correctPasswordMatch = await password.compare(
      providedPassword,
      storedPassword,
    );

    if (!correctPasswordMatch) {
      throw new UnauthorizedError({
        message: "Senha não confere.",
        action: "Verifique se este dado está correto.",
      });
    }
  }
}

const authentication = {
  getAuthenticatedUser,
};

export default authentication;
