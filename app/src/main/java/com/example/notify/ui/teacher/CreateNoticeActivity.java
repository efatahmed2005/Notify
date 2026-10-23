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
  private MaterialButton btnAttachDocument, btnSend;

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

    String sizeStr = "1.2 MB";
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
    String lower = displayName.toLowerCase();
    if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
      type = "docx";
    }

    // Persist picked document immediately into app-internal attachments storage
    java.io.File savedFile =
      com.example.notify.utils.PdfDocumentHelper.savePickedDocument(
        this,
        uri,
        displayName
      );
    String finalUrl =
      savedFile != null && savedFile.exists()
        ? savedFile.getAbsolutePath()
        : uri.toString();

    setAttachedDocument(displayName, sizeStr, type, finalUrl);
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

  private void launchStorageFilePicker() {
    Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
    intent.setType("*/*");
    String[] mimeTypes = {
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
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

  private final java.util.LinkedHashMap<String, String> audienceIds =
    new java.util.LinkedHashMap<>();

  private void setupDropdownBasedOnRole() {
    btnSend.setEnabled(false);
    com.example.notify.data.remote.ApiClient.async(
      com.example.notify.data.remote.ApiClient::refreshSession,
      new com.example.notify.data.remote.ApiClient.Callback<User>() {
        public void success(User user) {
          currentUser = user;
          audienceIds.clear();
          if (user.getRole() == User.Role.ADMIN) audienceIds.put(
            "Campus-wide (all departments)",
            "ALL"
          );
          for (java.util.Map.Entry<String, String> department : user
            .getDepartmentNames()
            .entrySet())
            audienceIds.put(department.getValue(), department.getKey());
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
            user.isApproved() &&
              user.getRole() != User.Role.STUDENT &&
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

    btnRemoveAttachment.setOnClickListener(v -> {
      attachedFileName = null;
      attachedFileSize = null;
      attachedFileType = null;
      attachedFileUrl = null;
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

      if (message.isEmpty()) {
        etMessage.setError("Please enter notice details");
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
      String targetDept = audienceIds.get(selectedAudience);
      if (targetDept == null) {
        actvAudience.setError("Choose an assigned department.");
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
