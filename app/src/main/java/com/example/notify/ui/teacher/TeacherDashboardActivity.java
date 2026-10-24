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
import com.example.notify.data.repository.NoticeRepository;
import com.example.notify.data.repository.RestNoticeRepository;
import com.example.notify.ui.adapter.NoticeAdapter;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.floatingactionbutton.ExtendedFloatingActionButton;
import java.util.List;

public class TeacherDashboardActivity
  extends com.example.notify.ui.SessionActivity
{

  private ImageButton btnBack, btnLogout;
  private MaterialButton btnNewNoticeHeader;
  private ExtendedFloatingActionButton fabNewNotice;
  private TextView tvActiveNoticesCount;
  private RecyclerView rvTeacherNotices;

  private NoticeAdapter adapter;
  private NoticeRepository noticeRepository;
  private User currentUser;

  private final NoticeRepository.RealtimeNoticeListener realtimeListener =
    new NoticeRepository.RealtimeNoticeListener() {
      @Override
      public void onNoticesUpdated(List<Notice> notices) {
        loadNotices();
      }

      @Override
      public void onError(Exception e) {
        if (adapter != null) adapter.setNotices(new java.util.ArrayList<>());
      }
    };

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_teacher);

    currentUser = com.example.notify.data.remote.ApiClient.currentUser;
    if (currentUser == null) {
      finish();
      return;
    }
    noticeRepository = RestNoticeRepository.getInstance();

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
        Intent intent = new Intent(
          TeacherDashboardActivity.this,
          com.example.notify.MainActivity.class
        );
        intent.setFlags(
          Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        startActivity(intent);
      }
      finish();
    });

    if (btnLogout != null) {
      btnLogout.setOnClickListener(v ->
        com.example.notify.data.remote.ApiClient.logout(this, () -> {
          Intent intent = new Intent(
            this,
            com.example.notify.MainActivity.class
          );
          intent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK
          );
          startActivity(intent);
          finish();
        })
      );
    }

    boolean isDeptHead = !currentUser.getHeadDepartmentIds().isEmpty();
    if (!isDeptHead) {
      if (btnNewNoticeHeader != null) btnNewNoticeHeader.setVisibility(View.GONE);
      if (fabNewNotice != null) fabNewNotice.setVisibility(View.GONE);
    }


    View.OnClickListener openComposer = v -> {
      Intent intent = new Intent(
        TeacherDashboardActivity.this,
        CreateNoticeActivity.class
      );
      intent.putExtra("user", currentUser);
      startActivity(intent);
    };

    if (btnNewNoticeHeader != null) btnNewNoticeHeader.setOnClickListener(openComposer);
    if (fabNewNotice != null) fabNewNotice.setOnClickListener(openComposer);
  }

  private void loadNotices() {
    noticeRepository.getNoticesForUser(
      currentUser,
      new NoticeRepository.Callback<List<Notice>>() {
        @Override
        public void onSuccess(List<Notice> result) {
          adapter.setNotices(result);
          if (tvActiveNoticesCount != null) {
            tvActiveNoticesCount.setText(String.valueOf(result.size()));
          }
        }

        @Override
        public void onError(Exception e) {
          if (adapter != null) adapter.setNotices(new java.util.ArrayList<>());
        }
      }
    );
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
