package com.example.notify;

import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import java.util.HashMap;

public class CreateNotificationActivity extends AppCompatActivity {

    private EditText etTitle, etMessage;
    private Button btnSend;
    private DatabaseReference databaseReference;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_create_notification);
        etTitle = findViewById(R.id.etTitle);
        etMessage = findViewById(R.id.etMessage);
        btnSend = findViewById(R.id.btnSend);

        databaseReference = FirebaseDatabase.getInstance().getReference("Notice");
        btnSend.setOnClickListener(v -> {
            String title = etTitle.getText().toString().trim();
            String message = etMessage.getText().toString().trim();

            if (title.isEmpty() || message.isEmpty()) {
                Toast.makeText(CreateNotificationActivity.this, "Please fill in all fields", Toast.LENGTH_SHORT).show();
                return;
            }

            HashMap<String, String> noticeMap = new HashMap<>();
            noticeMap.put("title", title);
            noticeMap.put("message", message);

            databaseReference.setValue(noticeMap)
                    .addOnSuccessListener(aVoid -> {
                        Toast.makeText(CreateNotificationActivity.this, "Notification Published Successfully!", Toast.LENGTH_SHORT).show();
                        etTitle.setText("");
                        etMessage.setText("");
                    })
                    .addOnFailureListener(e -> {
                        Toast.makeText(CreateNotificationActivity.this, "Failed: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    });
        });
    }
}