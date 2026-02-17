import retry from "async-retry";
import { faker } from "@faker-js/faker";
import database from "infra/database.js";
import migrator from "models/migrator.js";
import user from "models/user.js";

/**
 * Aguarda todos os serviços necessários estarem prontos antes de rodar os testes.
 *
 * Usa a biblioteca `async-retry` para ficar tentando até que cada
 * serviço responda com sucesso, evitando que os testes rodem antes
 * da infraestrutura estar de pé.
 */
async function waitForAllServices() {
  await waitForWebServer();

  /**
   * Aguarda o Web Server (Next.js) estar respondendo na porta 3000.
   *
   * Usa `async-retry` configurado com até 100 tentativas e intervalo
   * máximo de 1 segundo entre elas. Internamente, delega para
   * `fetchStatusPage` a verificação de cada tentativa.
   *
   * @returns {Promise<void>} Resolve quando o servidor responde com status 200.
   */
  async function waitForWebServer() {
    return retry(fetchStatusPage, {
      retries: 100,
      maxTimeout: 1000,
    });

    /**
     * Faz um fetch no endpoint `/api/v1/status` e verifica se o servidor
     * respondeu com HTTP 200.
     *
     * Se o status for diferente de 200 (ou o fetch falhar porque o servidor
     * ainda não subiu), lança um erro — e o `async-retry` captura esse erro
     * e tenta novamente, até esgotar as tentativas configuradas.
     *
     * @throws {Error} Lança erro se o status da resposta não for 200, sinalizando ao `async-retry` que deve tentar novamente.
     */
    async function fetchStatusPage() {
      const response = await fetch("http://localhost:3000/api/v1/status");

      if (response.status !== 200) {
        throw Error();
      }
    }
  }
}

/**
 * Limpa completamente o banco de dados, removendo todas as tabelas,
 * funções e dados existentes.
 *
 * Faz isso derrubando o schema `public` inteiro com `CASCADE`
 * (que remove tudo dentro dele em cadeia) e recriando-o vazio logo
 * em seguida, deixando o banco no estado inicial para o próximo teste.
 *
 * @returns {Promise<void>}
 */
async function clearDatabase() {
  await database.query("drop schema public cascade; create schema public;");
}

/**
 * Executa as migrações pendentes no banco de testes.
 *
 * @returns {Promise<void>}
 */
async function runPendingMigrations() {
  await migrator.runPendingMigrations();
}

/**
 * Cria um usuário no banco com dados gerados automaticamente pelo Faker.
 *
 * Cada campo (username, email, password) tem um valor padrão gerado,
 * mas pode ser sobrescrito via `userObject` — útil quando o teste
 * precisa de um valor específico (ex: testar username duplicado).
 *
 * O `replace(/[_.-]/g, "")` remove caracteres especiais que o Faker
 * pode gerar no username mas que não são válidos para o nosso sistema.
 *
 * @param {object} [userObject] - Campos opcionais para sobrescrever os padrões.
 * @param {string} [userObject.username] - Username desejado (padrão: gerado pelo Faker).
 * @param {string} [userObject.email] - Email desejado (padrão: gerado pelo Faker).
 * @param {string} [userObject.password] - Senha desejada (padrão: "validpassword").
 * @returns {Promise<import("models/user.js").User>} Objeto do usuário criado no banco.
 */
async function createUser(userObject) {
  return await user.create({
    username:
      userObject?.username || faker.internet.username().replace(/[_.-]/g, ""),
    email: userObject?.email || faker.internet.email(),
    password: userObject?.password || "validpassword",
  });
}

const orchestrator = {
  waitForAllServices,
  clearDatabase,
  runPendingMigrations,
  createUser,
};

export default orchestrator;
