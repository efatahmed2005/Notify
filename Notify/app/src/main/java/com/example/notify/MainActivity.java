package com.example.notify;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.RadioButton;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private RadioButton rbTeacher, rbStudent;
    private Button btnLogin;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        rbTeacher = findViewById(R.id.rbTeacher);
        rbStudent = findViewById(R.id.rbStudent);
        btnLogin = findViewById(R.id.btnLogin);
        Button btnLogin = findViewById(R.id.btnLogin);

        btnLogin.setOnClickListener(v -> {
            if (rbTeacher.isChecked()) {

                Intent intent = new Intent(MainActivity.this, TeacherActivity.class);
                startActivity(intent);
            } else if (rbStudent.isChecked()) {
                Intent intent = new Intent(MainActivity.this, StudentActivity.class);
                startActivity(intent);
            } else {
                Toast.makeText(MainActivity.this, "দয়া করে Teacher অথবা Student সিলেক্ট করুন", Toast.LENGTH_SHORT).show();
            }
        });
    }
}