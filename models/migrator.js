// Módulo responsável por gerenciar as migrations do banco de dados.
//
// Migrations são arquivos que descrevem alterações incrementais no schema
// do banco (criar tabela, adicionar coluna, etc.). O node-pg-migrate lê
// esses arquivos da pasta infra/migrations/ e compara com a tabela
// pgmigrations no banco para saber quais já foram executadas.
//
// As duas funções exportadas usam database.getNewClient() em vez de
// database.query() porque o migrationRunner precisa receber o client
// diretamente para gerenciar a conexão e as transações internamente.
import migrationRunner from "node-pg-migrate";
import { resolve } from "node:path";
import database from "infra/database.js";
import { ServiceError } from "infra/errors.js";

/**
 * Configurações padrão para o node-pg-migrate.
 *
 * - dryRun: true por padrão para que listagens não apliquem mudanças no banco.
 * - dir: caminho absoluto da pasta onde ficam os arquivos de migração.
 * - direction: "up" aplica migrações pendentes (o oposto seria "down" para reverter).
 * - log: função vazia para silenciar o output interno do runner.
 * - migrationsTable: tabela no banco que registra quais migrações já foram executadas.
 *
 * @type {import("node-pg-migrate").RunnerOption}
 */
const defaultMigrationOptions = {
  dryRun: true,
  dir: resolve("infra", "migrations"),
  direction: "up",
  log: () => {},
  migrationsTable: "pgmigrations",
};

/**
 * Lista as migrações pendentes sem executá-las (dry run).
 *
 * Usa dryRun: true (padrão) para apenas simular, retornando
 * quais migrações seriam aplicadas sem alterar o banco.
 *
 * @returns {Promise<Array<object>>} Array de migrações pendentes encontradas pelo runner.
 * @throws {ServiceError} Erro ao conectar no banco ou ao executar o runner.
 *
 * @example
 * const pendingMigrations = await migrator.listPendingMigrations();
 * console.log(pendingMigrations); // [{ path: "...", name: "1771251043740_create-users", ... }]
 * console.log(pendingMigrations.length); // 0 se não houver pendências
 */
async function listPendingMigrations() {
  let dbClient;

  try {
    dbClient = await database.getNewClient();

    // Usa o spread das opções padrão, que já tem dryRun: true.
    // O dbClient é passado para o runner gerenciar a conexão.
    const pendingMigrations = await migrationRunner({
      ...defaultMigrationOptions,
      dbClient,
    });
    return pendingMigrations;
  } catch (error) {
    throw new ServiceError({
      message: "Erro ao listar migrações pendentes.",
      cause: error,
    });
  } finally {
    // Sempre encerra a conexão, mesmo se der erro. O ?. protege o caso
    // em que getNewClient() falhou e dbClient ficou undefined.
    await dbClient?.end();
  }
}

/**
 * Executa de fato as migrações pendentes no banco (dryRun: false).
 *
 * Sobrescreve o dryRun padrão para aplicar as mudanças.
 * O controller deve decidir o status HTTP com base no resultado
 * (Ex.: 201 se migrou algo, 200 se não havia pendências).
 *
 * @returns {Promise<Array<object>>} Array de migrações que foram executadas.
 * @throws {ServiceError} Erro ao conectar no banco ou ao executar o runner.
 *
 * @example
 * const migratedMigrations = await migrator.runPendingMigrations();
 * // migratedMigrations.length > 0 → 201 (migrou algo)
 * // migratedMigrations.length === 0 → 200 (nada pendente)
 */
async function runPendingMigrations() {
  let dbClient;

  try {
    dbClient = await database.getNewClient();

    // Spread das opções padrão + override do dryRun para false.
    // Como dryRun: false vem depois do spread, sobrescreve o true
    // do defaultMigrationOptions, aplicando as mudanças de verdade.
    const migratedMigrations = await migrationRunner({
      ...defaultMigrationOptions,
      dbClient,
      dryRun: false,
    });

    return migratedMigrations;
  } catch (error) {
    throw new ServiceError({
      message: "Erro ao executar migrações pendentes.",
      cause: error,
    });
  } finally {
    await dbClient?.end();
  }
}

const migrator = {
  listPendingMigrations,
  runPendingMigrations,
};

export default migrator;
