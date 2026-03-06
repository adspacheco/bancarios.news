// Módulo de autorização.
//
// Centraliza a lógica que decide se um usuário (autenticado ou anônimo)
// pode executar determinada ação, com base na lista de features que ele possui.
//
// Atualmente a verificação é simples (features.includes), mas ter essa
// lógica isolada permite evoluir o modelo de permissões sem alterar os
// consumidores (controller.canRequest, rotas da API, etc.).

/**
 * Verifica se o usuário possui a feature necessária para executar uma ação.
 *
 * @param {object} user - Objeto do usuário (autenticado ou anônimo) com a lista de features.
 * @param {string[]} user.features - Lista de features que o usuário possui.
 * @param {string} feature - Nome da feature exigida (ex: "create:session").
 * @returns {boolean} `true` se o usuário possui a feature, `false` caso contrário.
 *
 * @example
 * authorization.can(request.context.user, "create:session"); // true ou false
 */
function can(user, feature) {
  let authorized = false;

  if (user.features.includes(feature)) {
    authorized = true;
  }

  return authorized;
}

const authorization = {
  can,
};

export default authorization;
