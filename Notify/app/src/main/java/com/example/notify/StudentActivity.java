package com.example.notify;

import android.os.Bundle;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;

public class StudentActivity extends AppCompatActivity {

    private TextView tvNoticeTitle, tvNoticeMessage;
    private DatabaseReference databaseReference;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_student);

        tvNoticeTitle = findViewById(R.id.tvNoticeTitle);
        tvNoticeMessage = findViewById(R.id.tvNoticeMessage);

        databaseReference = FirebaseDatabase.getInstance().getReference("Notice");


        databaseReference.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot snapshot) {
                if (snapshot.exists()) {
                    String title = snapshot.child("title").getValue(String.class);
                    String message = snapshot.child("message").getValue(String.class);


                    tvNoticeTitle.setText(title);
                    tvNoticeMessage.setText(message);
                }
            }

            @Override
            public void onCancelled(@NonNull DatabaseError error) {
                Toast.makeText(StudentActivity.this, "Database Error: " + error.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }
}