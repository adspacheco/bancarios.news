import database from "infra/database.js";
import { ValidationError } from "infra/errors.js";

/**
 * Cria um novo usuário no banco após validar unicidade de email e username.
 *
 * As validações são feitas antes do INSERT para retornar mensagens
 * específicas ao cliente (em vez de depender de erros genéricos do banco).
 *
 * @param {object} userInputValues
 * @param {string} userInputValues.username
 * @param {string} userInputValues.email
 * @param {string} userInputValues.password
 * @returns {Promise<object>} Objeto do usuário recém-criado (todas as colunas via RETURNING *).
 * @throws {ValidationError} Email ou username já existem no banco.
 */
async function create(userInputValues) {
  await validateUniqueEmail(userInputValues.email);
  await validateUniqueUsername(userInputValues.username);

  const newUser = await runInsertQuery(userInputValues);
  return newUser;

  /**
   * Verifica se já existe um usuário com o mesmo email (case-insensitive).
   *
   * @param {string} email
   * @throws {ValidationError} Se o email já estiver em uso.
   */
  async function validateUniqueEmail(email) {
    const results = await database.query({
      text: `
        SELECT
          email
        FROM
          users
        WHERE
          LOWER(email) = LOWER($1)
        ;`,
      values: [email],
    });

    if (results.rowCount > 0) {
      throw new ValidationError({
        message: "O email informado já está sendo utilizado.",
        action: "Utilize outro email para realizar o cadastro.",
      });
    }
  }

  /**
   * Verifica se já existe um usuário com o mesmo username (case-insensitive).
   *
   * @param {string} username
   * @throws {ValidationError} Se o username já estiver em uso.
   */
  async function validateUniqueUsername(username) {
    const results = await database.query({
      text: `
        SELECT
          username
        FROM
          users
        WHERE
          LOWER(username) = LOWER($1)
        ;`,
      values: [username],
    });

    if (results.rowCount > 0) {
      throw new ValidationError({
        message: "O username informado já está sendo utilizado.",
        action: "Utilize outro username para realizar o cadastro.",
      });
    }
  }

  /**
   * Executa o INSERT no banco e retorna o usuário criado.
   *
   * @param {object} userInputValues
   * @returns {Promise<object>} Linha inserida retornada pelo RETURNING *.
   */
  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
        INSERT INTO
          users (username, email, password)
        VALUES
          ($1, $2, $3)
        RETURNING
          *
        ;`,
      values: [
        userInputValues.username,
        userInputValues.email,
        userInputValues.password,
      ],
    });
    return results.rows[0];
  }
}

const user = {
  create,
};

export default user;
