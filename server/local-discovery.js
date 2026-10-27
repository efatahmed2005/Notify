import dgram from "node:dgram";

const request = "NOTIFY_LOCAL_DISCOVERY_V1";
const discoveryPort = 8081;

// Development only. The reply contains only the HTTP port, never credentials.
export function startLocalDiscovery(httpPort) {
  if (!Number.isInteger(httpPort) || httpPort < 1 || httpPort > 65535)
    throw new Error("Invalid local server port.");
  const socket = dgram.createSocket("udp4");
  socket.on("message", (packet, remote) => {
    if (packet.toString("utf8") !== request) return;
    const reply = Buffer.from(`NOTIFY_LOCAL_SERVER_V1:${httpPort}`);
    socket.send(reply, remote.port, remote.address);
  });
  socket.on("error", (error) => {
    console.warn(`Local server discovery is unavailable: ${error.message}`);
    socket.close();
  });
  socket.bind(discoveryPort, "0.0.0.0");
  return () => socket.close();
}
