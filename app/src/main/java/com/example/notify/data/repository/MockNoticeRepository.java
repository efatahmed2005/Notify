package com.example.notify.data.repository;

import android.os.Handler;
import android.os.Looper;
import com.example.notify.data.model.Notice;
import com.example.notify.data.model.User;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * In-Memory Mock Repository for Notifyy.
 * Provides realistic university notices across campus, department, and course tiers.
 * 
 * =========================================================================
 * BACKEND INTEGRATION NOTE:
 * To swap this with Firebase Realtime Database:
 *   1. Replace the local 'notices' list with 'FirebaseDatabase.getInstance().getReference("notices")'
 *   2. In 'publishNotice', call 'reference.child(id).setValue(notice)'
 *   3. In 'registerRealtimeListener', attach 'ValueEventListener' or 'ChildEventListener'
 * =========================================================================
 */
public class MockNoticeRepository implements NoticeRepository {

    private static MockNoticeRepository instance;
    private final List<Notice> notices = new CopyOnWriteArrayList<>();
    private final List<RealtimeNoticeListener> listeners = new CopyOnWriteArrayList<>();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private MockNoticeRepository() {
        populateInitialMockData();
    }

    public static synchronized MockNoticeRepository getInstance() {
        if (instance == null) {
            instance = new MockNoticeRepository();
        }
        return instance;
    }

    private void populateInitialMockData() {
        long now = System.currentTimeMillis();
        long hour = 3600 * 1000;
        long day = 24 * hour;

        notices.add(new Notice(
                "NTC-101",
                "⚠️ Campus Power Maintenance & Server Downtime",
                "Please be advised that the central datacenter and main academic buildings will undergo scheduled electrical maintenance this Saturday from 08:00 AM to 02:00 PM. Portal services will be temporarily unavailable.",
                "Dr. Robert Vance (Registrar)",
                User.Role.ADMIN,
                "ALL",
                "Campus-Wide",
                Notice.Category.URGENT,
                Notice.Urgency.CRITICAL,
                now - (2 * hour)
        ));

        notices.add(new Notice(
                "NTC-102",
                "📝 Spring 2026 Final Examination Routine Released",
                "The official timetable for the undergraduate Final Term Examinations has been uploaded to the university portal. Students must resolve any registration holds and collect admit cards by Friday.",
                "Office of the Controller of Exams",
                User.Role.ADMIN,
                "ALL",
                "All Students",
                Notice.Category.EXAM,
                Notice.Urgency.HIGH,
                now - (5 * hour),
                "Spring_2026_Final_Exam_Routine.pdf",
                "pdf",
                "1.8 MB",
                "mock://documents/Spring_2026_Final_Exam_Routine.pdf"
        ));

        notices.add(new Notice(
                "NTC-103",
                "🗓️ IEEE Annual Tech Symposium & Hackathon 2026",
                "Join us for the 7th Annual CSE & EEE Inter-University Hackathon! Exciting prize pools, industry keynote speakers, and internship opportunities for top performing teams.",
                "Prof. Alan Turing (CSE HOD)",
                User.Role.DEPT_ADMIN,
                "CSE",
                "CSE & EEE Faculty/Students",
                Notice.Category.EVENT,
                Notice.Urgency.NORMAL,
                now - (1 * day)
        ));

        notices.add(new Notice(
                "NTC-104",
                "📢 Room Rescheduling: CSE420 Distributed Systems",
                "Today's lecture on Distributed Consensus Algorithms has been relocated from Room 304 to Multimedia Auditorium 2 due to projector maintenance.",
                "Dr. Grace Hopper (Faculty)",
                User.Role.TEACHER,
                "CSE",
                "CSE Batch 2023",
                Notice.Category.ANNOUNCEMENT,
                Notice.Urgency.NORMAL,
                now - (30 * 60 * 1000)
        ));

        notices.add(new Notice(
                "NTC-105",
                "📝 Lab Assignment 3 Deadline Extension",
                "The submission deadline for the Operating Systems Virtual Memory simulation project is extended to Sunday 11:59 PM. Submit your GitHub repositories via Google Classroom.",
                "Prof. Linus Torvalds (Faculty)",
                User.Role.TEACHER,
                "CSE",
                "CSE312 Enrolled",
                Notice.Category.ANNOUNCEMENT,
                Notice.Urgency.NORMAL,
                now - (3 * hour),
                "OS_Virtual_Memory_Lab3_Spec.pdf",
                "pdf",
                "840 KB",
                "mock://documents/OS_Virtual_Memory_Lab3_Spec.pdf"
        ));

        notices.add(new Notice(
                "NTC-201",
                "⚡ EEE: Microcontroller & Embedded Systems Lab",
                "Students of EEE Batch 2024 must report to Embedded Systems Lab 2 for STM32 hardware kit allocation. Bring your lab journals.",
                "Dr. Nikola Tesla (EEE Faculty)",
                User.Role.TEACHER,
                "EEE",
                "EEE Batch 2024",
                Notice.Category.ANNOUNCEMENT,
                Notice.Urgency.NORMAL,
                now - (4 * hour),
                "STM32_Embedded_Lab_Manual.pdf",
                "pdf",
                "1.5 MB",
                "mock://documents/STM32_Embedded_Lab_Manual.pdf"
        ));

        notices.add(new Notice(
                "NTC-202",
                "📈 BBA: Strategic Management Case Study Submission",
                "Final presentation slides and HBR case analysis report must be submitted to the department portal by Monday 5:00 PM.",
                "Prof. Philip Kotler (BBA HOD)",
                User.Role.DEPT_ADMIN,
                "BBA",
                "BBA Final Year Students",
                Notice.Category.ANNOUNCEMENT,
                Notice.Urgency.NORMAL,
                now - (6 * hour),
                "BBA_Case_Study_Framework.docx",
                "docx",
                "620 KB",
                "mock://documents/BBA_Case_Study_Framework.docx"
        ));

        notices.add(new Notice(
                "NTC-203",
                "⚖️ LAW: Annual Moot Court Competition Registration",
                "Registration is now open for the 2026 Inter-University Constitutional Law Moot Court competition. Teams must register with the faculty dean.",
                "Dean of Law Faculty",
                User.Role.DEPT_ADMIN,
                "LAW",
                "All Law Students",
                Notice.Category.EVENT,
                Notice.Urgency.NORMAL,
                now - (12 * hour),
                "Moot_Court_2026_Rules.pdf",
                "pdf",
                "1.1 MB",
                "mock://documents/Moot_Court_2026_Rules.pdf"
        ));
    }

