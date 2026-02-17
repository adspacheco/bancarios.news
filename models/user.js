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
 * Busca um único usuário pelo ID (UUID).
 *
 * @param {string} id - UUID do usuário a ser buscado.
 * @returns {Promise<User>} Objeto do usuário encontrado.
 * @throws {NotFoundError} Se nenhum usuário for encontrado com esse id.
 */
async function findOneById(id) {
  const userFound = await runSelectQuery(id);

  return userFound;

  /**
   * Executa o SELECT no banco e lança erro se não encontrar resultado.
   *
   * @param {string} id
   * @returns {Promise<User>} Primeira linha retornada pela query.
   * @throws {NotFoundError} Se rowCount for 0.
   */
  async function runSelectQuery(id) {
    const results = await database.query({
      text: `
        SELECT
          *
        FROM
          users
        WHERE
          id = $1
        LIMIT
          1
        ;`,
      values: [id],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "O id informado não foi encontrado no sistema.",
        action: "Verifique se o id está digitado corretamente.",
      });
    }

    return results.rows[0];
  }
}

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
 * Busca um único usuário pelo email (case-insensitive).
 *
 * @param {string} email - Email a ser buscado.
 * @returns {Promise<User>} Objeto do usuário encontrado.
 * @throws {NotFoundError} Se nenhum usuário for encontrado com esse email.
 */
async function findOneByEmail(email) {
  const userFound = await runSelectQuery(email);

  return userFound;

  /**
   * Executa o SELECT no banco e lança erro se não encontrar resultado.
   *
   * @param {string} email
   * @returns {Promise<User>} Primeira linha retornada pela query.
   * @throws {NotFoundError} Se rowCount for 0.
   */
  async function runSelectQuery(email) {
    const results = await database.query({
      text: `
        SELECT
          *
        FROM
          users
        WHERE
          LOWER(email) = LOWER($1)
        LIMIT
          1
        ;`,
      values: [email],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "O email informado não foi encontrado no sistema.",
        action: "Verifique se o email está digitado corretamente.",
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
  await validateUniqueUsername(userInputValues.username);
  await validateUniqueEmail(userInputValues.email);
  await hashPasswordInObject(userInputValues);

  const newUser = await runInsertQuery(userInputValues);
  return newUser;

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

/**
 * Atualiza os dados de um usuário existente.
 *
 * Busca o usuário atual pelo username, valida unicidade dos campos
 * alterados e mescla os novos valores com os existentes.
 *
 * @param {string} username - Username do usuário a ser atualizado.
 * @param {object} userInputValues - Campos a serem atualizados.
 * @returns {Promise<User>} Objeto do usuário atualizado.
 * @throws {NotFoundError} Se o username não for encontrado.
 * @throws {ValidationError} Se o novo username ou email já estiver em uso.
 */
async function update(username, userInputValues) {
  const currentUser = await findOneByUsername(username);

  if ("username" in userInputValues) {
    await validateUniqueUsername(userInputValues.username);
  }

  if ("email" in userInputValues) {
    await validateUniqueEmail(userInputValues.email);
  }

  if ("password" in userInputValues) {
    await hashPasswordInObject(userInputValues);
  }

  const userWithNewValues = { ...currentUser, ...userInputValues };

  const updatedUser = await runUpdateQuery(userWithNewValues);
  return updatedUser;

  /**
   * Executa o UPDATE no banco e retorna o usuário atualizado.
   *
   * @param {object} userWithNewValues
   * @returns {Promise<User>} Linha atualizada retornada pelo RETURNING *.
   */
  async function runUpdateQuery(userWithNewValues) {
    const results = await database.query({
      text: `
        UPDATE
          users
        SET
          username = $2,
          email = $3,
          password = $4,
          updated_at = timezone('utc', now())
        WHERE
          id = $1
        RETURNING
          *
      `,
      values: [
        userWithNewValues.id,
        userWithNewValues.username,
        userWithNewValues.email,
        userWithNewValues.password,
      ],
    });

    return results.rows[0];
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
      action: "Utilize outro username para realizar esta operação.",
    });
  }
}

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
      action: "Utilize outro email para realizar esta operação.",
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

const user = {
  create,
  findOneById,
  findOneByUsername,
  findOneByEmail,
  update,
};

export default user;
