import retry from "async-retry";

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

export default {
  waitForAllServices,
};