    @Override
    public void getAllNotices(Callback<List<Notice>> callback) {
        mainHandler.postDelayed(() -> {
            List<Notice> list = new ArrayList<>(notices);
            Collections.sort(list, (a, b) -> Long.compare(b.getTimestamp(), a.getTimestamp()));
            callback.onSuccess(list);
        }, 150);
    }

    @Override
    public void getNoticesForUser(User user, Callback<List<Notice>> callback) {
        mainHandler.postDelayed(() -> {
            List<Notice> filtered = new ArrayList<>();
            for (Notice n : notices) {
                if (user == null || user.getRole() == User.Role.ADMIN) {
                    filtered.add(n);
                } else if (user.getRole() == User.Role.DEPT_ADMIN || user.getRole() == User.Role.TEACHER || user.getRole() == User.Role.STUDENT) {
                    if ("ALL".equalsIgnoreCase(n.getTargetDepartment()) || 
                        (user.getDepartmentId() != null && user.getDepartmentId().equalsIgnoreCase(n.getTargetDepartment()))) {
                        filtered.add(n);
                    }
                }
            }
            Collections.sort(filtered, (a, b) -> Long.compare(b.getTimestamp(), a.getTimestamp()));
            callback.onSuccess(filtered);
        }, 150);
    }

    @Override
    public void getFilteredNotices(User user, Notice.Category category, String searchQuery, Callback<List<Notice>> callback) {
        mainHandler.postDelayed(() -> {
            List<Notice> result = new ArrayList<>();
            String queryLower = searchQuery != null ? searchQuery.toLowerCase().trim() : "";

            for (Notice n : notices) {
                boolean matchesRoleDept = (user == null || user.getRole() == User.Role.ADMIN) ||
                        "ALL".equalsIgnoreCase(n.getTargetDepartment()) ||
                        (user.getDepartmentId() != null && user.getDepartmentId().equalsIgnoreCase(n.getTargetDepartment()));

                boolean matchesCategory = (category == null || n.getCategory() == category);

                boolean matchesQuery = queryLower.isEmpty() ||
                        n.getTitle().toLowerCase().contains(queryLower) ||
                        n.getContent().toLowerCase().contains(queryLower) ||
                        n.getPublisherName().toLowerCase().contains(queryLower) ||
                        n.getTargetDepartment().toLowerCase().contains(queryLower);

                if (matchesRoleDept && matchesCategory && matchesQuery) {
                    result.add(n);
                }
            }
            Collections.sort(result, (a, b) -> Long.compare(b.getTimestamp(), a.getTimestamp()));
            callback.onSuccess(result);
        }, 150);
    }

    @Override
    public void publishNotice(Notice notice, Callback<Notice> callback) {
        mainHandler.postDelayed(() -> {
            if (notice.getNoticeId() == null || notice.getNoticeId().isEmpty()) {
                notice.setNoticeId("NTC-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase());
            }
            if (notice.getTimestamp() == 0) {
                notice.setTimestamp(System.currentTimeMillis());
            }

            notices.add(0, notice); // Insert at top
            notifyListeners();

            if (callback != null) {
                callback.onSuccess(notice);
            }
        }, 200);
    }

    @Override
    public void deleteNotice(String noticeId, Callback<Boolean> callback) {
        mainHandler.postDelayed(() -> {
            boolean removed = notices.removeIf(n -> n.getNoticeId().equals(noticeId));
            if (removed) {
                notifyListeners();
            }
            if (callback != null) {
                callback.onSuccess(removed);
            }
        }, 150);
    }

    @Override
    public void registerRealtimeListener(RealtimeNoticeListener listener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener);
            listener.onNoticesUpdated(new ArrayList<>(notices));
        }
    }

    @Override
    public void unregisterRealtimeListener(RealtimeNoticeListener listener) {
        listeners.remove(listener);
    }

    private void notifyListeners() {
        List<Notice> current = new ArrayList<>(notices);
        Collections.sort(current, (a, b) -> Long.compare(b.getTimestamp(), a.getTimestamp()));
        for (RealtimeNoticeListener l : listeners) {
            l.onNoticesUpdated(current);
        }
    }
}
