// O Jest roda em um ambiente isolado do Next.js
// Ele não entende imports do ES Modules,
// não lê variáveis de ambiente do .env, e não conhece as
// convenções do Next. Este arquivo existe para exportar um objeto de
// configuração que faz o Jest se comportar como o Next.js.
//
// Obs.: usamos require (CommonJS) aqui de propósito. O Jest não entende
// import/export nativamente, então require evita incompatibilidade de largada.

// O Jest roda com NODE_ENV="test", então ele não carrega .env.development
// automaticamente. Precisamos apontar o caminho manualmente para que os
// testes consigam se conectar ao banco, email e outros serviços locais.
const dotenv = require("dotenv");
dotenv.config({
  path: ".env.development",
});

// next/jest é uma factory de funções: ao chamá-la, ela não retorna a config
// final — ela retorna uma FUNÇÃO (createJestConfig) que cria a config.
// Internamente, ela configura o transform usando o compilador do Next.js (SWC),
// que transpila código JS moderno para versões que o Jest consegue executar.
const nextJest = require("next/jest");

// Primeira chamada: passa as configurações do Next.js para a factory.
// O "dir" indica onde encontrar next.config.js e .env do projeto.
// O retorno é a função que vai montar o objeto final de configuração do Jest.
const createJestConfig = nextJest({
  dir: ".",
});

// Segunda chamada: agora sim criamos o objeto final de configuração do Jest,
// passando as customizações específicas do nosso projeto.
const jestConfig = createJestConfig({
  // Permite imports absolutos como "infra/database.js" e "models/user.js"
  // sem precisar de caminhos relativos (../../).
  // "node_modules" → dependências normais.
  // "<rootDir>" → raiz do projeto como base para imports.
  moduleDirectories: ["node_modules", "<rootDir>"],

  // Timeout de 60s por teste. O padrão do Jest é 5s, mas testes de
  // integração que dependem de banco e Docker precisam de mais tempo.
  testTimeout: 60000,
});

module.exports = jestConfig;
