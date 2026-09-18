package com.example.notify;

import android.content.Intent;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import com.example.notify.ui.teacher.CreateNoticeActivity;

public class CreateNotificationActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent intent = new Intent(this, CreateNoticeActivity.class);
        startActivity(intent);
        finish();
    }
}