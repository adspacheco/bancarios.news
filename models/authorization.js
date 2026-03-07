// Módulo de autorização.
//
// Centraliza a lógica que decide se um usuário (autenticado ou anônimo)
// pode executar determinada ação, com base na lista de features que ele possui.
//
// Além da verificação de features, o módulo também considera o recurso-alvo
// (resource) para features que exigem ownership, como "update:user", onde
// o usuário só pode atualizar o próprio perfil — a menos que possua a
// feature "update:user:others", que permite atuar sobre qualquer usuário.
//
// Ter essa lógica isolada permite evoluir o modelo de permissões sem alterar
// os consumidores (controller.canRequest, rotas da API, etc.).

/**
 * Verifica se o usuário possui a feature necessária para executar uma ação,
 * considerando opcionalmente o recurso-alvo para validação de ownership.
 *
 * @param {object} user - Objeto do usuário (autenticado ou anônimo) com a lista de features.
 * @param {string[]} user.features - Lista de features que o usuário possui.
 * @param {string} user.id - Identificador único do usuário.
 * @param {string} feature - Nome da feature exigida (ex: "create:session", "update:user").
 * @param {object} [resource] - Recurso-alvo da ação. Quando informado junto com
 *   features que exigem ownership (ex: "update:user"), o `user.id` é comparado
 *   com `resource.id` para garantir que o usuário só atue sobre si mesmo —
 *   a menos que possua "update:user:others", que ignora a verificação de ownership.
 * @param {string} resource.id - Identificador único do recurso-alvo.
 * @returns {boolean} `true` se o usuário está autorizado, `false` caso contrário.
 *
 * @example
 * authorization.can(request.context.user, "create:session"); // true ou false
 *
 * @example
 * // Verifica ownership: true se user.id === targetUser.id
 * authorization.can(userTryingToPatch, "update:user", targetUser);
 *
 * @example
 * // Usuário privilegiado com "update:user:others" pode atualizar qualquer usuário
 * authorization.can(privilegedUser, "update:user", anyUser); // true
 */
function can(user, feature, resource) {
  let authorized = false;

  if (user.features.includes(feature)) {
    authorized = true;
  }

  if (feature === "update:user" && resource) {
    authorized = false;

    if (user.id === resource.id || can(user, "update:user:others")) {
      authorized = true;
    }
  }

  return authorized;
}

const authorization = {
  can,
};

export default authorization;
