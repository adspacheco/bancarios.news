import email from "infra/email.js";
import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

describe("infra/email.js", () => {
  test("send()", async () => {
    await orchestrator.deleteAllEmails();

    await email.send({
      from: "BancáriosNews <contato@bancarios.news>",
      to: "bancario@bancarios.news",
      subject: "Teste de assunto",
      text: "Teste de corpo.",
    });

    await email.send({
      from: "BancáriosNews <contato@bancarios.news>",
      to: "bancario@bancarios.news",
      subject: "Último email enviado",
      text: "Corpo do último email.",
    });

    const lastEmail = await orchestrator.getLastEmail();
    expect(lastEmail.sender).toBe("<contato@bancarios.news>");
    expect(lastEmail.recipients[0]).toBe("<bancario@bancarios.news>");
    expect(lastEmail.subject).toBe("Último email enviado");
    expect(lastEmail.text).toBe("Corpo do último email.\r\n");
  });
});
