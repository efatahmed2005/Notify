package com.example.notify;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.*;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import com.example.notify.data.model.User;
import com.example.notify.data.remote.ApiClient;
import com.example.notify.data.remote.LocalServerDiscovery;
import com.google.android.material.button.MaterialButton;

/** Shared hosted account flows, with an entry to the existing native notice screens. */
public class MainActivity extends AppCompatActivity {

  private WebView portal;
  private MaterialButton nativeButton;
  private MaterialButton configServerButton;
  private TextView errorText;
  private java.io.File pendingDownload;
  private ValueCallback<Uri[]> pendingFiles;
  private final ActivityResultLauncher<String> saveDocument =
    registerForActivityResult(
      new ActivityResultContracts.CreateDocument("application/octet-stream"),
      uri -> {
        if (uri == null) return;
        ApiClient.async(
          () ->
            com.example.notify.utils.PdfDocumentHelper.saveToUri(
              this,
              pendingDownload,
              uri
            ),
          new ApiClient.Callback<Boolean>() {
            public void success(Boolean saved) {
              Toast.makeText(
                MainActivity.this,
                saved ? "Document saved." : "Could not save document.",
                Toast.LENGTH_LONG
              ).show();
            }

            public void error(Exception error) {
              showError("Could not save document.");
            }
          }
        );
      }
    );
  private final ActivityResultLauncher<String[]> filePicker =
    registerForActivityResult(
      new ActivityResultContracts.OpenMultipleDocuments(),
      uris -> {
        if (pendingFiles != null) {
          pendingFiles.onReceiveValue(uris.toArray(new Uri[0]));
          pendingFiles = null;
        }
      }
    );

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle state) {
    super.onCreate(state);
    android.webkit.WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
    getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);
    LinearLayout layout = new LinearLayout(this);
    layout.setOrientation(LinearLayout.VERTICAL);
    layout.setFitsSystemWindows(true);
    androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(layout, (v, insets) -> {
      androidx.core.graphics.Insets sb = insets.getInsets(
        androidx.core.view.WindowInsetsCompat.Type.systemBars()
      );
      v.setPadding(0, Math.max(sb.top, 24), 0, 0);
      return insets;
    });
    ApiClient.init(this);
    errorText = new TextView(this);
    errorText.setPadding(24, 16, 24, 16);
    errorText.setTextColor(androidx.core.content.ContextCompat.getColor(this, R.color.on_surface));
    errorText.setText("Looking for the Notify server on this network...");
    layout.addView(errorText);
    configServerButton = new MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle);
    configServerButton.setText("Enter server address");
    configServerButton.setOnClickListener(v -> showServerConfigDialog());
    layout.addView(configServerButton);
    portal = new WebView(this);
    portal.setVisibility(View.GONE);
    layout.addView(portal, new LinearLayout.LayoutParams(-1, 0, 1));
    nativeButton = new MaterialButton(this);
    nativeButton.setText("Open native notice board");
    nativeButton.setVisibility(View.GONE);
    layout.addView(nativeButton);
    setContentView(layout);
    portal.getSettings().setJavaScriptEnabled(true);
    portal.getSettings().setDomStorageEnabled(true);
    portal.getSettings().setAllowFileAccess(false);
    portal.getSettings().setAllowContentAccess(false);
    portal
      .getSettings()
      .setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(portal, false);

    portal.setWebViewClient(
      new WebViewClient() {
        @Override
        public boolean shouldOverrideUrlLoading(
          WebView view,
          WebResourceRequest request
        ) {
          return !sameOrigin(request.getUrl());
        }

        @Override
        public void onReceivedSslError(
          WebView view,
          SslErrorHandler handler,
          android.net.http.SslError error
        ) {
          handler.cancel();
          showError("The server certificate could not be verified.");
        }

        @Override
        public void onReceivedError(
          WebView view,
          WebResourceRequest request,
          WebResourceError error
        ) {
          if (request.isForMainFrame()) showError(
            "Unable to reach Notify. Check your connection and the configured server address."
          );
        }

        @Override
        public void onPageFinished(WebView view, String url) {
          CookieManager.getInstance().flush();
          ApiClient.async(
            ApiClient::refreshSession,
            new ApiClient.Callback<User>() {
              public void success(User user) {
                if (user != null && user.isApproved() && !isFinishing()) {
                  launchNativeDashboard(user);
                }
              }
              public void error(Exception ignored) {}
            }
          );
        }
      }
    );
    portal.setWebChromeClient(
      new WebChromeClient() {
        @Override
        public boolean onShowFileChooser(
          WebView view,
          ValueCallback<Uri[]> callback,
          FileChooserParams params
        ) {
          if (pendingFiles != null) pendingFiles.onReceiveValue(null);
          pendingFiles = callback;
          filePicker.launch(new String[] {
            "application/pdf",
            "application/msword",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });
          return true;
        }
      }
    );
    portal.setDownloadListener((url, agent, disposition, mime, length) -> {
      Uri uri = Uri.parse(url);
      if (!sameOrigin(uri)) return;
      String[] parts = uri.getPath().split("/");
      if (
        parts.length != 5 ||
        !"notices".equals(parts[2]) ||
        !"attachment".equals(parts[4])
      ) return;
      String name = URLUtil.guessFileName(url, disposition, mime);
      ApiClient.async(
        () -> ApiClient.download(this, parts[3], name),
        new ApiClient.Callback<java.io.File>() {
          public void success(java.io.File file) {
            pendingDownload = file;
            saveDocument.launch(name);
          }

          public void error(Exception error) {
            showError(error.getMessage());
          }
        }
      );
    });
    nativeButton.setOnClickListener(v -> {
      nativeButton.setEnabled(false);
      ApiClient.async(
        ApiClient::refreshSession,
        new ApiClient.Callback<User>() {
          public void success(User user) {
            nativeButton.setEnabled(true);
            if (!user.isApproved()) {
              showError(
                "Complete account approval and any required password change before opening the notice board."
              );
              return;
            }
            launchNativeDashboard(user);
          }

          public void error(Exception e) {
            nativeButton.setEnabled(true);
            showError("Sign in to Notify first. " + e.getMessage());
          }
        }
      );
    });
    connectToServer();
  }

  private void connectToServer() {
    errorText.setText("Looking for the Notify server on this network...");
    errorText.setVisibility(View.VISIBLE);
    portal.setVisibility(View.GONE);
    nativeButton.setVisibility(View.GONE);
    ApiClient.async(() -> {
      String configured = ApiClient.baseUrl();
      if (ApiClient.probeServer(configured)) return configured;
      return BuildConfig.DEBUG ? LocalServerDiscovery.find() : null;
    }, new ApiClient.Callback<String>() {
      public void success(String url) {
        if (isFinishing() || isDestroyed()) return;
        if (url == null) {
          showError("Could not find the Notify server. Start it on your laptop, keep both devices on the same Wi-Fi or hotspot, and allow the connection through the laptop firewall. Tap 'Enter server address' if automatic discovery is blocked.");
          return;
        }
        if (!url.equals(ApiClient.baseUrl())) ApiClient.setCustomBaseUrl(MainActivity.this, url);
        errorText.setVisibility(View.GONE);
        portal.setVisibility(View.VISIBLE);
        nativeButton.setVisibility(View.VISIBLE);
        portal.loadUrl(url +
          (getIntent().getBooleanExtra("openClasses", false)
            ? "/?view=classes"
            : getIntent().getBooleanExtra("openAdministration", false)
              ? "/?view=administration"
              : "/")
        );
      }
      public void error(Exception error) {
        if (!isFinishing()) showError("Could not connect to the Notify server.");
      }
    });
  }

  private void showServerConfigDialog() {
    final android.widget.EditText input = new android.widget.EditText(this);
    input.setText(ApiClient.baseUrl());
    input.setSingleLine(true);
    input.setPadding(32, 24, 32, 24);

    new androidx.appcompat.app.AlertDialog.Builder(this)
      .setTitle("Configure Server URL")
      .setMessage("Enter the laptop's current local address, for example http://192.168.0.101:8080. The address can change when you switch Wi-Fi or use a mobile hotspot.")
      .setView(input)
      .setPositiveButton("Connect", (d, w) -> {
        String url = input.getText().toString().trim();
        try {
          ApiClient.setCustomBaseUrl(this, url);
          connectToServer();
        } catch (IllegalArgumentException invalid) {
          showError(invalid.getMessage());
        }
      })
      .setNeutralButton("Use Emulator IP (10.0.2.2)", (d, w) -> {
        ApiClient.setCustomBaseUrl(this, "http://10.0.2.2:8080");
        connectToServer();
      })
      .setNegativeButton("Search again", (d, w) -> connectToServer())
      .show();
  }

  private void launchNativeDashboard(User user) {
    Class<?> target =
      user.getRole() == User.Role.ADMIN
        ? com.example.notify.ui.admin.AdminDashboardActivity.class
        : user.getRole() == User.Role.TEACHER
          ? com.example.notify.ui.teacher.TeacherDashboardActivity.class
          : com.example.notify.ui.student.StudentFeedActivity.class;
    Intent intent = new Intent(MainActivity.this, target);
    startActivity(intent);
    finish();
  }

  private boolean sameOrigin(Uri uri) {
    Uri base = Uri.parse(ApiClient.baseUrl());
    return (
      java.util.Objects.equals(uri.getScheme(), base.getScheme()) &&
      java.util.Objects.equals(uri.getHost(), base.getHost()) &&
      uri.getPort() == base.getPort()
    );
  }

  private void showError(String message) {
    errorText.setText(message + "\n(Target: " + ApiClient.baseUrl() + ")");
    errorText.setVisibility(View.VISIBLE);
    portal.setVisibility(View.GONE);
    nativeButton.setVisibility(View.GONE);
    if (configServerButton != null) {
      configServerButton.setVisibility(View.VISIBLE);
    }
  }

  @Override
  protected void onDestroy() {
    if (pendingFiles != null) pendingFiles.onReceiveValue(null);
    portal.destroy();
    super.onDestroy();
  }
}
