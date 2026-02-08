import { Client } from "pg";

/**
 * Executa uma query no banco de dados PostgreSQL.
 *
 * @param {string | {text: string, values: Array}} queryInput - Query SQL simples como "SELECT * FROM users" ou query parametrizada como {text: "SELECT * FROM users WHERE name = $1", values: [userName]}.
 * @returns {Promise<{rows: Array<object>}>} Retorna um objeto que tem dentro dele uma propriedade chamada "rows", que é um array de objetos onde cada objeto é uma linha do resultado da query.
 */
async function query(queryInput) {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.NODE_ENV === "development" ? false : true,
  });

  try {
    await client.connect();
    const result = await client.query(queryInput);
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    await client.end();
  }
}

export default {
  query: query,
};
