import migrationRunner from "node-pg-migrate";
import { resolve } from "node:path";
import database from "infra/database.js";

/**
 * Configurações padrão para o node-pg-migrate.
 *
 * - dryRun: true por padrão para que listagens não apliquem mudanças no banco.
 * - dir: caminho absoluto da pasta onde ficam os arquivos de migração.
 * - direction: "up" aplica migrações pendentes (o oposto seria "down" para reverter).
 * - migrationsTable: tabela no banco que registra quais migrações já foram executadas.
 */
const defaultMigrationOptions = {
  dryRun: true,
  dir: resolve("infra", "migrations"),
  direction: "up",
  verbose: true,
  migrationsTable: "pgmigrations",
};

/**
 * Lista as migrações pendentes sem executá-las (dry run).
 *
 * Usa dryRun: true (padrão) para apenas simular, retornando
 * quais migrações seriam aplicadas sem alterar o banco.
 *
 * @returns {Promise<Array<object>>} Array de migrações pendentes encontradas pelo runner.
 */
async function listPendingMigrations() {
  let dbClient;

  try {
    dbClient = await database.getNewClient();

    const pendingMigrations = await migrationRunner({
      ...defaultMigrationOptions,
      dbClient,
    });
    return pendingMigrations;
  } finally {
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
 */
async function runPendingMigrations() {
  let dbClient;

  try {
    dbClient = await database.getNewClient();

    const migratedMigrations = await migrationRunner({
      ...defaultMigrationOptions,
      dbClient,
      dryRun: false,
    });

    return migratedMigrations;
  } finally {
    await dbClient?.end();
  }
}

const migrator = {
  listPendingMigrations,
  runPendingMigrations,
};

export default migrator;
