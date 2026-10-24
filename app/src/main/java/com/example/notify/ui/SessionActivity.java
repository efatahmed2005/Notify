package com.example.notify.ui;

import android.content.Intent;
import android.view.WindowManager;
import androidx.appcompat.app.AppCompatActivity;
import com.example.notify.MainActivity;
import com.example.notify.data.model.User;
import com.example.notify.data.remote.ApiClient;

/** Revalidates server identity whenever a protected native screen resumes. */
public class SessionActivity extends AppCompatActivity {

  @Override
  protected void onResume() {
    super.onResume();
    android.view.View administration = findViewById(
      com.example.notify.R.id.btnAdministration
    );
    if (administration != null) administration.setOnClickListener(v -> {
      Intent intent = new Intent(this, MainActivity.class);
      intent.putExtra("openAdministration", true);
      startActivity(intent);
    });
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
    ApiClient.async(
      ApiClient::refreshSession,
      new ApiClient.Callback<User>() {
        public void success(User user) {
          if (isFinishing()) return;
          String screen = getClassName();
          boolean allowed = user.isApproved();
          if (screen.contains("AdminDashboard")) allowed &=
            user.getRole() == User.Role.ADMIN;
          if (
            screen.contains("TeacherDashboard") ||
            screen.contains("CreateNotice")
          ) allowed &= user.getRole() != User.Role.STUDENT;
          if (!allowed) exitSession();
        }

        public void error(Exception error) {
          if (!isFinishing()) exitSession();
        }
      }
    );
  }

  private String getClassName() {
    return getClass().getSimpleName();
  }

  private void exitSession() {
    Intent intent = new Intent(this, MainActivity.class);
    intent.setFlags(
      Intent.FLAG_ACTIVITY_CLEAR_TOP |
        Intent.FLAG_ACTIVITY_NEW_TASK |
        Intent.FLAG_ACTIVITY_CLEAR_TASK
    );
    startActivity(intent);
    finish();
  }
}
