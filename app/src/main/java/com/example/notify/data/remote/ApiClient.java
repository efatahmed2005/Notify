package com.example.notify.data.remote;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import com.example.notify.BuildConfig;
import com.example.notify.data.model.User;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/** Shared transport. Identity and permissions always come from the server. */
public final class ApiClient {

  public interface Callback<T> {
    void success(T value);
    void error(Exception error);
  }

  public interface Work<T> {
    T run() throws Exception;
  }

  private static final ExecutorService executor = Executors.newFixedThreadPool(
    3
  );
  private static final Handler main = new Handler(Looper.getMainLooper());
  public static volatile User currentUser;
  private static volatile String csrf = "";

  private static volatile String customBaseUrl = null;

  public static void init(Context context) {
    if (context != null && customBaseUrl == null) {
      String saved = context.getSharedPreferences("notify_prefs", Context.MODE_PRIVATE)
          .getString("server_url", null);
      if (saved != null && !saved.trim().isEmpty()) {
        customBaseUrl = saved.trim().replaceAll("/+$", "");
      } else if (isEmulator()) {
        customBaseUrl = "http://10.0.2.2:8080";
      }
    }
  }

  public static void setCustomBaseUrl(Context context, String url) {
    if (url != null && !url.trim().isEmpty()) {
      customBaseUrl = url.trim().replaceAll("/+$", "");
      if (context != null) {
        context.getSharedPreferences("notify_prefs", Context.MODE_PRIVATE)
            .edit()
            .putString("server_url", customBaseUrl)
            .apply();
      }
    }
  }

  public static boolean isEmulator() {
    return android.os.Build.FINGERPRINT.startsWith("generic")
        || android.os.Build.FINGERPRINT.startsWith("unknown")
        || android.os.Build.MODEL.contains("google_sdk")
        || android.os.Build.MODEL.contains("Emulator")
        || android.os.Build.MODEL.contains("Android SDK built for x86")
        || android.os.Build.MANUFACTURER.contains("Genymotion")
        || (android.os.Build.BRAND.startsWith("generic") && android.os.Build.DEVICE.startsWith("generic"))
        || "google_sdk".equals(android.os.Build.PRODUCT);
  }

  public static String baseUrl() {
    if (customBaseUrl != null && !customBaseUrl.isEmpty()) {
      return customBaseUrl;
    }
    return BuildConfig.NOTIFY_SERVER_URL.replaceAll("/+$", "");
  }

  public static <T> void async(Work<T> work, Callback<T> callback) {
    executor.execute(() -> {
      try {
        T value = work.run();
        main.post(() -> callback.success(value));
      } catch (Exception e) {
        main.post(() -> callback.error(e));
      }
    });
  }

  private static HttpURLConnection connection(
    String path,
    String method,
    String type
  ) throws Exception {
    URL base = new URL(baseUrl());
    if (!"https".equals(base.getProtocol()) && !BuildConfig.DEBUG) {
      throw new IOException("Configure an HTTPS Notify server.");
    }
    if (!path.startsWith("/api/")) throw new IOException("Invalid API path");
    HttpURLConnection c = (HttpURLConnection) new URL(
      baseUrl() + path
    ).openConnection();
    c.setInstanceFollowRedirects(false);
    c.setConnectTimeout(15000);
    c.setReadTimeout(30000);
    c.setRequestMethod(method);
    c.setRequestProperty("Origin", base.getProtocol() + "://" + base.getAuthority());
    String cookies = CookieManager.getInstance().getCookie(baseUrl());
    if (cookies != null) c.setRequestProperty("Cookie", cookies);
    c.setRequestProperty("X-CSRF-Token", csrf);
    c.setRequestProperty("Accept", "application/json");
    if (type != null) c.setRequestProperty("Content-Type", type);
    return c;
  }

  private static byte[] response(HttpURLConnection c) throws Exception {
    try {
      int code = c.getResponseCode();
      java.util.List<String> cookieHeaders = c.getHeaderFields().get("Set-Cookie");
      if (cookieHeaders != null) {
        for (String cookie : cookieHeaders) {
          CookieManager.getInstance().setCookie(baseUrl(), cookie);
        }
        CookieManager.getInstance().flush();
      }
      InputStream stream =
        code >= 400 ? c.getErrorStream() : c.getInputStream();
      ByteArrayOutputStream output = new ByteArrayOutputStream();
      if (stream != null) try (InputStream input = stream) {
        byte[] buffer = new byte[16384];
        int count;
        while ((count = input.read(buffer)) != -1) {
          if (output.size() + count > 27 * 1024 * 1024) throw new IOException(
            "Response is too large."
          );
          output.write(buffer, 0, count);
        }
      }
      byte[] bytes = output.toByteArray();
      if (code < 200 || code >= 300) {
        if (code == 401) {
          currentUser = null;
          csrf = "";
        }
        String message = "The request could not be completed.";
        try {
          message = new JSONObject(
            new String(bytes, StandardCharsets.UTF_8)
          ).optString("error", message);
        } catch (Exception ignored) {}
        throw new IOException(message);
      }
      return bytes;
    } finally {
      c.disconnect();
    }
  }

