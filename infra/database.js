import { Client } from "pg";

/**
 * Executa uma query no banco de dados PostgreSQL.
 *
 * @param {string | {text: string, values: Array}} queryInput - Query SQL simples como "SELECT * FROM users" ou query parametrizada como {text: "SELECT * FROM users WHERE name = $1", values: [userName]}.
 * @returns {Promise<{rows: Array<object>}>} Retorna um objeto que tem dentro dele uma propriedade chamada "rows", que é um array de objetos onde cada objeto é uma linha do resultado da query.
 */
async function query(queryInput) {
  let client;
  try {
    client = await getNewClient();
    const result = await client.query(queryInput);
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Cria e retorna um novo Client conectado ao PostgreSQL.
 * O chamador é responsável por encerrar a conexão com client.end().
 *
 * @returns {Promise<import("pg").Client>}
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
