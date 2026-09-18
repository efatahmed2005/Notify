package com.example.notify.ui.admin;

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

public class AdminDashboardActivity extends AppCompatActivity {

    private ImageButton btnBack, btnLogout;
    private TextView tvTotalNotices;
    private RecyclerView rvAdminNotices;
    private ExtendedFloatingActionButton fabAdminBroadcast;

    private NoticeAdapter adapter;
    private NoticeRepository noticeRepository;
    private User adminUser;

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
        setContentView(R.layout.activity_admin_dashboard);

        adminUser = new User("ADM-001", "Dr. Robert Vance", "admin@univ.edu", User.Role.ADMIN, "ALL");
        noticeRepository = MockNoticeRepository.getInstance();

        initViews();
        setupRecyclerView();
        setupListeners();
        loadNotices();
    }

    private void initViews() {
        btnBack = findViewById(R.id.btnBack);
        btnLogout = findViewById(R.id.btnLogout);
        tvTotalNotices = findViewById(R.id.tvTotalNotices);
        rvAdminNotices = findViewById(R.id.rvAdminNotices);
        fabAdminBroadcast = findViewById(R.id.fabAdminBroadcast);
    }

    private void setupRecyclerView() {
        adapter = new NoticeAdapter(this);
        rvAdminNotices.setLayoutManager(new LinearLayoutManager(this));
        rvAdminNotices.setAdapter(adapter);
    }

    private void setupListeners() {
        btnBack.setOnClickListener(v -> {
            if (isTaskRoot()) {
                Intent intent = new Intent(AdminDashboardActivity.this, com.example.notify.MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(intent);
            }
            finish();
        });

        if (btnLogout != null) {
            btnLogout.setOnClickListener(v -> {
                android.widget.Toast.makeText(this, "Logged out of admin portal", android.widget.Toast.LENGTH_SHORT).show();
                Intent intent = new Intent(AdminDashboardActivity.this, com.example.notify.MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(intent);
                finish();
            });
        }

        fabAdminBroadcast.setOnClickListener(v -> {
            Intent intent = new Intent(AdminDashboardActivity.this, CreateNoticeActivity.class);
            intent.putExtra("user", adminUser);
            startActivity(intent);
        });
    }

    private void loadNotices() {
        noticeRepository.getAllNotices(new NoticeRepository.Callback<List<Notice>>() {
            @Override
            public void onSuccess(List<Notice> result) {
                adapter.setNotices(result);
                if (tvTotalNotices != null) {
                    tvTotalNotices.setText(String.valueOf(result.size()));
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
