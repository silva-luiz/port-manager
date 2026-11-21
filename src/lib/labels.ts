import type { Protocol, TcpState } from "../types/ports";

export const STATE_LABELS: Record<TcpState, string> = {
  closed: "Closed",
  listen: "Listening",
  synSent: "SYN sent",
  synReceived: "SYN received",
  established: "Established",
  finWait1: "FIN wait 1",
  finWait2: "FIN wait 2",
  closeWait: "Close wait",
  closing: "Closing",
  lastAck: "Last ACK",
  timeWait: "Time wait",
  deleteTcb: "Delete TCB",
  unknown: "Unknown",
};

export const PROTOCOL_LABELS: Record<Protocol, string> = {
  tcp: "TCP",
  tcp6: "TCPv6",
};

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString();
}
