import { describe, expect, it } from "vitest";
import { en } from "../../i18n/en";
import { ptBR } from "../../i18n/ptBR";
import { favoriteChangeMessage } from "./favoriteAlerts";

describe("favoriteChangeMessage", () => {
  it("names the process that took the port", () => {
    expect(favoriteChangeMessage(en, { port: 3000, inUse: true, pid: 42, processName: "node.exe" })).toEqual({
      title: "Port 3000 is now in use",
      body: "node.exe (PID 42) started using it.",
    });
  });

  it("falls back when the owner is unknown", () => {
    const message = favoriteChangeMessage(ptBR, { port: 3000, inUse: true, pid: null, processName: null });
    expect(message.title).toBe("A porta 3000 está em uso agora");
    expect(message.body).toBe(ptBR.notifications.busyBodyUnknown);
  });

  it("announces freed ports", () => {
    expect(favoriteChangeMessage(en, { port: 1313, inUse: false, pid: null, processName: null }).title).toBe(
      "Port 1313 is now free",
    );
  });
});
