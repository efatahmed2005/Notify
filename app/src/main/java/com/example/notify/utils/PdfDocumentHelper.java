package com.example.notify.utils;

import android.content.Context;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Environment;
import android.util.Log;
import androidx.core.content.FileProvider;
import com.example.notify.data.model.Notice;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;

/**
 * Utility for storing and opening user-selected document attachments.
 */
public class PdfDocumentHelper {

  private static final String TAG = "PdfDocumentHelper";
  private static final String ATTACHMENTS_DIR_NAME = "attachments";

  public static File getAttachmentsDir(Context context) {
    File dir = new File(context.getFilesDir(), ATTACHMENTS_DIR_NAME);
    if (!dir.exists()) {
      dir.mkdirs();
    }
    return dir;
  }

  /**
   * Persists a picked document from content:// URI into internal app storage.
   * Guarantees long-term accessibility across all activities and user roles.
   */
  public static File savePickedDocument(
    Context context,
    Uri uri,
    String originalName
  ) {
    if (uri == null || context == null) return null;

    String safeName =
      originalName != null && !originalName.trim().isEmpty()
        ? originalName.replaceAll("[^a-zA-Z0-9._-]", "_")
        : "Attached_Document.pdf";

    File attachmentsDir = getAttachmentsDir(context);
    File destFile = new File(
      attachmentsDir,
      System.currentTimeMillis() + "_" + safeName
    );

    try (
      InputStream in = context.getContentResolver().openInputStream(uri);
      OutputStream out = new FileOutputStream(destFile)
    ) {
      if (in == null) return null;

      byte[] buffer = new byte[16384];
      int bytesRead;
      while ((bytesRead = in.read(buffer)) != -1) {
        out.write(buffer, 0, bytesRead);
      }
      out.flush();
      return destFile;
    } catch (Exception e) {
      Log.e(TAG, "Failed to persist attached document from URI: " + uri, e);
      return null;
    }
  }

  /**
   * Resolves the actual physical file for any notice attachment.
   * Returns null when the original file is unavailable.
   */
  public static File resolveAttachmentFile(Context context, Notice notice) {
    if (notice == null || !notice.hasAttachment()) return null;

    String url = notice.getAttachmentUrl();
    String name = notice.getAttachmentName();

    // 1. Check if url is an existing physical file path
    if (url != null && !url.trim().isEmpty()) {
      File directFile = new File(url);
      if (directFile.exists() && directFile.length() > 0) {
        return directFile;
      }

      if (url.startsWith("file://")) {
        File parsedFile = new File(Uri.parse(url).getPath());
        if (parsedFile.exists() && parsedFile.length() > 0) {
          return parsedFile;
        }
      }

      if (url.startsWith("content://")) {
        // Attempt to copy content URI to local file if not already copied
        File copied = savePickedDocument(context, Uri.parse(url), name);
        if (copied != null && copied.exists()) {
          return copied;
        }
      }
    }

    return null;
  }

  public static void openDocumentExternally(
    Context context,
    File file,
    String mimeType
  ) {
    if (context == null || file == null || !file.exists()) return;

    try {
      Uri contentUri = FileProvider.getUriForFile(
        context,
        context.getPackageName() + ".provider",
        file
      );

      Intent intent = new Intent(Intent.ACTION_VIEW);
      intent.setDataAndType(
        contentUri,
        mimeType != null ? mimeType : "application/pdf"
      );
      intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

      context.startActivity(Intent.createChooser(intent, "Open Document With"));
    } catch (Exception e) {
      Log.e(TAG, "Failed to launch external viewer for: " + file.getName(), e);
    }
  }

  /** Writes only to a document location explicitly selected by the user. */
  public static boolean saveToUri(
    Context context,
    File sourceFile,
    Uri target
  ) {
    if (
      sourceFile == null || target == null || !sourceFile.isFile()
    ) return false;
    try (
      InputStream input = new FileInputStream(sourceFile);
      OutputStream output = context
        .getContentResolver()
        .openOutputStream(target, "wt")
    ) {
      if (output == null) return false;
      byte[] buffer = new byte[16384];
      int count;
      while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
      output.flush();
      return true;
    } catch (Exception error) {
      return false;
    }
  }
}
