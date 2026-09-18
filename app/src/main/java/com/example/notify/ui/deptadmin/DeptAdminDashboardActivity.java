package com.example.notify.ui.deptadmin;

import android.content.Intent;
import android.os.Bundle;
import android.widget.ImageButton;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.example.notify.R;
import com.example.notify.data.model.Notice;
import com.example.notify.data.model.User;
import com.example.notify.data.repository.MockNoticeRepository;
import com.example.notify.data.repository.NoticeRepository;
import com.example.notify.ui.adapter.NoticeAdapter;
import com.example.notify.ui.teacher.CreateNoticeActivity;
import com.google.android.material.floatingactionbutton.ExtendedFloatingActionButton;
import java.util.List;

public class DeptAdminDashboardActivity extends AppCompatActivity {

    private ImageButton btnBack, btnLogout;
    private TextView tvDeptTitle, tvDeptNoticesCount;
    private RecyclerView rvDeptNotices;
    private ExtendedFloatingActionButton fabDeptBroadcast;

    private NoticeAdapter adapter;
    private NoticeRepository noticeRepository;
    private User deptAdminUser;
    private String deptCode = "CSE";

    private final NoticeRepository.RealtimeNoticeListener realtimeListener = new NoticeRepository.RealtimeNoticeListener() {
        @Override
        public void onNoticesUpdated(List<Notice> notices) {
            loadNotices();
        }

        @Override
        public void onError(Exception e) {}
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_dept_admin_dashboard);

        if (getIntent().getStringExtra("deptCode") != null) {
            deptCode = getIntent().getStringExtra("deptCode");
        }

        deptAdminUser = new User("HOD-01", "Prof. Alan Turing", "hod.cse@univ.edu", User.Role.DEPT_ADMIN, deptCode);
        noticeRepository = MockNoticeRepository.getInstance();

        initViews();
        setupRecyclerView();
        setupListeners();
        loadNotices();
    }

    private void initViews() {
        btnBack = findViewById(R.id.btnBack);
        btnLogout = findViewById(R.id.btnLogout);
        tvDeptTitle = findViewById(R.id.tvDeptTitle);
        tvDeptNoticesCount = findViewById(R.id.tvDeptNoticesCount);
        rvDeptNotices = findViewById(R.id.rvDeptNotices);
        fabDeptBroadcast = findViewById(R.id.fabDeptBroadcast);

        tvDeptTitle.setText(deptCode + " Department Portal");
    }

    private void setupRecyclerView() {
        adapter = new NoticeAdapter(this);
        rvDeptNotices.setLayoutManager(new LinearLayoutManager(this));
        rvDeptNotices.setAdapter(adapter);
    }

    private void setupListeners() {
        btnBack.setOnClickListener(v -> {
            if (isTaskRoot()) {
                Intent intent = new Intent(DeptAdminDashboardActivity.this, com.example.notify.MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(intent);
            }
            finish();
        });

        if (btnLogout != null) {
            btnLogout.setOnClickListener(v -> {
                android.widget.Toast.makeText(this, "Logged out of HOD session", android.widget.Toast.LENGTH_SHORT).show();
                Intent intent = new Intent(DeptAdminDashboardActivity.this, com.example.notify.MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(intent);
                finish();
            });
        }

        fabDeptBroadcast.setOnClickListener(v -> {
            Intent intent = new Intent(DeptAdminDashboardActivity.this, CreateNoticeActivity.class);
            intent.putExtra("user", deptAdminUser);
            startActivity(intent);
        });
    }

    private void loadNotices() {
        noticeRepository.getNoticesForUser(deptAdminUser, new NoticeRepository.Callback<List<Notice>>() {
            @Override
            public void onSuccess(List<Notice> result) {
                adapter.setNotices(result);
                if (tvDeptNoticesCount != null) {
                    tvDeptNoticesCount.setText(String.valueOf(result.size()));
                }
            }

            @Override
            public void onError(Exception e) {}
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        noticeRepository.registerRealtimeListener(realtimeListener);
        loadNotices();
    }

    @Override
    protected void onPause() {
        super.onPause();
        noticeRepository.unregisterRealtimeListener(realtimeListener);
    }
}
