// Módulo de hashing e comparação de senhas usando bcrypt.
//
// Senhas nunca são armazenadas em texto puro — sempre passam por hash()
// antes de ir pro banco. Na autenticação, compare() recalcula o hash
// a partir da senha fornecida e compara com o armazenado.
//
// O bcrypt embute o salt (valor aleatório) dentro do próprio hash,
// então não precisamos de uma coluna separada para o salt no banco.
// O resultado sempre tem 60 caracteres, ex:
// $2a$14$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012
// ──── ── ──────────────────────── ──────────────────────────────
// algo rounds       salt (22 chars)          hash (31 chars)
import bcryptjs from "bcryptjs";

/**
 * Gera o hash de uma senha usando bcrypt.
 *
 * O bcrypt embute o salt dentro do próprio hash gerado, então não é
 * necessário armazenar o salt separadamente. O número de rounds
 * controla o custo computacional: quanto maior, mais lento (e mais seguro).
 *
 * @param {string} password - Senha em texto puro.
 * @returns {Promise<string>} Hash bcrypt de 60 caracteres, pronto para ser armazenado no banco.
 *
 * @example
 * const hashed = await password.hash("senhasegura123");
 * // "$2a$14$..." (60 chars, inclui algoritmo + rounds + salt + hash)
 */
async function hash(password) {
  const rounds = getNumberOfRounds();
  return await bcryptjs.hash(password, rounds);
}

/**
 * @private
 * Retorna o número de rounds (cost factor) do bcrypt conforme o ambiente.
 *
 * Cada round dobra o tempo de cálculo do hash:
 * - Produção: 14 rounds (~1s por hash) — seguro contra brute-force.
 * - Desenvolvimento/teste: 1 round — rápido para não travar os testes.
 *
 * @returns {number} Número de salt rounds para o bcrypt.
 */
function getNumberOfRounds() {
  return process.env.NODE_ENV === "production" ? 14 : 1;
}

/**
 * Compara uma senha em texto puro com um hash bcrypt armazenado.
 *
 * Internamente o bcrypt extrai o salt do hash e recalcula — por isso
 * não precisa receber o salt como parâmetro separado.
 *
 * @param {string} providedPassword - Senha fornecida pelo usuário (texto puro).
 * @param {string} storedPassword - Hash bcrypt salvo no banco.
 * @returns {Promise<boolean>} true se a senha bate com o hash, false caso contrário.
 *
 * @example
 * const match = await password.compare("senhasegura123", user.password);
 * // true → senha correta, false → senha errada
 */
async function compare(providedPassword, storedPassword) {
  return await bcryptjs.compare(providedPassword, storedPassword);
}

const password = {
  hash,
  compare,
};

export default password;
