// Configurações do servidor web.
//
// Centraliza valores que dependem do ambiente (dev, preview, produção),
// evitando que cada módulo tenha que checar process.env diretamente.

/**
 * Retorna a URL de origem (scheme + host) do servidor web de acordo com o ambiente.
 *
 * - test / development: `http://localhost:3000`
 * - preview (Vercel): `https://{VERCEL_URL}` (URL gerada pelo Vercel para cada deploy)
 * - produção: `https://bancarios.news`
 *
 * @returns {string} URL de origem sem barra final.
 */
function getOrigin() {
  if (["test", "development"].includes(process.env.NODE_ENV)) {
    return "http://localhost:3000";
  }

  if (process.env.VERCEL_ENV === "preview") {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "https://bancarios.news";
}

const webserver = {
  /** @type {string} URL de origem do servidor, resolvida na inicialização. */
  origin: getOrigin(),
};

export default webserver;
