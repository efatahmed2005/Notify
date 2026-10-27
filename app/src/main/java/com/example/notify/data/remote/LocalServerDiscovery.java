package com.example.notify.data.remote;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.nio.charset.StandardCharsets;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.Set;

/** Finds a running Notify development server on the phone's current local network. */
public final class LocalServerDiscovery {
  private static final int DISCOVERY_PORT = 8081;
  private static final byte[] REQUEST = "NOTIFY_LOCAL_DISCOVERY_V1".getBytes(StandardCharsets.US_ASCII);
  private static final String RESPONSE = "NOTIFY_LOCAL_SERVER_V1:";

  private LocalServerDiscovery() {}

  public static String find() {
    Set<InetAddress> broadcasts = new LinkedHashSet<>();
    try {
      broadcasts.add(InetAddress.getByName("255.255.255.255"));
      Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
      while (interfaces != null && interfaces.hasMoreElements()) {
        NetworkInterface network = interfaces.nextElement();
        if (!network.isUp() || network.isLoopback()) continue;
        for (InterfaceAddress address : network.getInterfaceAddresses()) {
          if (address.getAddress() instanceof Inet4Address && address.getBroadcast() != null)
            broadcasts.add(address.getBroadcast());
        }
      }
      try (DatagramSocket socket = new DatagramSocket()) {
        socket.setBroadcast(true);
        socket.setSoTimeout(700);
        for (int attempt = 0; attempt < 2; attempt++) {
          for (InetAddress address : broadcasts)
            socket.send(new DatagramPacket(REQUEST, REQUEST.length, address, DISCOVERY_PORT));
          long deadline = System.currentTimeMillis() + 1800;
          while (System.currentTimeMillis() < deadline) {
            byte[] bytes = new byte[80];
            DatagramPacket packet = new DatagramPacket(bytes, bytes.length);
            try {
              socket.receive(packet);
            } catch (java.net.SocketTimeoutException timeout) {
              break;
            }
            String message = new String(packet.getData(), packet.getOffset(), packet.getLength(), StandardCharsets.US_ASCII);
            if (!message.startsWith(RESPONSE) || !packet.getAddress().isSiteLocalAddress()) continue;
            int port;
            try {
              port = Integer.parseInt(message.substring(RESPONSE.length()));
            } catch (NumberFormatException invalid) {
              continue;
            }
            if (port < 1 || port > 65535) continue;
            String url = "http://" + packet.getAddress().getHostAddress() + ":" + port;
            if (ApiClient.probeServer(url)) return url;
          }
        }
      }
    } catch (Exception ignored) {
      // Manual address entry remains available when broadcast is blocked.
    }
    return null;
  }
}
