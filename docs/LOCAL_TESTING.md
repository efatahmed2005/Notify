# Local connection troubleshooting

## Web sign-in

Run `npm start` from the project root and open **http://localhost:8080**. Keep this server running while using Notify.

Opening `web/index.html` directly or through VS Code Live Server only serves the interface. Those servers do not provide Notify's `/api` endpoints, so requests may return an HTML page or an empty response instead of JSON. The client now reports a connection problem rather than displaying a JSON parser exception.

Use the Notify server address on your computer. For local testing, the server accepts requests made from its own address; other sites cannot access the API across origins.

## Local Android testing

Run `npm start` on the laptop. The server must listen on all interfaces (`HOST=0.0.0.0` in `.env`). The debug Android app checks its saved server address, then searches the current Wi-Fi or hotspot network for a running Notify server. Both devices must be able to reach one another; guest Wi-Fi with client isolation will not work.

If discovery is blocked, tap **Enter server address** in the app and enter the laptop's current IPv4 address, for example `http://192.168.0.101:8080`. Find it with `ipconfig` on Windows. The address can change after switching Wi-Fi networks or connecting the laptop to a phone hotspot. Allow TCP port 8080 through the laptop firewall for the active private network. Automatic discovery also uses UDP port 8081.

For USB testing without Wi-Fi, connect an Android device with USB debugging enabled and run:

```powershell
adb reverse tcp:8080 tcp:8080
```

Then enter `http://127.0.0.1:8080` in the app. Repeat port forwarding after reconnecting the device. Keep the computer's Notify server running.

To rebuild the debug APK:

```powershell
.\gradlew.bat :app:assembleDebug
```

The APK is written to `app/build/outputs/apk/debug/app-debug.apk`. Debug builds can find a local server or accept a manually entered address. Distributed release builds still need a real HTTPS backend address; local HTTP discovery is for development only.
