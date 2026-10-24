package com.example.notify.ui.details;

import android.os.Bundle;
import android.view.View;
import android.widget.ImageButton;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import com.example.notify.R;
import com.example.notify.data.model.Notice;
import com.example.notify.utils.DateUtils;
import com.example.notify.utils.UiHelper;
import com.google.android.material.button.MaterialButton;

public class NoticeDetailsActivity
  extends com.example.notify.ui.SessionActivity
{

  private ImageButton btnBack, btnShareTop;
  private TextView tvDetailsCategory, tvDetailsDept, tvDetailsTitle;
  private TextView tvDetailsPublisher, tvDetailsTarget, tvDetailsTime, tvDetailsDescription;
  private View cardDetailsAttachment;
  private TextView tvDetailsAttachmentName, tvDetailsAttachmentSize;
  private MaterialButton btnDetailsOpenAttachment;
  private MaterialButton btnCopyNotice, btnShareNotice;

  // Zoom controls
  private View layoutNoticeZoom;
  private MaterialButton btnNoticeZoomOut, btnNoticeZoomIn, btnNoticeZoomReset;
  private TextView tvNoticeZoomLevel;
  private int currentZoomPercent = 100;
  private static final float BASE_DESC_SIZE_SP = 16f;
  private static final float BASE_TITLE_SIZE_SP = 20f;

  private Notice notice;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_details);

    notice = (Notice) getIntent().getSerializableExtra("notice");

    initViews();
    setupListeners();
    if (notice == null) {
      finish();
      return;
    }
    com.example.notify.data.remote.ApiClient.async(
      () ->
        com.example.notify.data.repository.RestNoticeRepository.parse(
          new org.json.JSONObject(
            com.example.notify.data.remote.ApiClient.request(
              "/api/notices/" + notice.getNoticeId(),
              "GET",
              null
            )
          )
        ),
      new com.example.notify.data.remote.ApiClient.Callback<Notice>() {
        public void success(Notice result) {
          notice = result;
          bindNoticeData();
        }

        public void error(Exception error) {
          android.widget.Toast.makeText(
            NoticeDetailsActivity.this,
            error.getMessage(),
            android.widget.Toast.LENGTH_LONG
          ).show();
          finish();
        }
      }
    );
  }

  private void initViews() {
    btnBack = findViewById(R.id.btnBack);
    btnShareTop = findViewById(R.id.btnShareTop);
    tvDetailsCategory = findViewById(R.id.tvDetailsCategory);
    tvDetailsDept = findViewById(R.id.tvDetailsDept);
    tvDetailsTitle = findViewById(R.id.tvDetailsTitle);
    tvDetailsPublisher = findViewById(R.id.tvDetailsPublisher);
    tvDetailsTarget = findViewById(R.id.tvDetailsTarget);
    tvDetailsTime = findViewById(R.id.tvDetailsTime);
    tvDetailsDescription = findViewById(R.id.tvDetailsDescription);
    btnCopyNotice = findViewById(R.id.btnCopyNotice);
    btnShareNotice = findViewById(R.id.btnShareNotice);

    layoutNoticeZoom = findViewById(R.id.layoutNoticeZoom);
    btnNoticeZoomOut = findViewById(R.id.btnNoticeZoomOut);
    btnNoticeZoomIn = findViewById(R.id.btnNoticeZoomIn);
    btnNoticeZoomReset = findViewById(R.id.btnNoticeZoomReset);
    tvNoticeZoomLevel = findViewById(R.id.tvNoticeZoomLevel);

    cardDetailsAttachment = findViewById(R.id.cardDetailsAttachment);
    tvDetailsAttachmentName = findViewById(R.id.tvDetailsAttachmentName);
    tvDetailsAttachmentSize = findViewById(R.id.tvDetailsAttachmentSize);
    btnDetailsOpenAttachment = findViewById(R.id.btnDetailsOpenAttachment);
  }

  private void setupListeners() {
    btnBack.setOnClickListener(v -> finish());
    btnShareTop.setOnClickListener(v -> {
      if (notice != null) UiHelper.shareNotice(this, notice);
    });
    btnShareNotice.setOnClickListener(v -> {
      if (notice != null) UiHelper.shareNotice(this, notice);
    });
    btnCopyNotice.setOnClickListener(v -> {
      if (notice != null) UiHelper.copyNoticeToClipboard(this, notice);
    });

    if (btnNoticeZoomOut != null) {
      btnNoticeZoomOut.setOnClickListener(v -> applyNoticeZoom(currentZoomPercent - 15));
    }
    if (btnNoticeZoomIn != null) {
      btnNoticeZoomIn.setOnClickListener(v -> applyNoticeZoom(currentZoomPercent + 15));
    }
    if (btnNoticeZoomReset != null) {
      btnNoticeZoomReset.setOnClickListener(v -> applyNoticeZoom(100));
    }

    View.OnClickListener openDocListener = v -> {
      if (notice != null && notice.hasAttachment()) {
        android.content.Intent docIntent = new android.content.Intent(
          this,
          DocumentPreviewActivity.class
        );
        docIntent.putExtra("notice", notice);
        startActivity(docIntent);
      }
    };

    if (btnDetailsOpenAttachment != null) {
      btnDetailsOpenAttachment.setOnClickListener(openDocListener);
    }
    if (cardDetailsAttachment != null) {
      cardDetailsAttachment.setOnClickListener(openDocListener);
    }
  }

  private void applyNoticeZoom(int percent) {
    currentZoomPercent = Math.max(80, Math.min(220, percent));
    float factor = currentZoomPercent / 100f;
    tvDetailsDescription.setTextSize(
      android.util.TypedValue.COMPLEX_UNIT_SP,
      BASE_DESC_SIZE_SP * factor
    );
    tvDetailsTitle.setTextSize(
      android.util.TypedValue.COMPLEX_UNIT_SP,
      BASE_TITLE_SIZE_SP * factor
    );
    if (tvNoticeZoomLevel != null) {
      tvNoticeZoomLevel.setText(currentZoomPercent + "%");
    }
  }

  private void bindNoticeData() {
    if (notice == null) return;

    tvDetailsTitle.setText(notice.getTitle());
    String content = notice.getContent();
    if (content == null || content.trim().isEmpty()) {
      tvDetailsDescription.setVisibility(View.GONE);
      if (layoutNoticeZoom != null) layoutNoticeZoom.setVisibility(View.GONE);
    } else {
      tvDetailsDescription.setVisibility(View.VISIBLE);
      tvDetailsDescription.setText(content);
      if (layoutNoticeZoom != null) layoutNoticeZoom.setVisibility(View.VISIBLE);
    }
    tvDetailsPublisher.setText("Published by: " + notice.getPublisherName());
    tvDetailsTarget.setText("Target: " + notice.getTargetAudience());
    tvDetailsTime.setText(DateUtils.formatFullDate(notice.getTimestamp()));

    tvDetailsCategory.setText(UiHelper.getCategoryLabel(notice.getCategory()));
    tvDetailsCategory.setBackgroundResource(
      UiHelper.getCategoryBadgeBackground(notice.getCategory())
    );
    tvDetailsCategory.setTextColor(
      UiHelper.getCategoryTextColor(this, notice.getCategory())
    );

    String deptText = "ALL".equalsIgnoreCase(notice.getTargetDepartment())
      ? "Campus-Wide"
      : notice.getTargetDepartment() + " Dept";
    tvDetailsDept.setText(deptText);

    if (notice.hasAttachment()) {
      cardDetailsAttachment.setVisibility(View.VISIBLE);
      tvDetailsAttachmentName.setText(notice.getAttachmentName());
      String sizeInfo =
        (notice.getAttachmentSize() != null ? notice.getAttachmentSize() : "") +
        " • Official Document Attached";
      tvDetailsAttachmentSize.setText(sizeInfo);
    } else {
      cardDetailsAttachment.setVisibility(View.GONE);
    }
  }
}
