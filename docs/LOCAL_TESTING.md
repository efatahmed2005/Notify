# Local connection troubleshooting

## Web sign-in

Run `npm start` from the project root and open **http://localhost:8080**. Keep this server running while using Notify.

Opening `web/index.html` directly or through VS Code Live Server only serves the interface. Those servers do not provide Notify's `/api` endpoints, so requests may return an HTML page or an empty response instead of JSON. The client now reports a connection problem rather than displaying a JSON parser exception.

Use the exact address configured in `.env` as `APP_ORIGIN`. Sign-in requests from a different origin are rejected deliberately.

## Local Android testing

The local debug APK connects to `http://localhost:8080`. Connect an Android device with USB debugging enabled, then run:

```powershell
adb reverse tcp:8080 tcp:8080
```

Keep the computer's Notify server running. Repeat port forwarding after reconnecting the device if needed. This APK is for local testing; it cannot reach the computer's backend from an unconnected phone.

To rebuild the same local configuration:

```powershell
.\gradlew.bat :app:assembleDebug -PNOTIFY_SERVER_URL=http://localhost:8080 -PNOTIFY_SERVER_ORIGIN=http://localhost:8080
```

The APK is written to `app/build/outputs/apk/debug/app-debug.apk`. Builds without these properties use the unconfigured server placeholder. Distributed builds need a real HTTPS backend address.
