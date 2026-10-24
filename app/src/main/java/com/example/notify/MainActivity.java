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
import com.google.android.material.button.MaterialButton;

/** Shared hosted account flows, with an entry to the existing native notice screens. */
public class MainActivity extends AppCompatActivity {

  private WebView portal;
  private MaterialButton nativeButton;
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
    errorText = new TextView(this);
    errorText.setPadding(24, 16, 24, 16);
    errorText.setVisibility(View.GONE);
    layout.addView(errorText);
    portal = new WebView(this);
    layout.addView(portal, new LinearLayout.LayoutParams(-1, 0, 1));
    nativeButton = new MaterialButton(this);
    nativeButton.setText("Open native notice board");
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
            Class<?> target =
              user.getRole() == User.Role.ADMIN
                ? com.example.notify.ui.admin.AdminDashboardActivity.class
                : user.getRole() == User.Role.TEACHER
                  ? com.example.notify.ui.teacher.TeacherDashboardActivity.class
                  : com.example.notify.ui.student.StudentFeedActivity.class;
            startActivity(new Intent(MainActivity.this, target));
          }

          public void error(Exception e) {
            nativeButton.setEnabled(true);
            showError("Sign in to Notify first. " + e.getMessage());
          }
        }
      );
    });
    String base = ApiClient.baseUrl();
    if (base.contains("example.invalid")) {
      showError(
        "Notify server is not configured. Set NOTIFY_SERVER_URL and NOTIFY_SERVER_ORIGIN when building the app."
      );
      nativeButton.setEnabled(false);
    } else portal.loadUrl(
      base +
        (getIntent().getBooleanExtra("openClasses", false)
          ? "/?view=classes"
          : getIntent().getBooleanExtra("openAdministration", false)
            ? "/?view=administration"
            : "/")
    );
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
    errorText.setText(message);
    errorText.setVisibility(View.VISIBLE);
  }

  @Override
  protected void onDestroy() {
    if (pendingFiles != null) pendingFiles.onReceiveValue(null);
    portal.destroy();
    super.onDestroy();
  }
}
