import database from "infra/database.js";
import password from "models/password.js";
import { NotFoundError, ValidationError } from "infra/errors.js";

/**
 * @typedef {object} User
 * @property {string} id
 * @property {string} username
 * @property {string} email
 * @property {string} password
 * @property {Date} created_at
 * @property {Date} updated_at
 */

/**
 * Busca um único usuário pelo username (case-insensitive).
 *
 * @param {string} username - Username a ser buscado.
 * @returns {Promise<User>} Objeto do usuário encontrado.
 * @throws {NotFoundError} Se nenhum usuário for encontrado com esse username.
 */
async function findOneByUsername(username) {
  const userFound = await runSelectQuery(username);

  return userFound;

  /**
   * Executa o SELECT no banco e lança erro se não encontrar resultado.
   *
   * @param {string} username
   * @returns {Promise<User>} Primeira linha retornada pela query.
   * @throws {NotFoundError} Se rowCount for 0.
   */
  async function runSelectQuery(username) {
    const results = await database.query({
      text: `
        SELECT
          *
        FROM
          users
        WHERE
          LOWER(username) = LOWER($1)
        LIMIT
          1
        ;`,
      values: [username],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "O username informado não foi encontrado no sistema.",
        action: "Verifique se o username está digitado corretamente.",
      });
    }

    return results.rows[0];
  }
}

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
 * @returns {Promise<User>} Objeto do usuário recém-criado (todas as colunas via RETURNING *).
 * @throws {ValidationError} Email ou username já existem no banco.
 */
async function create(userInputValues) {
  await validateUniqueEmail(userInputValues.email);
  await validateUniqueUsername(userInputValues.username);
  await hashPasswordInObject(userInputValues);

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
   * Substitui a senha em texto puro pelo hash bcrypt dentro do próprio objeto.
   *
   * Mutação intencional: altera userInputValues.password in-place para que
   * o INSERT já receba o hash, nunca a senha original.
   *
   * @param {object} userInputValues - Objeto com os dados do usuário (é mutado).
   */
  async function hashPasswordInObject(userInputValues) {
    const hashedPassword = await password.hash(userInputValues.password);
    userInputValues.password = hashedPassword;
  }

  /**
   * Executa o INSERT no banco e retorna o usuário criado.
   *
   * @param {object} userInputValues
   * @returns {Promise<User>} Linha inserida retornada pelo RETURNING *.
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
  findOneByUsername,
};

export default user;
