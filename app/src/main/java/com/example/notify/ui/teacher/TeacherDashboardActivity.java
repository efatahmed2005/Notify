package com.example.notify.ui.teacher;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
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
import com.google.android.material.button.MaterialButton;
import com.google.android.material.floatingactionbutton.ExtendedFloatingActionButton;
import java.util.List;

public class TeacherDashboardActivity extends AppCompatActivity {

    private ImageButton btnBack, btnLogout;
    private MaterialButton btnNewNoticeHeader;
    private ExtendedFloatingActionButton fabNewNotice;
    private TextView tvActiveNoticesCount;
    private RecyclerView rvTeacherNotices;

    private NoticeAdapter adapter;
    private NoticeRepository noticeRepository;
    private User currentUser;

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
        setContentView(R.layout.activity_teacher);

        currentUser = new User("TCH-201", "Prof. Alan Turing", "turing@univ.edu", User.Role.TEACHER, "CSE");
        noticeRepository = MockNoticeRepository.getInstance();

        initViews();
        setupRecyclerView();
        setupListeners();
        loadNotices();
    }

    private void initViews() {
        btnBack = findViewById(R.id.btnBack);
        btnLogout = findViewById(R.id.btnLogout);
        btnNewNoticeHeader = findViewById(R.id.btnNewNoticeHeader);
        fabNewNotice = findViewById(R.id.fabNewNotice);
        tvActiveNoticesCount = findViewById(R.id.tvActiveNoticesCount);
        rvTeacherNotices = findViewById(R.id.rvTeacherNotices);
    }

    private void setupRecyclerView() {
        adapter = new NoticeAdapter(this);
        rvTeacherNotices.setLayoutManager(new LinearLayoutManager(this));
        rvTeacherNotices.setAdapter(adapter);
    }

    private void setupListeners() {
        btnBack.setOnClickListener(v -> {
            if (isTaskRoot()) {
                Intent intent = new Intent(TeacherDashboardActivity.this, com.example.notify.MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(intent);
            }
            finish();
        });

        if (btnLogout != null) {
            btnLogout.setOnClickListener(v -> {
                android.widget.Toast.makeText(this, "Logged out of faculty portal", android.widget.Toast.LENGTH_SHORT).show();
                Intent intent = new Intent(TeacherDashboardActivity.this, com.example.notify.MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(intent);
                finish();
            });
        }

        View.OnClickListener openComposer = v -> {
            Intent intent = new Intent(TeacherDashboardActivity.this, CreateNoticeActivity.class);
            intent.putExtra("user", currentUser);
            startActivity(intent);
        };

        btnNewNoticeHeader.setOnClickListener(openComposer);
        fabNewNotice.setOnClickListener(openComposer);
    }

    private void loadNotices() {
        noticeRepository.getNoticesForUser(currentUser, new NoticeRepository.Callback<List<Notice>>() {
            @Override
            public void onSuccess(List<Notice> result) {
                adapter.setNotices(result);
                if (tvActiveNoticesCount != null) {
                    tvActiveNoticesCount.setText(String.valueOf(result.size()));
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
