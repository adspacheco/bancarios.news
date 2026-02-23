// Script de desenvolvimento que faz polling até o Postgres estar pronto.
// É chamado pelo npm script "services:wait:database" antes de rodar as
// migrations, garantindo que o container Docker já subiu e está aceitando
// conexões. Sem isso, as migrations falhariam por tentar conectar cedo demais.
//
// Obs.: usa require (CommonJS) pois não será transpilado. Logo, máxima compatibilidade.
const { exec } = require("node:child_process");

/**
 * Verifica recursivamente se o PostgreSQL está pronto para aceitar conexões.
 *
 * Executa o comando `pg_isready` dentro do container Docker "postgres-dev".
 * Se o Postgres ainda não estiver pronto, imprime um "." no terminal e
 * chama a si mesma novamente (recursão), criando um loop de polling.
 * Quando o Postgres responde que está aceitando conexões, exibe uma
 * mensagem de sucesso e encerra.
 */
function checkPostgres() {
  // O --host localhost força a checagem via TCP/IP. Sem ele, o pg_isready
  // checaria via Unix socket, que é apenas um arquivo no filesystem e fica
  // disponível antes do TCP durante a inicialização do Postgres. Como o
  // node-pg-migrate conecta via TCP, precisamos garantir que essa via
  // específica já está aceitando conexões.
  exec("docker exec postgres-dev pg_isready --host localhost", handleReturn);

  /**
   * Callback executado quando o comando `pg_isready` termina.
   *
   * Analisa a saída (stdout) do comando para saber se o Postgres já está
   * aceitando conexões. Se ainda não estiver, chama `checkPostgres()`
   * novamente para tentar de novo.
   *
   * @param {Error | null} error - Objeto de erro caso o comando falhe, ou null se executou com sucesso.
   * @param {string} stdout - Saída padrão do comando. Quando o Postgres está pronto, contém a string "accepting connections".
   */
  function handleReturn(error, stdout) {
    if (stdout.search("accepting connections") === -1) {
      process.stdout.write(".");
      checkPostgres();
      return;
    }

    console.log("\n🟢 Postgres está pronto e aceitando conexões!\n");
  }
}

// Ponto de entrada do script: exibe a mensagem inicial e dispara o primeiro
// check. A partir daqui, checkPostgres() chama a si mesma recursivamente
// até o Postgres responder, resultando no terminal: 🔴 Aguardando....... 🟢 Pronto!
process.stdout.write("\n\n🔴 Aguardando Postgres aceitar conexões");
checkPostgres();
