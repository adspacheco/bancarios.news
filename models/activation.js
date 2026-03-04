// Gerenciamento de tokens de ativação de conta.
//
// Cada novo cadastro gera um token com validade de 15 minutos.
// O token é enviado por email ao usuário e, ao ser acessado,
// ativa a conta. Tokens expirados ou já utilizados são rejeitados.
//
// Padrões usados neste módulo:
// - Cada função pública delega a query SQL para uma função aninhada
//   (runSelectQuery, runInsertQuery), separando lógica de negócio do SQL.
// - Todas as queries usam parâmetros ($1, $2) para evitar SQL injection.
import email from "infra/email.js";
import database from "infra/database.js";
import webserver from "infra/webserver.js";
import { NotFoundError } from "infra/errors.js";

const EXPIRATION_IN_MILLISECONDS = 60 * 15 * 1000; // 15 minutes

/**
 * @typedef {object} ActivationToken
 * @property {string} id - UUID v4 gerado automaticamente pelo banco.
 * @property {string} user_id - UUID do usuário dono do token.
 * @property {Date|null} used_at - Timestamp de quando o token foi usado, ou null se ainda não foi.
 * @property {Date} expires_at - Timestamp de expiração do token.
 * @property {Date} created_at - Timestamp UTC da criação.
 * @property {Date} updated_at - Timestamp UTC da última atualização.
 */

/**
 * Busca um token de ativação válido pelo ID.
 *
 * Um token é considerado válido quando existe no banco, ainda não
 * expirou (`expires_at > NOW()`) e não foi utilizado (`used_at IS NULL`).
 *
 * @param {string} tokenId - UUID do token a ser buscado.
 * @returns {Promise<ActivationToken>} Objeto do token encontrado.
 * @throws {NotFoundError} Se o token não existir, estiver expirado ou já tiver sido usado.
 *
 * @example
 * const token = await activation.findOneValidById("uuid-do-token");
 */
async function findOneValidById(tokenId) {
  const activationTokenObject = await runSelectQuery(tokenId);

  return activationTokenObject;

  /**
   * Executa o SELECT no banco e lança erro se não encontrar resultado.
   *
   * @param {string} tokenId
   * @returns {Promise<ActivationToken>} Primeira linha retornada pela query.
   * @throws {NotFoundError} Se rowCount for 0.
   */
  async function runSelectQuery(tokenId) {
    const results = await database.query({
      text: `
       SELECT
         *
       FROM
         user_activation_tokens
       WHERE
         id = $1
         AND expires_at > NOW()
         AND used_at IS NULL
       LIMIT
         1
     ;`,
      values: [tokenId],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message:
          "O token de ativação utilizado não foi encontrado no sistema ou expirou.",
        action: "Faça um novo cadastro.",
      });
    }

    return results.rows[0];
  }
}

/**
 * Cria um novo token de ativação para o usuário informado.
 *
 * O token expira após 15 minutos (EXPIRATION_IN_MILLISECONDS).
 *
 * @param {string} userId - UUID do usuário para quem o token será criado.
 * @returns {Promise<ActivationToken>} Objeto do token recém-criado.
 *
 * @example
 * const token = await activation.create(newUser.id);
 */
async function create(userId) {
  const expiresAt = new Date(Date.now() + EXPIRATION_IN_MILLISECONDS);

  const newToken = await runInsertQuery(userId, expiresAt);
  return newToken;

  /**
   * Executa o INSERT no banco e retorna o token criado.
   *
   * @param {string} userId
   * @param {Date} expiresAt
   * @returns {Promise<ActivationToken>} Linha inserida retornada pelo RETURNING *.
   */
  async function runInsertQuery(userId, expiresAt) {
    const results = await database.query({
      text: `
        INSERT INTO
          user_activation_tokens (user_id, expires_at)
        VALUES
          ($1, $2)
        RETURNING
          *
      ;`,
      values: [userId, expiresAt],
    });

    return results.rows[0];
  }
}

/**
 * Envia o email de ativação de conta para o usuário.
 *
 * O email contém um link com o token de ativação que direciona
 * o usuário para a página de ativação do cadastro.
 *
 * @param {import("models/user.js").User} user - Objeto do usuário destinatário.
 * @param {ActivationToken} activationToken - Token de ativação gerado para o usuário.
 * @returns {Promise<void>}
 *
 * @example
 * const token = await activation.create(newUser.id);
 * await activation.sendEmailToUser(newUser, token);
 */
async function sendEmailToUser(user, activationToken) {
  await email.send({
    from: "BancáriosNews <contato@bancarios.news>",
    to: user.email,
    subject: "Ative seu cadastro no BancáriosNews!",
    text: `${user.username}, clique no link abaixo para ativar seu cadastro no BancáriosNews:

${webserver.origin}/cadastro/ativar/${activationToken.id}

Atenciosamente,
Equipe BancáriosNews`,
  });
}

const activation = {
  findOneValidById,
  create,
  sendEmailToUser,
};

export default activation;
