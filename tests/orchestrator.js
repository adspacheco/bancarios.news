import retry from "async-retry";
import { faker } from "@faker-js/faker";
import database from "infra/database.js";
import migrator from "models/migrator.js";
import user from "models/user.js";
import session from "models/session.js";

const emailHttpUrl = `http://${process.env.EMAIL_HTTP_HOST}:${process.env.EMAIL_HTTP_PORT}`;

/**
 * Aguarda todos os serviços necessários estarem prontos antes de rodar os testes.
 *
 * Usa a biblioteca `async-retry` para ficar tentando até que cada
 * serviço responda com sucesso, evitando que os testes rodem antes
 * da infraestrutura estar de pé.
 */
async function waitForAllServices() {
  await waitForWebServer();
  await waitForEmailServer();

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
 * Aguarda o servidor de email (MailCatcher) estar respondendo.
 *
 * Usa `async-retry` configurado com até 100 tentativas e intervalo
 * máximo de 1 segundo entre elas.
 *
 * @returns {Promise<void>} Resolve quando o servidor responde com status 200.
 */
async function waitForEmailServer() {
  return retry(fetchEmailPage, {
    retries: 100,
    maxTimeout: 1000,
  });

  /**
   * Faz um fetch na interface HTTP do MailCatcher e verifica se
   * respondeu com HTTP 200.
   *
   * @throws {Error} Lança erro se o status não for 200, sinalizando ao `async-retry` que deve tentar novamente.
   */
  async function fetchEmailPage() {
    const response = await fetch(emailHttpUrl);

    if (response.status !== 200) {
      throw Error();
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
 * Deleta todos os emails do MailCatcher.
 *
 * Útil para limpar a caixa de entrada entre testes,
 * garantindo que `getLastEmail` retorne apenas emails
 * gerados pelo teste atual.
 *
 * @returns {Promise<void>}
 */
async function deleteAllEmails() {
  await fetch(`${emailHttpUrl}/messages`, {
    method: "DELETE",
  });
}

/**
 * Retorna o último email recebido pelo MailCatcher, incluindo o corpo em texto plano.
 *
 * Busca a lista de mensagens, pega a última, e faz uma segunda
 * requisição para obter o conteúdo em texto plano (`.plain`),
 * anexando-o ao objeto como propriedade `text`.
 *
 * @returns {Promise<object>} Objeto do email com metadados do MailCatcher e propriedade `text` com o corpo em texto plano.
 */
async function getLastEmail() {
  const emailListResponse = await fetch(`${emailHttpUrl}/messages`);
  const emailListBody = await emailListResponse.json();
  const lastEmailItem = emailListBody.pop();

  const emailTextResponse = await fetch(
    `${emailHttpUrl}/messages/${lastEmailItem.id}.plain`,
  );
  const emailTextBody = await emailTextResponse.text();

  lastEmailItem.text = emailTextBody;
  return lastEmailItem;
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

/**
 * Cria uma sessão para o usuário informado.
 *
 * Wrapper sobre `session.create()` para simplificar a criação
 * de sessões nos testes sem repetir imports.
 *
 * @param {string} userId - UUID do usuário dono da sessão.
 * @returns {Promise<import("models/session.js").Session>} Objeto da sessão criada.
 */
async function createSession(userId) {
  return await session.create(userId);
}

const orchestrator = {
  waitForAllServices,
  clearDatabase,
  runPendingMigrations,
  createUser,
  createSession,
  deleteAllEmails,
  getLastEmail,
};

export default orchestrator;
