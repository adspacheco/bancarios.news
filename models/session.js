// Gerenciamento do ciclo de vida das sessões de autenticação.
//
// Fluxo completo:
// 1. Login  → create()              → gera token + cookie
// 2. Request autenticado → findOneValidByToken() → valida sessão
//                        → renew()               → estende expiração
// 3. Logout → expireById()          → invalida sessão + limpa cookie
//
// As sessões não são deletadas do banco no logout — o expireById() joga o
// expires_at para o passado. Assim o registro permanece para auditoria,
// mas findOneValidByToken() não o encontra mais (filtra expires_at > NOW()).
import crypto from "node:crypto";
import database from "infra/database.js";
import { UnauthorizedError } from "infra/errors.js";

/**
 * @typedef {object} Session
 * @property {string} id - UUID v4 gerado automaticamente pelo banco.
 * @property {string} token - Token aleatório de 48 bytes em hex (96 caracteres).
 * @property {string} user_id - UUID do usuário dono da sessão (FK → users.id).
 * @property {Date} expires_at - Data de expiração (NOW() + 30 dias na criação).
 * @property {Date} created_at - Timestamp UTC da criação.
 * @property {Date} updated_at - Timestamp UTC da última atualização.
 */

/**
 * Tempo de expiração da sessão: 30 dias em milissegundos.
 * Usado aqui para calcular expires_at e no controller.js para o maxAge do cookie.
 *
 * @type {number}
 * @example
 * // 60s * 60m * 24h * 30d * 1000ms = 2.592.000.000 ms
 */
const EXPIRATION_IN_MILLISECONDS = 60 * 60 * 24 * 30 * 1000;

/**
 * Busca uma sessão válida (não expirada) pelo token.
 *
 * Filtra apenas sessões cujo `expires_at` ainda não passou,
 * garantindo que sessões expiradas sejam ignoradas.
 *
 * @param {string} sessionToken - Token de sessão (96 caracteres hex).
 * @returns {Promise<Session>} Objeto da sessão encontrada.
 * @throws {UnauthorizedError} Se nenhuma sessão ativa for encontrada com esse token.
 *
 * @example
 * const validSession = await session.findOneValidByToken(cookieToken);
 * // Se o token for inválido ou expirado → UnauthorizedError
 */
async function findOneValidByToken(sessionToken) {
  const sessionFound = await runSelectQuery(sessionToken);

  return sessionFound;

  /**
   * Executa o SELECT no banco filtrando por token e expiração.
   *
   * @param {string} sessionToken
   * @returns {Promise<Session>} Primeira linha retornada pela query.
   * @throws {UnauthorizedError} Se rowCount for 0 (token inválido ou expirado).
   */
  async function runSelectQuery(sessionToken) {
    const results = await database.query({
      text: `
        SELECT
          *
        FROM
          sessions
        WHERE
          token = $1
          AND expires_at > NOW()
        LIMIT
          1
      ;`,
      values: [sessionToken],
    });

    if (results.rowCount === 0) {
      throw new UnauthorizedError({
        message: "Usuário não possui sessão ativa.",
        action: "Verifique se este usuário está logado e tente novamente.",
      });
    }

    return results.rows[0];
  }
}

/**
 * Cria uma nova sessão para o usuário com token aleatório e expiração de 30 dias.
 *
 * @param {string} userId - ID do usuário dono da sessão.
 * @returns {Promise<Session>} Objeto da sessão recém-criada (todas as colunas via RETURNING *).
 *
 * @example
 * const newSession = await session.create(user.id);
 * // newSession.token → "a3f1b2..." (96 chars hex)
 */
async function create(userId) {
  // randomBytes(48) gera 48 bytes aleatórios. Cada byte vira 2 caracteres
  // hex, resultando em um token de 96 caracteres — suficiente para ser
  // criptograficamente seguro e impossível de adivinhar por brute-force.
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + EXPIRATION_IN_MILLISECONDS);

  const newSession = await runInsertQuery(token, userId, expiresAt);
  return newSession;

  /**
   * Executa o INSERT no banco e retorna a sessão criada.
   *
   * @param {string} token
   * @param {string} userId
   * @param {Date} expiresAt
   * @returns {Promise<Session>} Linha inserida retornada pelo RETURNING *.
   */
  async function runInsertQuery(token, userId, expiresAt) {
    const results = await database.query({
      text: `
        INSERT INTO
          sessions (token, user_id, expires_at)
        VALUES
          ($1, $2, $3)
        RETURNING
          *
      ;`,
      values: [token, userId, expiresAt],
    });

    return results.rows[0];
  }
}

/**
 * Renova a expiração de uma sessão existente por mais 30 dias.
 *
 * Atualiza `expires_at` e `updated_at` no banco, mantendo o mesmo token.
 * Útil para manter o usuário logado enquanto ele continua ativo.
 *
 * @param {string} sessionId - UUID da sessão a ser renovada.
 * @returns {Promise<Session>} Objeto da sessão com a nova data de expiração.
 *
 * @example
 * // Chamado a cada request autenticado em GET /api/v1/user
 * const renewed = await session.renew(currentSession.id);
 */
async function renew(sessionId) {
  const expiresAt = new Date(Date.now() + EXPIRATION_IN_MILLISECONDS);

  const renewedSessionObject = await runUpdateQuery(sessionId, expiresAt);
  return renewedSessionObject;

  /**
   * Executa o UPDATE no banco e retorna a sessão renovada.
   *
   * @param {string} sessionId
   * @param {Date} expiresAt
   * @returns {Promise<Session>} Linha atualizada retornada pelo RETURNING *.
   */
  async function runUpdateQuery(sessionId, expiresAt) {
    const results = await database.query({
      text: `
        UPDATE
          sessions
        SET
          expires_at = $2,
          updated_at = NOW()
        WHERE
          id = $1
        RETURNING
          *
        ;`,
      values: [sessionId, expiresAt],
    });

    return results.rows[0];
  }
}

/**
 * Expira uma sessão existente subtraindo 1 ano do `expires_at`.
 *
 * Usado no logout para invalidar a sessão imediatamente.
 * A subtração garante que o `expires_at` fique no passado,
 * fazendo com que `findOneValidByToken` não a encontre mais
 * (que filtra `expires_at > NOW()`).
 *
 * Por que não deletar? Manter o registro permite auditoria futura
 * (quando o usuário logou, quando deslogou) sem perder dados.
 *
 * @param {string} sessionId - UUID da sessão a ser expirada.
 * @returns {Promise<Session>} Objeto da sessão com a data de expiração no passado.
 *
 * @example
 * // DELETE /api/v1/sessions (logout)
 * const expired = await session.expireById(currentSession.id);
 */
async function expireById(sessionId) {
  const expiredSessionObject = await runUpdateQuery(sessionId);
  return expiredSessionObject;

  /**
   * Executa o UPDATE no banco subtraindo 1 ano do `expires_at`.
   *
   * @param {string} sessionId
   * @returns {Promise<Session>} Linha atualizada retornada pelo RETURNING *.
   */
  async function runUpdateQuery(sessionId) {
    const results = await database.query({
      text: `
        UPDATE
          sessions
        SET
          expires_at = expires_at - interval '1 year',
          updated_at = NOW()
        WHERE
          id = $1
        RETURNING
          *
        ;`,
      values: [sessionId],
    });

    return results.rows[0];
  }
}

const session = {
  create,
  findOneValidByToken,
  renew,
  expireById,
  EXPIRATION_IN_MILLISECONDS,
};

export default session;
