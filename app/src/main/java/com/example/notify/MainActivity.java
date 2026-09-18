package com.example.notify;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import com.example.notify.data.model.User;
import com.example.notify.ui.admin.AdminDashboardActivity;
import com.example.notify.ui.auth.RegisterActivity;
import com.example.notify.ui.deptadmin.DeptAdminDashboardActivity;
import com.example.notify.ui.student.StudentFeedActivity;
import com.example.notify.ui.teacher.TeacherDashboardActivity;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;

/**
 * MainActivity handles 4-tier institutional role selection and routing.
 */
public class MainActivity extends AppCompatActivity {

    private MaterialCardView cardAdmin, cardDeptAdmin, cardTeacher, cardStudent;
    private ImageView ivCheckAdmin, ivCheckDeptAdmin, ivCheckTeacher, ivCheckStudent;
    private com.google.android.material.textfield.TextInputEditText etEmail, etPassword;
    private MaterialButton btnLogin, btnRegister;

    private User.Role selectedRole = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        initViews();
        setupListeners();
    }

    private void initViews() {
        cardAdmin = findViewById(R.id.cardAdmin);
        cardDeptAdmin = findViewById(R.id.cardDeptAdmin);
        cardTeacher = findViewById(R.id.cardTeacher);
        cardStudent = findViewById(R.id.cardStudent);

        ivCheckAdmin = findViewById(R.id.ivCheckAdmin);
        ivCheckDeptAdmin = findViewById(R.id.ivCheckDeptAdmin);
        ivCheckTeacher = findViewById(R.id.ivCheckTeacher);
        ivCheckStudent = findViewById(R.id.ivCheckStudent);

        etEmail = findViewById(R.id.etEmail);
        etPassword = findViewById(R.id.etPassword);

        btnLogin = findViewById(R.id.btnLogin);
        btnRegister = findViewById(R.id.btnRegister);
    }

    private void setupListeners() {
        cardAdmin.setOnClickListener(v -> selectRole(User.Role.ADMIN));
        cardDeptAdmin.setOnClickListener(v -> selectRole(User.Role.DEPT_ADMIN));
        cardTeacher.setOnClickListener(v -> selectRole(User.Role.TEACHER));
        cardStudent.setOnClickListener(v -> selectRole(User.Role.STUDENT));

        // Default selection: Student
        selectRole(User.Role.STUDENT);

        btnLogin.setOnClickListener(v -> {
            if (selectedRole == null) {
                Toast.makeText(this, "Please select an institutional role", Toast.LENGTH_SHORT).show();
                return;
            }

            String email = etEmail.getText() != null ? etEmail.getText().toString().trim() : "";
            String password = etPassword.getText() != null ? etPassword.getText().toString().trim() : "";

            if (email.isEmpty()) {
                etEmail.setError("Institutional email required");
                return;
            }
            if (password.isEmpty()) {
                etPassword.setError("Password required");
                return;
            }

            Toast.makeText(this, "Logged in as " + email, Toast.LENGTH_SHORT).show();

            Intent intent;
            switch (selectedRole) {
                case ADMIN:
                    intent = new Intent(MainActivity.this, AdminDashboardActivity.class);
                    intent.putExtra("user", new User("ADM-01", "Dr. Robert Vance", email, User.Role.ADMIN, "ALL"));
                    break;
                case DEPT_ADMIN:
                    intent = new Intent(MainActivity.this, DeptAdminDashboardActivity.class);
                    intent.putExtra("deptCode", "CSE");
                    intent.putExtra("user", new User("HOD-01", "Dr. Alan Turing", email, User.Role.DEPT_ADMIN, "CSE"));
                    break;
                case TEACHER:
                    intent = new Intent(MainActivity.this, TeacherDashboardActivity.class);
                    intent.putExtra("user", new User("TCH-201", "Prof. Grace Hopper", email, User.Role.TEACHER, "CSE"));
                    break;
                case STUDENT:
                default:
                    intent = new Intent(MainActivity.this, StudentFeedActivity.class);
                    intent.putExtra("user", new User("STU-1001", "Alex Smith", email, User.Role.STUDENT, "CSE"));
                    break;
            }
            startActivity(intent);
        });

        btnRegister.setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, RegisterActivity.class);
            startActivity(intent);
        });
    }

    private void selectRole(User.Role role) {
        this.selectedRole = role;
        resetCardStyles();

        int primaryColor = ContextCompat.getColor(this, R.color.primary);
        int primaryLightBg = ContextCompat.getColor(this, R.color.primary_light);

        switch (role) {
            case ADMIN:
                cardAdmin.setStrokeColor(primaryColor);
                cardAdmin.setStrokeWidth(4);
                cardAdmin.setCardBackgroundColor(primaryLightBg);
                ivCheckAdmin.setVisibility(View.VISIBLE);
                btnLogin.setText("Login as University Admin");
                if (etEmail != null) etEmail.setText("admin@univ.edu");
                break;
            case DEPT_ADMIN:
                cardDeptAdmin.setStrokeColor(primaryColor);
                cardDeptAdmin.setStrokeWidth(4);
                cardDeptAdmin.setCardBackgroundColor(primaryLightBg);
                ivCheckDeptAdmin.setVisibility(View.VISIBLE);
                btnLogin.setText("Login as Department HOD");
                if (etEmail != null) etEmail.setText("hod.cse@univ.edu");
                break;
            case TEACHER:
                cardTeacher.setStrokeColor(primaryColor);
                cardTeacher.setStrokeWidth(4);
                cardTeacher.setCardBackgroundColor(primaryLightBg);
                ivCheckTeacher.setVisibility(View.VISIBLE);
                btnLogin.setText("Login as Faculty / Teacher");
                if (etEmail != null) etEmail.setText("faculty@univ.edu");
                break;
            case STUDENT:
                cardStudent.setStrokeColor(primaryColor);
                cardStudent.setStrokeWidth(4);
                cardStudent.setCardBackgroundColor(primaryLightBg);
                ivCheckStudent.setVisibility(View.VISIBLE);
                btnLogin.setText("Login as Student");
                if (etEmail != null) etEmail.setText("student@univ.edu");
                break;
        }
    }

    private void resetCardStyles() {
        int outlineColor = ContextCompat.getColor(this, R.color.outline_variant);
        int surfaceColor = ContextCompat.getColor(this, R.color.surface);

        cardAdmin.setStrokeColor(outlineColor);
        cardAdmin.setStrokeWidth(2);
        cardAdmin.setCardBackgroundColor(surfaceColor);
        ivCheckAdmin.setVisibility(View.GONE);

        cardDeptAdmin.setStrokeColor(outlineColor);
        cardDeptAdmin.setStrokeWidth(2);
        cardDeptAdmin.setCardBackgroundColor(surfaceColor);
        ivCheckDeptAdmin.setVisibility(View.GONE);

        cardTeacher.setStrokeColor(outlineColor);
        cardTeacher.setStrokeWidth(2);
        cardTeacher.setCardBackgroundColor(surfaceColor);
        ivCheckTeacher.setVisibility(View.GONE);

        cardStudent.setStrokeColor(outlineColor);
        cardStudent.setStrokeWidth(2);
        cardStudent.setCardBackgroundColor(surfaceColor);
        ivCheckStudent.setVisibility(View.GONE);
    }
}