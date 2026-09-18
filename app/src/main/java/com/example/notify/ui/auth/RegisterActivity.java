package com.example.notify.ui.auth;

import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.ImageButton;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.example.notify.R;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;

public class RegisterActivity extends AppCompatActivity {

    private ImageButton btnBack;
    private AutoCompleteTextView actvDepartment;
    private TextInputEditText etRegName, etRegEmail, etRegPassword;
    private MaterialButton btnRegister;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);

        initViews();
        setupDropdown();
        setupListeners();
    }

    private void initViews() {
        btnBack = findViewById(R.id.btnBack);
        actvDepartment = findViewById(R.id.actvDepartment);
        etRegName = findViewById(R.id.etRegName);
        etRegEmail = findViewById(R.id.etRegEmail);
        etRegPassword = findViewById(R.id.etRegPassword);
        btnRegister = findViewById(R.id.btnRegister);
    }

    private void setupDropdown() {
        String[] departments = new String[]{
                "Computer Science & Engineering (CSE)",
                "Electrical & Electronic Engineering (EEE)",
                "School of Business Administration (BBA)",
                "Department of Law & Justice (LAW)",
                "Civil Engineering (CE)"
        };
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, departments);
        actvDepartment.setAdapter(adapter);
    }

    private void setupListeners() {
        btnBack.setOnClickListener(v -> finish());

        btnRegister.setOnClickListener(v -> {
            String name = etRegName.getText() != null ? etRegName.getText().toString().trim() : "";
            String email = etRegEmail.getText() != null ? etRegEmail.getText().toString().trim() : "";
            String password = etRegPassword.getText() != null ? etRegPassword.getText().toString().trim() : "";

            if (name.isEmpty()) {
                etRegName.setError("Name is required");
                return;
            }
            if (email.isEmpty()) {
                etRegEmail.setError("Email is required");
                return;
            }
            if (password.length() < 6) {
                etRegPassword.setError("Password must be at least 6 characters");
                return;
            }

            Toast.makeText(this, "🎉 Account Created Successfully! Welcome " + name, Toast.LENGTH_LONG).show();
            finish();
        });
    }
}
