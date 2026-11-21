import type { Protocol } from "../types/ports";

/** Protocol names are technical identifiers and are not translated. */
export const PROTOCOL_LABELS: Record<Protocol, string> = {
  tcp: "TCP",
  tcp6: "TCPv6",
  udp: "UDP",
  udp6: "UDPv6",
};
