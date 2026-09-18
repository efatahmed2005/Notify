package com.example.notify.data.repository;

import com.example.notify.data.model.Notice;
import com.example.notify.data.model.User;
import java.util.List;

/**
 * NoticeRepository defines standard CRUD and real-time observation methods.
 * Implementations can be MockNoticeRepository, FirebaseNoticeRepository, or RestNoticeRepository.
 */
public interface NoticeRepository {

    interface Callback<T> {
        void onSuccess(T result);
        void onError(Exception e);
    }

    interface RealtimeNoticeListener {
        void onNoticesUpdated(List<Notice> notices);
        void onError(Exception e);
    }

    // Fetch all active notices
    void getAllNotices(Callback<List<Notice>> callback);

    // Fetch notices filtered for a specific role and department
    void getNoticesForUser(User user, Callback<List<Notice>> callback);

    // Filter by category and search query
    void getFilteredNotices(User user, Notice.Category category, String searchQuery, Callback<List<Notice>> callback);

    // Publish a new notice
    void publishNotice(Notice notice, Callback<Notice> callback);

    // Delete a notice by ID
    void deleteNotice(String noticeId, Callback<Boolean> callback);

    // Real-time synchronization stream observer
    void registerRealtimeListener(RealtimeNoticeListener listener);
    void unregisterRealtimeListener(RealtimeNoticeListener listener);
}
