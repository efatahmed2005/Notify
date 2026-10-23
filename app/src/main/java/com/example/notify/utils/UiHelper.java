package com.example.notify.utils;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;
import com.example.notify.R;
import com.example.notify.data.model.Notice;

public class UiHelper {

    public static int getCategoryBadgeBackground(Notice.Category category) {
        if (category == null) return R.drawable.bg_badge_announcement;
        switch (category) {
            case URGENT:
                return R.drawable.bg_badge_urgent;
            case EXAM:
                return R.drawable.bg_badge_exam;
            case EVENT:
                return R.drawable.bg_badge_event;
            case ANNOUNCEMENT:
            default:
                return R.drawable.bg_badge_announcement;
        }
    }

    public static int getCategoryTextColor(Context context, Notice.Category category) {
        if (category == null) return context.getColor(R.color.badge_announcement_text);
        switch (category) {
            case URGENT:
                return context.getColor(R.color.badge_urgent_text);
            case EXAM:
                return context.getColor(R.color.badge_exam_text);
            case EVENT:
                return context.getColor(R.color.badge_event_text);
            case ANNOUNCEMENT:
            default:
                return context.getColor(R.color.badge_announcement_text);
        }
    }

    public static String getCategoryLabel(Notice.Category category) {
        if (category == null) return " Announcement";
        switch (category) {
            case URGENT:
                return " Urgent Alert";
            case EXAM:
                return " Examination";
            case EVENT:
                return " Campus Event";
            case ANNOUNCEMENT:
            default:
                return " Announcement";
        }
    }

    public static void copyNoticeToClipboard(Context context, Notice notice) {
        ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
        String text = notice.getTitle() + "\n\n" + notice.getContent() + "\n\n— " + notice.getPublisherName();
        ClipData clip = ClipData.newPlainText("Notice", text);
        if (clipboard != null) {
            clipboard.setPrimaryClip(clip);
            Toast.makeText(context, "Notice copied to clipboard", Toast.LENGTH_SHORT).show();
        }
    }

    public static void shareNotice(Context context, Notice notice) {
        String shareBody = " *" + notice.getTitle() + "*\n\n" +
                notice.getContent() + "\n\n" +
                "Target: " + notice.getTargetAudience() + " (" + notice.getTargetDepartment() + ")\n" +
                "Published by: " + notice.getPublisherName() + "\n" +
                "Via Notify Institutional Portal";

        Intent sharingIntent = new Intent(Intent.ACTION_SEND);
        sharingIntent.setType("text/plain");
        sharingIntent.putExtra(Intent.EXTRA_SUBJECT, notice.getTitle());
        sharingIntent.putExtra(Intent.EXTRA_TEXT, shareBody);
        context.startActivity(Intent.createChooser(sharingIntent, "Share Notice via"));
    }
}
