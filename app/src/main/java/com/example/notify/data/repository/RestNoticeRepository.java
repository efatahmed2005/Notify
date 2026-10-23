package com.example.notify.data.repository;

import android.os.Handler;
import android.os.Looper;
import com.example.notify.data.model.Notice;
import com.example.notify.data.model.User;
import com.example.notify.data.remote.ApiClient;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;
import org.json.JSONArray;
import org.json.JSONObject;

/** Server-authorized notice access. Client filters only narrow already authorized results. */
public final class RestNoticeRepository implements NoticeRepository {

  private static final RestNoticeRepository INSTANCE =
    new RestNoticeRepository();
  private final List<RealtimeNoticeListener> listeners =
    new CopyOnWriteArrayList<>();
  private final Handler handler = new Handler(Looper.getMainLooper());

  public static RestNoticeRepository getInstance() {
    return INSTANCE;
  }

  public static Notice parse(JSONObject n) throws Exception {
    String dept = n.getString("department"),
      label = "Campus-wide";
    User user = ApiClient.currentUser;
    if (!"ALL".equals(dept)) {
      label = "Department";
      if (user != null) label = user
        .getDepartmentNames()
        .getOrDefault(dept, label);
    }
    Notice notice = new Notice(
      n.getString("id"),
      n.getString("title"),
      n.getString("content"),
      n.getString("author"),
      User.Role.valueOf(n.getString("authorRole")),
      dept,
      label,
      Notice.Category.valueOf(n.getString("category")),
      Notice.Urgency.NORMAL,
      n.getLong("created")
    );
    notice.setPublicationStatus(n.getString("status"));
    notice.setVersion(n.getInt("version"));
    JSONObject file = n.optJSONObject("file");
    if (file != null) {
      notice.setAttachmentName(file.getString("name"));
      notice.setAttachmentSize(file.getLong("size") / 1024 + " KB");
      notice.setAttachmentUrl("server://" + notice.getNoticeId());
    }
    return notice;
  }

  public void getAllNotices(Callback<List<Notice>> callback) {
    getFilteredNotices(null, null, "", callback);
  }

  public void getNoticesForUser(User ignored, Callback<List<Notice>> callback) {
    getAllNotices(callback);
  }

  public void getFilteredNotices(
    User ignored,
    Notice.Category category,
    String query,
    Callback<List<Notice>> callback
  ) {
    ApiClient.async(
      () -> {
        JSONArray data = new JSONArray(
          ApiClient.request("/api/notices", "GET", null)
        );
        List<Notice> result = new ArrayList<>();
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        for (int i = 0; i < data.length(); i++) {
          Notice n = parse(data.getJSONObject(i));
          if (
            (category == null || n.getCategory() == category) &&
            (
              n.getTitle() +
              " " +
              n.getContent() +
              " " +
              n.getPublisherName() +
              " " +
              n.getTargetAudience()
            )
              .toLowerCase(Locale.ROOT)
              .contains(q)
          ) result.add(n);
        }
        return result;
      },
      new ApiClient.Callback<List<Notice>>() {
        public void success(List<Notice> value) {
          callback.onSuccess(value);
        }

        public void error(Exception error) {
          callback.onError(error);
        }
      }
    );
  }

  public void publishNotice(Notice notice, Callback<Notice> callback) {
    ApiClient.async(
      () -> {
        JSONObject body = new JSONObject();
        body.put("title", notice.getTitle());
        body.put("content", notice.getContent());
        body.put("category", notice.getCategory().name());
        body.put(
          "departmentId",
          "ALL".equals(notice.getTargetDepartment())
            ? ""
            : notice.getTargetDepartment()
        );
        body.put("status", notice.getPublicationStatus());
        File file = notice.hasAttachment()
          ? new File(notice.getAttachmentUrl())
          : null;
        return parse(ApiClient.publish(body, file, notice.getAttachmentName()));
      },
      new ApiClient.Callback<Notice>() {
        public void success(Notice value) {
          callback.onSuccess(value);
          notifyChanged();
        }

        public void error(Exception error) {
          callback.onError(error);
        }
      }
    );
  }

  public void deleteNotice(String id, Callback<Boolean> callback) {
    ApiClient.async(
      () -> {
        JSONObject notice = new JSONObject(
          ApiClient.request("/api/notices/" + id, "GET", null)
        );
        ApiClient.request(
          "/api/notices/" + id,
          "DELETE",
          new JSONObject().put("version", notice.getInt("version"))
        );
        return true;
      },
      new ApiClient.Callback<Boolean>() {
        public void success(Boolean value) {
          callback.onSuccess(value);
          notifyChanged();
        }

        public void error(Exception error) {
          callback.onError(error);
        }
      }
    );
  }

  private final Runnable poll = new Runnable() {
    public void run() {
      notifyChanged();
      if (!listeners.isEmpty()) handler.postDelayed(this, 30000);
    }
  };

  private void notifyChanged() {
    for (RealtimeNoticeListener listener : listeners)
      listener.onNoticesUpdated(new ArrayList<>());
  }

  public void registerRealtimeListener(RealtimeNoticeListener listener) {
    if (!listeners.contains(listener)) listeners.add(listener);
    handler.removeCallbacks(poll);
    handler.postDelayed(poll, 30000);
  }

  public void unregisterRealtimeListener(RealtimeNoticeListener listener) {
    listeners.remove(listener);
    if (listeners.isEmpty()) handler.removeCallbacks(poll);
  }
}
