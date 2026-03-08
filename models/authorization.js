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
// O módulo também é responsável por filtrar os dados de saída (filterOutput),
// garantindo que cada endpoint retorne apenas os campos que o usuário tem
// permissão de visualizar, evitando vazamento de dados sensíveis como
// password e email (exceto para o próprio usuário).
//
// Ter essa lógica isolada permite evoluir o modelo de permissões sem alterar
// os consumidores (controller.canRequest, rotas da API, etc.).
import { InternalServerError } from "infra/errors.js";

/**
 * Lista de todas as features reconhecidas pelo sistema de autorização.
 * Qualquer feature não listada aqui será rejeitada por `validateFeature`.
 *
 * @type {string[]}
 */
const availableFeatures = [
  // USER
  "create:user",
  "read:user",
  "read:user:self",
  "update:user",
  "update:user:others",

  // SESSION
  "create:session",
  "read:session",

  // ACTIVATION_TOKEN
  "read:activation_token",

  // MIGRATION
  "create:migration",
  "read:migration",

  // STATUS
  "read:status",
  "read:status:all",
];

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
 * @throws {InternalServerError} Se `user` não possuir a propriedade `features`.
 * @throws {InternalServerError} Se `feature` não estiver listada em `availableFeatures`.
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
  validateUser(user);
  validateFeature(feature);

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

/**
 * Filtra os campos de saída de um recurso com base na feature informada,
 * retornando apenas os dados que o usuário tem permissão de visualizar.
 *
 * Cada feature possui uma whitelist de campos permitidos. Para features
 * sensíveis a ownership (ex: "read:user:self", "read:session"), o `user.id`
 * é comparado com o ID do recurso para liberar campos adicionais como `email`.
 *
 * Para "read:status", se o usuário possuir "read:status:all", o campo
 * `version` do banco de dados é incluído na saída.
 *
 * @param {object} user - Objeto do usuário (autenticado ou anônimo) com a lista de features.
 * @param {string[]} user.features - Lista de features que o usuário possui.
 * @param {string} user.id - Identificador único do usuário.
 * @param {string} feature - Feature de leitura que define quais campos retornar
 *   (ex: "read:user", "read:user:self", "read:session", "read:activation_token",
 *   "read:migration", "read:status").
 * @param {object|object[]} resource - Recurso ou lista de recursos a ser filtrado.
 * @returns {object|object[]} Objeto (ou array) contendo apenas os campos permitidos.
 * @throws {InternalServerError} Se `user` não possuir a propriedade `features`.
 * @throws {InternalServerError} Se `feature` não estiver listada em `availableFeatures`.
 * @throws {InternalServerError} Se `resource` não for fornecido.
 *
 * @example
 * // Retorna apenas id, username, features, created_at, updated_at
 * authorization.filterOutput(user, "read:user", targetUser);
 *
 * @example
 * // Retorna campos públicos + email quando user.id === resource.id
 * authorization.filterOutput(user, "read:user:self", user);
 *
 * @example
 * // Filtra lista de migrations para retornar apenas path, name, timestamp
 * authorization.filterOutput(user, "read:migration", pendingMigrations);
 */
function filterOutput(user, feature, resource) {
  validateUser(user);
  validateFeature(feature);
  validateResource(resource);

  if (feature === "read:user") {
    return {
      id: resource.id,
      username: resource.username,
      features: resource.features,
      created_at: resource.created_at,
      updated_at: resource.updated_at,
    };
  }

  if (feature === "read:user:self") {
    if (user.id === resource.id) {
      return {
        id: resource.id,
        username: resource.username,
        email: resource.email,
        features: resource.features,
        created_at: resource.created_at,
        updated_at: resource.updated_at,
      };
    }
  }

  if (feature === "read:session") {
    if (user.id === resource.user_id) {
      return {
        id: resource.id,
        token: resource.token,
        user_id: resource.user_id,
        created_at: resource.created_at,
        updated_at: resource.updated_at,
        expires_at: resource.expires_at,
      };
    }
  }

  if (feature === "read:activation_token") {
    return {
      id: resource.id,
      user_id: resource.user_id,
      created_at: resource.created_at,
      updated_at: resource.updated_at,
      expires_at: resource.expires_at,
      used_at: resource.used_at,
    };
  }

  if (feature === "read:migration") {
    return resource.map((migration) => {
      return {
        path: migration.path,
        name: migration.name,
        timestamp: migration.timestamp,
      };
    });
  }

  if (feature === "read:status") {
    const output = {
      updated_at: resource.updated_at,
      dependencies: {
        database: {
          max_connections: resource.dependencies.database.max_connections,
          opened_connections: resource.dependencies.database.opened_connections,
        },
      },
    };

    if (can(user, "read:status:all")) {
      output.dependencies.database.version =
        resource.dependencies.database.version;
    }

    return output;
  }
}

/**
 * Valida se o objeto `user` é válido e possui a propriedade `features`.
 *
 * @param {object} user - Objeto do usuário a ser validado.
 * @throws {InternalServerError} Se `user` for falsy ou não possuir `features`.
 */
function validateUser(user) {
  if (!user || !user.features) {
    throw new InternalServerError({
      cause: "É necessário fornecer `user` no model `authorization`.",
    });
  }
}

/**
 * Valida se a `feature` informada está listada em `availableFeatures`.
 *
 * @param {string} feature - Nome da feature a ser validada.
 * @throws {InternalServerError} Se `feature` for falsy ou não existir em `availableFeatures`.
 */
function validateFeature(feature) {
  if (!feature || !availableFeatures.includes(feature)) {
    throw new InternalServerError({
      cause:
        "É necessário fornecer uma `feature` conhecida no model `authorization`.",
    });
  }
}

/**
 * Valida se o `resource` foi fornecido.
 *
 * @param {object|object[]} resource - Recurso a ser validado.
 * @throws {InternalServerError} Se `resource` for falsy.
 */
function validateResource(resource) {
  if (!resource) {
    throw new InternalServerError({
      cause:
        "É necessário fornecer um `resource` em `authorization.filterOutput()`.",
    });
  }
}

const authorization = {
  can,
  filterOutput,
};

export default authorization;
