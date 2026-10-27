package com.example.notify.ui.teacher;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import com.example.notify.MainActivity;
import com.example.notify.R;
import com.example.notify.data.model.Notice;
import com.example.notify.data.model.User;
import com.example.notify.data.repository.NoticeRepository;
import com.example.notify.data.repository.RestNoticeRepository;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.textfield.TextInputEditText;
import java.util.Locale;

public class CreateNoticeActivity
  extends com.example.notify.ui.SessionActivity
{

  private ImageButton btnBack;
  private ChipGroup chipGroupCategory;
  private AutoCompleteTextView actvAudience;
  private TextInputEditText etTitle, etMessage;
  private MaterialButton btnAttachDocument, btnAnalyzeDocument, btnSend;
  private TextView tvDocumentAnalysis;
  private int analysisGeneration;

  // Attachment controls
  private View layoutSelectedAttachment;
  private ImageView ivSelectedAttachmentIcon;
  private TextView tvSelectedAttachmentName;
  private ImageButton btnRemoveAttachment;

  private String attachedFileName = null;
  private String attachedFileSize = null;
  private String attachedFileType = null;
  private String attachedFileUrl = null;

  private NoticeRepository noticeRepository;
  private User currentUser;

  private ActivityResultLauncher<Intent> filePickerLauncher;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_create_notification);

    currentUser = com.example.notify.data.remote.ApiClient.currentUser;
    if (currentUser == null) {
      finish();
      return;
    }

    noticeRepository = RestNoticeRepository.getInstance();

    initViews();
    setupFilePickerLauncher();
    setupDropdownBasedOnRole();
    setupListeners();
  }

  private void initViews() {
    btnBack = findViewById(R.id.btnBack);
    chipGroupCategory = findViewById(R.id.chipGroupCategory);
    actvAudience = findViewById(R.id.actvAudience);
    etTitle = findViewById(R.id.etTitle);
    etMessage = findViewById(R.id.etMessage);
    btnSend = findViewById(R.id.btnSend);

    btnAttachDocument = findViewById(R.id.btnAttachDocument);
    btnAnalyzeDocument = findViewById(R.id.btnAnalyzeDocument);
    tvDocumentAnalysis = findViewById(R.id.tvDocumentAnalysis);
    layoutSelectedAttachment = findViewById(R.id.layoutSelectedAttachment);
    ivSelectedAttachmentIcon = findViewById(R.id.ivSelectedAttachmentIcon);
    tvSelectedAttachmentName = findViewById(R.id.tvSelectedAttachmentName);
    btnRemoveAttachment = findViewById(R.id.btnRemoveAttachment);
  }

  private void setupFilePickerLauncher() {
    filePickerLauncher = registerForActivityResult(
      new ActivityResultContracts.StartActivityForResult(),
      result -> {
        if (result.getResultCode() == RESULT_OK && result.getData() != null) {
          Uri uri = result.getData().getData();
          if (uri != null) {
            handlePickedDocument(uri);
          }
        }
      }
    );
  }

  private void handlePickedDocument(Uri uri) {
    String displayName = null;
    long sizeBytes = -1;

    try (
      Cursor cursor = getContentResolver().query(uri, null, null, null, null)
    ) {
      if (cursor != null && cursor.moveToFirst()) {
        int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
        int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);

        if (nameIndex != -1) {
          displayName = cursor.getString(nameIndex);
        }
        if (sizeIndex != -1) {
          sizeBytes = cursor.getLong(sizeIndex);
        }
      }
    } catch (Exception e) {
      // Fallback to path segment if query fails
    }

    if (displayName == null || displayName.trim().isEmpty()) {
      displayName =
        uri.getLastPathSegment() != null
          ? uri.getLastPathSegment()
          : "Attached_Document.pdf";
    }

    String sizeStr = "Size unavailable";
    if (sizeBytes > 0) {
      if (sizeBytes >= 1024 * 1024) {
        sizeStr = String.format(
          Locale.US,
          "%.1f MB",
          sizeBytes / (1024.0 * 1024.0)
        );
      } else {
        sizeStr = sizeBytes / 1024 + " KB";
      }
    }

    String type = "pdf";
    String lower = displayName.toLowerCase(Locale.ROOT);
    if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
      type = "docx";
    } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      type = "xlsx";
    }

    // Persist picked document immediately into app-internal attachments storage
    java.io.File savedFile =
      com.example.notify.utils.PdfDocumentHelper.savePickedDocument(
        this,
        uri,
        displayName
      );
    if (savedFile == null || !savedFile.isFile()) {
      Toast.makeText(this, "Could not read the selected file. Choose it again.", Toast.LENGTH_LONG).show();
      return;
    }
    setAttachedDocument(displayName, sizeStr, type, savedFile.getAbsolutePath());
  }

  private void setAttachedDocument(
    String name,
    String size,
    String type,
    String url
  ) {
    attachedFileName = name;
    attachedFileSize = size;
    attachedFileType = type;
    attachedFileUrl = url;
    btnAnalyzeDocument.setEnabled(true);
    analyzeSelectedDocument(false);

    if (tvSelectedAttachmentName != null) {
      tvSelectedAttachmentName.setText(name + " (" + size + ")");
    }

    if (ivSelectedAttachmentIcon != null) {
      if ("docx".equalsIgnoreCase(type) || "doc".equalsIgnoreCase(type)) {
        ivSelectedAttachmentIcon.setImageResource(R.drawable.ic_attach_file);
      } else {
        ivSelectedAttachmentIcon.setImageResource(R.drawable.ic_pdf);
      }
    }

    if (layoutSelectedAttachment != null) {
      layoutSelectedAttachment.setVisibility(View.VISIBLE);
    }

    Toast.makeText(this, " Attached: " + name, Toast.LENGTH_SHORT).show();
  }

  private void showAttachmentOptionsDialog() {
    launchStorageFilePicker();
  }

  private void analyzeSelectedDocument(boolean replace) {
    final String path = attachedFileUrl;
    final String name = attachedFileName;
    final int generation = ++analysisGeneration;
    if (path == null || name == null) return;
    if (!name.toLowerCase(java.util.Locale.ROOT).matches(".*\\.(pdf|docx)")) {
      tvDocumentAnalysis.setText("Enter a title for this document. Automatic wording supports PDF and DOCX.");
      return;
    }
    btnAnalyzeDocument.setEnabled(false);
    btnSend.setEnabled(false);
    tvDocumentAnalysis.setText("Reading the document and finding the key notice details...");
    com.example.notify.data.remote.ApiClient.async(
      () -> com.example.notify.data.remote.ApiClient.analyzeDocument(new java.io.File(path), name),
      new com.example.notify.data.remote.ApiClient.Callback<org.json.JSONObject>() {
        public void success(org.json.JSONObject result) {
          if (isFinishing() || generation != analysisGeneration) return;
          btnAnalyzeDocument.setEnabled(true);
          btnSend.setEnabled(!audienceIds.isEmpty());
          String title = result.optString("title");
          if (etTitle.getText() != null && (replace || etTitle.getText().toString().trim().isEmpty()) && !title.isEmpty()) etTitle.setText(title);
          if (etMessage.getText() != null && (replace || etMessage.getText().toString().trim().isEmpty()) && !result.optString("summary").isEmpty()) etMessage.setText(result.optString("summary"));
          if (chipGroupCategory.getCheckedChipId() == R.id.chipAnnouncement) {
            if ("EXAM".equals(result.optString("category"))) chipGroupCategory.check(R.id.chipExam);
            else if ("EVENT".equals(result.optString("category"))) chipGroupCategory.check(R.id.chipEvent);
          }
          org.json.JSONArray phrases = result.optJSONArray("keywords");
          StringBuilder details = new StringBuilder(result.optString("warning"));
          if (phrases != null && phrases.length() > 0) details.append(" Key information: ").append(phrases.optString(0));
          String ocrWarning = result.optString("ocrWarning");
          if (!ocrWarning.isEmpty()) details.append(" ").append(ocrWarning);
          tvDocumentAnalysis.setText(details.toString());
        }
        public void error(Exception error) {
          if (isFinishing() || generation != analysisGeneration) return;
          btnAnalyzeDocument.setEnabled(true);
          btnSend.setEnabled(!audienceIds.isEmpty());
          tvDocumentAnalysis.setText("Could not analyze this file. Check it and enter a title yourself. " + error.getMessage());
        }
      }
    );
  }

  private void launchStorageFilePicker() {
    Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
    intent.setType("*/*");
    String[] mimeTypes = {
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);
    intent.addCategory(Intent.CATEGORY_OPENABLE);

    try {
      filePickerLauncher.launch(
        Intent.createChooser(intent, "Select PDF or Document")
      );
    } catch (Exception e) {
      Toast.makeText(
        this,
        "Unable to open file picker: " + e.getMessage(),
        Toast.LENGTH_SHORT
      ).show();
    }
  }

  private final java.util.LinkedHashMap<
    String,
    org.json.JSONObject
  > audienceIds = new java.util.LinkedHashMap<>();

  private void setupDropdownBasedOnRole() {
    btnSend.setEnabled(false);
    com.example.notify.data.remote.ApiClient.async(
      () -> {
        currentUser = com.example.notify.data.remote.ApiClient.refreshSession();
        return new org.json.JSONArray(
          com.example.notify.data.remote.ApiClient.request(
            "/api/audiences",
            "GET",
            null
          )
        );
      },
      new com.example.notify.data.remote.ApiClient.Callback<org.json.JSONArray>() {
        public void success(org.json.JSONArray choices) {
          audienceIds.clear();
          for (int i = 0; i < choices.length(); i++) {
            org.json.JSONObject choice = choices.optJSONObject(i);
            if (choice != null) audienceIds.put(
              choice.optString("label"),
              choice
            );
          }
          String[] audiences = audienceIds.keySet().toArray(new String[0]);
          actvAudience.setAdapter(
            new ArrayAdapter<>(
              CreateNoticeActivity.this,
              android.R.layout.simple_dropdown_item_1line,
              audiences
            )
          );
          if (audiences.length > 0) actvAudience.setText(audiences[0], false);
          btnSend.setEnabled(
            currentUser.isApproved() &&
              currentUser.getRole() != User.Role.STUDENT &&
              audiences.length > 0
          );
        }

        public void error(Exception e) {
          Toast.makeText(
            CreateNoticeActivity.this,
            e.getMessage(),
            Toast.LENGTH_LONG
          ).show();
        }
      }
    );
  }

  private void setupListeners() {
    // Robust navigation back to previous screen or MainActivity
    btnBack.setOnClickListener(v -> {
      if (isTaskRoot()) {
        Intent intent = new Intent(
          CreateNoticeActivity.this,
          MainActivity.class
        );
        intent.setFlags(
          Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        startActivity(intent);
      }
      finish();
    });

    // Document Attachment Handling: Choose an original document from device storage
    btnAttachDocument.setOnClickListener(v -> showAttachmentOptionsDialog());
    btnAnalyzeDocument.setOnClickListener(v -> analyzeSelectedDocument(true));

    btnRemoveAttachment.setOnClickListener(v -> {
      analysisGeneration++;
      attachedFileName = null;
      attachedFileSize = null;
      attachedFileType = null;
      attachedFileUrl = null;
      btnAnalyzeDocument.setEnabled(false);
      tvDocumentAnalysis.setText("");
      btnSend.setEnabled(!audienceIds.isEmpty());
      if (layoutSelectedAttachment != null) {
        layoutSelectedAttachment.setVisibility(View.GONE);
      }
      Toast.makeText(this, "Attachment removed", Toast.LENGTH_SHORT).show();
    });

    btnSend.setOnClickListener(v -> {
      String title =
        etTitle.getText() != null ? etTitle.getText().toString().trim() : "";
      String message =
        etMessage.getText() != null
          ? etMessage.getText().toString().trim()
          : "";

      if (title.isEmpty()) {
        etTitle.setError("Please enter a notice title");
        return;
      }

      // Determine category
      Notice.Category category = Notice.Category.ANNOUNCEMENT;
      Notice.Urgency urgency = Notice.Urgency.NORMAL;
      int checkedChipId = chipGroupCategory.getCheckedChipId();

      if (checkedChipId == R.id.chipUrgent) {
        category = Notice.Category.URGENT;
        urgency = Notice.Urgency.CRITICAL;
      } else if (checkedChipId == R.id.chipExam) {
        category = Notice.Category.EXAM;
        urgency = Notice.Urgency.HIGH;
      } else if (checkedChipId == R.id.chipEvent) {
        category = Notice.Category.EVENT;
        urgency = Notice.Urgency.NORMAL;
      }

      // Determine target dept based on user's authorized scope
      String selectedAudience = actvAudience.getText().toString();
      org.json.JSONObject audience = audienceIds.get(selectedAudience);
      String targetDept =
        audience == null ? null : audience.optString("departmentId", "");
      if ("".equals(targetDept)) targetDept = "ALL";
      if (targetDept == null) {
        actvAudience.setError(
          "Choose an available class or broadcast audience."
        );
        return;
      }

      Notice newNotice = new Notice(
        null,
        title,
        message,
        currentUser.getName(),
        currentUser.getRole(),
        targetDept,
        selectedAudience,
        category,
        urgency,
        System.currentTimeMillis(),
        attachedFileName,
        attachedFileType,
        attachedFileSize,
        attachedFileUrl != null
          ? attachedFileUrl
          : attachedFileName != null
            ? "file://" + attachedFileName
            : null
      );

      newNotice.setGroupId(audience.optString("groupId", ""));
      boolean draft = (
        (android.widget.CheckBox) findViewById(R.id.cbSaveDraft)
      ).isChecked();
      newNotice.setPublicationStatus(draft ? "DRAFT" : "PUBLISHED");
      btnSend.setEnabled(false);
      btnSend.setText("Saving...");

      noticeRepository.publishNotice(
        newNotice,
        new NoticeRepository.Callback<Notice>() {
          @Override
          public void onSuccess(Notice result) {
            Toast.makeText(
              CreateNoticeActivity.this,
              "Notice saved.",
              Toast.LENGTH_SHORT
            ).show();
            finish();
          }

          @Override
          public void onError(Exception e) {
            btnSend.setEnabled(true);
            btnSend.setText("Save notice");
            Toast.makeText(
              CreateNoticeActivity.this,
              "Could not save notice: " + e.getMessage(),
              Toast.LENGTH_SHORT
            ).show();
          }
        }
      );
    });
  }
}