  private static String jsonResponse(HttpURLConnection connection)
    throws Exception {
    String type = connection.getContentType();
    byte[] bytes = response(connection);
    String text = new String(bytes, StandardCharsets.UTF_8);
    try {
      if (
        type == null ||
        !type.toLowerCase(java.util.Locale.ROOT).contains("application/json")
      ) {
        throw new IOException("Invalid content type");
      }
      Object parsed = new org.json.JSONTokener(text).nextValue();
      if (!(parsed instanceof JSONObject) && !(parsed instanceof JSONArray)) {
        throw new IOException("Invalid response");
      }
    } catch (Exception invalid) {
      throw new IOException(
        "The server did not return a valid Notify response. Check the server address and make sure the Notify backend is running."
      );
    }
    return text;
  }

  public static String request(String path, String method, JSONObject body)
    throws Exception {
    if (!"GET".equals(method)) refreshSession();
    HttpURLConnection c = connection(
      path,
      method,
      body == null ? null : "application/json"
    );
    if (body != null) {
      c.setDoOutput(true);
      try (OutputStream out = c.getOutputStream()) {
        out.write(body.toString().getBytes(StandardCharsets.UTF_8));
      }
    }
    return jsonResponse(c);
  }

  public static synchronized User refreshSession() throws Exception {
    JSONObject data = new JSONObject(
      jsonResponse(connection("/api/session", "GET", null))
    );
    csrf = data.getString("csrfToken");
    currentUser = User.fromJson(data.getJSONObject("user"));
    return currentUser;
  }

  public static JSONObject publish(JSONObject fields, File file, String name)
    throws Exception {
    return sendMultipart("/api/notices", fields, file, name);
  }

  public static JSONObject analyzeDocument(File file, String name) throws Exception {
    if (file == null || !file.isFile()) throw new IOException("Choose a document first.");
    return sendMultipart("/api/notices/analyze", new JSONObject(), file, name);
  }

  private static JSONObject sendMultipart(String path, JSONObject fields, File file, String name)
    throws Exception {
    refreshSession();
    String boundary = "Notify" + java.util.UUID.randomUUID();
    HttpURLConnection c = connection(
      path,
      "POST",
      "multipart/form-data; boundary=" + boundary
    );
    c.setDoOutput(true);
    if ("/api/notices/analyze".equals(path)) c.setReadTimeout(180000);
    c.setChunkedStreamingMode(16384);
    try (OutputStream out = c.getOutputStream()) {
      java.util.Iterator<String> keys = fields.keys();
      while (keys.hasNext()) {
        String key = keys.next();
        out.write(
          (
            "--" +
            boundary +
            "\r\nContent-Disposition: form-data; name=\"" +
            key +
            "\"\r\n\r\n" +
            fields.getString(key) +
            "\r\n"
          ).getBytes(StandardCharsets.UTF_8)
        );
      }
      if (file != null) {
        if (file.length() > 25 * 1024 * 1024) throw new IOException(
          "Attachments must be 25 MB or smaller."
        );
        String safe = name.replaceAll("[^a-zA-Z0-9._ -]", "_");
        out.write(
          (
            "--" +
            boundary +
            "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" +
            safe +
            "\"\r\nContent-Type: application/octet-stream\r\n\r\n"
          ).getBytes(StandardCharsets.UTF_8)
        );
        try (InputStream input = new FileInputStream(file)) {
          byte[] buffer = new byte[16384];
          int count;
          while ((count = input.read(buffer)) != -1)
            out.write(buffer, 0, count);
        }
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
      }
      out.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
    }
    return new JSONObject(jsonResponse(c));
  }

  public static File download(Context context, String noticeId, String name)
    throws Exception {
    byte[] data = response(
      connection("/api/notices/" + noticeId + "/attachment", "GET", null)
    );
    File file = File.createTempFile(
      "notice-",
      "-" + name.replaceAll("[^a-zA-Z0-9._-]", "_"),
      context.getCacheDir()
    );
    try (OutputStream out = new FileOutputStream(file)) {
      out.write(data);
    }
    return file;
  }

  public static File downloadPreview(Context context, String noticeId)
    throws Exception {
    byte[] data = response(
      connection("/api/notices/" + noticeId + "/document/pdf", "GET", null)
    );
    if (
      data.length < 5 ||
      !new String(data, 0, 5, StandardCharsets.US_ASCII).equals("%PDF-")
    ) throw new IOException("Document preview is not a PDF.");
    File file = File.createTempFile(
      "notice-preview-",
      ".pdf",
      context.getCacheDir()
    );
    try (OutputStream out = new FileOutputStream(file)) {
      out.write(data);
    }
    return file;
  }

  public static JSONObject getDocumentInfo(String noticeId) throws Exception {
    return new JSONObject(
      jsonResponse(connection("/api/notices/" + noticeId + "/document", "GET", null))
    );
  }

  public static void logout(Context context, Runnable complete) {
    async(
      () -> {
        try {
          request("/api/auth/logout", "POST", new JSONObject());
        } finally {
          currentUser = null;
          csrf = "";
        }
        return true;
      },
      new Callback<Boolean>() {
        public void success(Boolean value) {
          CookieManager.getInstance().removeAllCookies(v -> complete.run());
        }

        public void error(Exception e) {
          android.widget.Toast.makeText(
            context,
            "Server sign-out could not be confirmed. Local credentials were cleared.",
            android.widget.Toast.LENGTH_LONG
          ).show();
          CookieManager.getInstance().removeAllCookies(v -> complete.run());
        }
      }
    );
  }
}
