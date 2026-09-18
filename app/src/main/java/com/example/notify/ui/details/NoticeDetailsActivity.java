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

public class NoticeDetailsActivity extends AppCompatActivity {

    private ImageButton btnBack, btnShareTop;
    private TextView tvDetailsCategory, tvDetailsDept, tvDetailsTitle;
    private TextView tvDetailsPublisher, tvDetailsTarget, tvDetailsTime, tvDetailsDescription;
    private View cardDetailsAttachment;
    private TextView tvDetailsAttachmentName, tvDetailsAttachmentSize;
    private MaterialButton btnDetailsOpenAttachment;
    private MaterialButton btnCopyNotice, btnShareNotice;

    private Notice notice;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_details);

        notice = (Notice) getIntent().getSerializableExtra("notice");

        initViews();
        setupListeners();
        bindNoticeData();
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

        View.OnClickListener openDocListener = v -> {
            if (notice != null && notice.hasAttachment()) {
                android.content.Intent docIntent = new android.content.Intent(this, DocumentPreviewActivity.class);
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

    private void showInAppDocumentViewerDialog() {
        if (notice == null || !notice.hasAttachment()) return;

        android.app.Dialog dialog = new android.app.Dialog(this);
        dialog.requestWindowFeature(android.view.Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_document_viewer);
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT));
            dialog.getWindow().setLayout(
                    (int) (getResources().getDisplayMetrics().widthPixels * 0.95),
                    android.view.ViewGroup.LayoutParams.WRAP_CONTENT
            );
        }

        TextView tvTitle = dialog.findViewById(R.id.tvDialogDocTitle);
        TextView tvMeta = dialog.findViewById(R.id.tvDialogDocMeta);
        TextView tvHeadline = dialog.findViewById(R.id.tvDialogNoticeHeadline);
        TextView tvBody = dialog.findViewById(R.id.tvDialogDocBody);
        TextView tvSignee = dialog.findViewById(R.id.tvDialogSignee);
        TextView tvDate = dialog.findViewById(R.id.tvDialogDocDate);
        ImageButton btnClose = dialog.findViewById(R.id.btnDialogClose);
        MaterialButton btnDismiss = dialog.findViewById(R.id.btnDialogDismiss);
        MaterialButton btnDownload = dialog.findViewById(R.id.btnDialogDownload);

        if (tvTitle != null) tvTitle.setText(notice.getAttachmentName());
        if (tvMeta != null) {
            String size = notice.getAttachmentSize() != null ? notice.getAttachmentSize() : "1.4 MB";
            tvMeta.setText(size + " • Official Document Attached");
        }
        if (tvHeadline != null) tvHeadline.setText(notice.getTitle());
        if (tvBody != null) tvBody.setText(notice.getContent());
        if (tvSignee != null) tvSignee.setText(notice.getPublisherName());
        if (tvDate != null) tvDate.setText("Ref: MUT/NOT/2026/0491 • " + DateUtils.formatFullDate(notice.getTimestamp()));

        View.OnClickListener dismissListener = v -> dialog.dismiss();
        if (btnClose != null) btnClose.setOnClickListener(dismissListener);
        if (btnDismiss != null) btnDismiss.setOnClickListener(dismissListener);

        if (btnDownload != null) {
            btnDownload.setOnClickListener(v -> {
                android.widget.Toast.makeText(this, "⬇️ Saved to Downloads: " + notice.getAttachmentName(), android.widget.Toast.LENGTH_SHORT).show();
                dialog.dismiss();
            });
        }

        dialog.show();
    }

    private void bindNoticeData() {
        if (notice == null) return;

        tvDetailsTitle.setText(notice.getTitle());
        tvDetailsDescription.setText(notice.getContent());
        tvDetailsPublisher.setText("Published by: " + notice.getPublisherName());
        tvDetailsTarget.setText("Target: " + notice.getTargetAudience());
        tvDetailsTime.setText(DateUtils.formatFullDate(notice.getTimestamp()));

        tvDetailsCategory.setText(UiHelper.getCategoryLabel(notice.getCategory()));
        tvDetailsCategory.setBackgroundResource(UiHelper.getCategoryBadgeBackground(notice.getCategory()));
        tvDetailsCategory.setTextColor(UiHelper.getCategoryTextColor(this, notice.getCategory()));

        String deptText = "ALL".equalsIgnoreCase(notice.getTargetDepartment()) ? "Campus-Wide" : notice.getTargetDepartment() + " Dept";
        tvDetailsDept.setText(deptText);

        if (notice.hasAttachment()) {
            cardDetailsAttachment.setVisibility(View.VISIBLE);
            tvDetailsAttachmentName.setText(notice.getAttachmentName());
            String sizeInfo = (notice.getAttachmentSize() != null ? notice.getAttachmentSize() : "") + " • Official Document Attached";
            tvDetailsAttachmentSize.setText(sizeInfo);
        } else {
            cardDetailsAttachment.setVisibility(View.GONE);
        }
    }
}
