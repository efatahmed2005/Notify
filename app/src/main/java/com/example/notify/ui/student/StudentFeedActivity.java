package com.example.notify.ui.student;

import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.example.notify.MainActivity;
import com.example.notify.R;
import com.example.notify.data.model.Notice;
import com.example.notify.data.model.User;
import com.example.notify.data.repository.MockNoticeRepository;
import com.example.notify.data.repository.NoticeRepository;
import com.example.notify.ui.adapter.NoticeAdapter;
import java.util.List;

public class StudentFeedActivity extends AppCompatActivity {

    private ImageButton btnBack, btnLogout;
    private TextView tvStudentDept, tvNoticeCountBadge;
    private EditText etSearch;
    private AutoCompleteTextView actvCategoryFilter;
    private RecyclerView rvNotices;
    private LinearLayout layoutEmptyState;
    private ProgressBar progressBar;

    private NoticeAdapter adapter;
    private NoticeRepository noticeRepository;
    private User currentUser;
    private Notice.Category selectedCategory = null;
    private String currentSearchQuery = "";

    private final NoticeRepository.RealtimeNoticeListener realtimeListener = new NoticeRepository.RealtimeNoticeListener() {
        @Override
        public void onNoticesUpdated(List<Notice> notices) {
            filterAndDisplayNotices();
        }

        @Override
        public void onError(Exception e) {
            // Handle sync error
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_student);

        if (getIntent().getSerializableExtra("user") != null) {
            currentUser = (User) getIntent().getSerializableExtra("user");
        } else {
            currentUser = new User("STU-1001", "Alex Smith", "alex@univ.edu", User.Role.STUDENT, "CSE");
        }
        noticeRepository = MockNoticeRepository.getInstance();

        initViews();
        setupCategoryDropdown();
        setupRecyclerView();
        setupListeners();
        loadNotices();
    }

    private void initViews() {
        btnBack = findViewById(R.id.btnBack);
        btnLogout = findViewById(R.id.btnLogout);
        tvStudentDept = findViewById(R.id.tvStudentDept);
        tvNoticeCountBadge = findViewById(R.id.tvNoticeCountBadge);
        etSearch = findViewById(R.id.etSearch);
        actvCategoryFilter = findViewById(R.id.actvCategoryFilter);
        rvNotices = findViewById(R.id.rvNotices);
        layoutEmptyState = findViewById(R.id.layoutEmptyState);
        progressBar = findViewById(R.id.progressBar);

        String deptId = currentUser.getDepartmentId() != null ? currentUser.getDepartmentId() : "CSE";
        tvStudentDept.setText(deptId + " Department • Enrolled Student");
    }

    private void setupCategoryDropdown() {
        String[] categoryOptions = new String[]{
                "All Notices",
                "⚠️ Urgent Alerts",
                "📝 Exam Routines",
                "📢 Announcements",
                "🗓️ Events & Seminars"
        };

        ArrayAdapter<String> dropdownAdapter = new ArrayAdapter<>(
                this,
                android.R.layout.simple_dropdown_item_1line,
                categoryOptions
        );
        actvCategoryFilter.setAdapter(dropdownAdapter);
        actvCategoryFilter.setText(categoryOptions[0], false);

        actvCategoryFilter.setOnItemClickListener((parent, view, position, id) -> {
            switch (position) {
                case 1:
                    selectedCategory = Notice.Category.URGENT;
                    break;
                case 2:
                    selectedCategory = Notice.Category.EXAM;
                    break;
                case 3:
                    selectedCategory = Notice.Category.ANNOUNCEMENT;
                    break;
                case 4:
                    selectedCategory = Notice.Category.EVENT;
                    break;
                case 0:
                default:
                    selectedCategory = null;
                    break;
            }
            filterAndDisplayNotices();
        });
    }

    private void setupRecyclerView() {
        adapter = new NoticeAdapter(this);
        rvNotices.setLayoutManager(new LinearLayoutManager(this));
        rvNotices.setAdapter(adapter);
    }

    private void setupListeners() {
        // Navigate to previous page or back to MainActivity if task root
        btnBack.setOnClickListener(v -> {
            if (isTaskRoot()) {
                Intent intent = new Intent(StudentFeedActivity.this, MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(intent);
            }
            finish();
        });

        // Top navbar logout facility
        if (btnLogout != null) {
            btnLogout.setOnClickListener(v -> {
                Toast.makeText(this, "Logged out of student session", Toast.LENGTH_SHORT).show();
                Intent intent = new Intent(StudentFeedActivity.this, MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(intent);
                finish();
            });
        }

        etSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                currentSearchQuery = s.toString();
                filterAndDisplayNotices();
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });
    }

    private void loadNotices() {
        progressBar.setVisibility(View.VISIBLE);
        filterAndDisplayNotices();
    }

    private void filterAndDisplayNotices() {
        noticeRepository.getFilteredNotices(currentUser, selectedCategory, currentSearchQuery, new NoticeRepository.Callback<List<Notice>>() {
            @Override
            public void onSuccess(List<Notice> result) {
                progressBar.setVisibility(View.GONE);
                adapter.setNotices(result);

                if (tvNoticeCountBadge != null) {
                    tvNoticeCountBadge.setText(result.size() + (result.size() == 1 ? " Notice" : " Notices"));
                }

                if (result.isEmpty()) {
                    layoutEmptyState.setVisibility(View.VISIBLE);
                    rvNotices.setVisibility(View.GONE);
                } else {
                    layoutEmptyState.setVisibility(View.GONE);
                    rvNotices.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onError(Exception e) {
                progressBar.setVisibility(View.GONE);
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        noticeRepository.registerRealtimeListener(realtimeListener);
    }

    @Override
    protected void onPause() {
        super.onPause();
        noticeRepository.unregisterRealtimeListener(realtimeListener);
    }
}
