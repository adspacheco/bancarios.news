import { Client } from "pg";
import { ServiceError } from "./errors.js";

/**
 * Executa uma query no banco de dados PostgreSQL.
 *
 * @param {string | {text: string, values: Array}} queryInput - Query SQL simples ou parametrizada.
 * @returns {Promise<{rows: Array<object>}>} Retorna um objeto que tem dentro dele uma propriedade chamada "rows", que é um array de objetos onde cada objeto é uma linha do resultado da query.
 * @throws {ServiceError} Erro na conexão com o banco ou na execução da query.
 *
 * @example
 * // Query simples
 * const result = await database.query("SELECT 1 + 1 AS sum");
 * console.log(result.rows); // [{ sum: 2 }]
 *
 * @example
 * // Query parametrizada (rows[0] para pegar o primeiro resultado)
 * const result = await database.query({
 *   text: "SELECT * FROM users WHERE email = $1",
 *   values: ["user@email.com"],
 * });
 * console.log(result.rows[0]); // { id: "uuid", username: "fulano", ... }
 */
async function query(queryInput) {
  let client;
  try {
    client = await getNewClient();
    const result = await client.query(queryInput);
    return result;
  } catch (error) {
    const serviceErrorObject = new ServiceError({
      message: "Erro na conexão com Banco ou na Query.",
      cause: error,
    });
    throw serviceErrorObject;
  } finally {
    await client?.end();
  }
}

/**
 * Cria e retorna um novo Client conectado ao PostgreSQL.
 * O chamador é responsável por encerrar a conexão com client.end().
 *
 * @returns {Promise<import("pg").Client>}
 * @throws {Error} Se não conseguir conectar ao PostgreSQL.
 *
 * @example
 * const client = await database.getNewClient();
 * try {
 *   const result = await client.query("SELECT NOW()");
 * } finally {
 *   await client.end();
 * }
 */
async function getNewClient() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    ssl: getSSLValues(),
  });

  await client.connect();
  return client;
}

const database = {
  query,
  getNewClient,
};

export default database;

/**
 * @private
 * Retorna a configuração SSL para conexão com o PostgreSQL.
 *
 * - Se a variável POSTGRES_CA existir (DigitalOcean p.ex), retorna o certificado e ignora o restante.
 * - Se não existir e o ambiente for desenvolvimento, retorna false (sem SSL).
 * - Se não existir e o ambiente for produção, retorna true (SSL padrão).
 *
 * @returns {boolean | {ca: string}} Objeto com certificado CA se disponível, true para produção ou false para desenvolvimento.
 */
function getSSLValues() {
  if (process.env.POSTGRES_CA) {
    return {
      ca: process.env.POSTGRES_CA,
    };
  }

  return process.env.NODE_ENV === "production" ? true : false;
}
