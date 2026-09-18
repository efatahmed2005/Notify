package com.example.notify.data.model;

import java.io.Serializable;

/**
 * Notice data model for institutional announcements.
 * Supports file attachments (PDF/Docs) and RBAC target rules.
 */
public class Notice implements Serializable {
    public enum Category {
        ANNOUNCEMENT, // 📢 General Announcement
        EXAM,         // 📝 Exam Schedule / Updates
        URGENT,       // ⚠️ Urgent Notice / Alert
        EVENT         // 🗓️ Seminar / Event / Workshop
    }

    public enum Urgency {
        NORMAL,
        HIGH,
        CRITICAL
    }

    private String noticeId;
    private String title;
    private String content;
    private String publisherName;
    private User.Role publisherRole;
    private String targetDepartment; // "ALL", "CSE", "EEE", "BBA", etc.
    private String targetAudience;   // "Campus-Wide", "Department Only", "Batch 2024", etc.
    private Category category;
    private Urgency urgency;
    private long timestamp; // Unix epoch millis

    // Attachment fields (PDF / Documents)
    private String attachmentName;
    private String attachmentType; // "pdf", "doc", "docx"
    private String attachmentSize; // e.g. "1.4 MB"
    private String attachmentUrl;

    public Notice() {
        // Default constructor for Firebase / JSON deserialization
    }

    public Notice(String noticeId, String title, String content, String publisherName, 
                  User.Role publisherRole, String targetDepartment, String targetAudience, 
                  Category category, Urgency urgency, long timestamp) {
        this(noticeId, title, content, publisherName, publisherRole, targetDepartment, 
             targetAudience, category, urgency, timestamp, null, null, null, null);
    }

    public Notice(String noticeId, String title, String content, String publisherName, 
                  User.Role publisherRole, String targetDepartment, String targetAudience, 
                  Category category, Urgency urgency, long timestamp,
                  String attachmentName, String attachmentType, String attachmentSize, String attachmentUrl) {
        this.noticeId = noticeId;
        this.title = title;
        this.content = content;
        this.publisherName = publisherName;
        this.publisherRole = publisherRole;
        this.targetDepartment = targetDepartment;
        this.targetAudience = targetAudience;
        this.category = category;
        this.urgency = urgency;
        this.timestamp = timestamp;
        this.attachmentName = attachmentName;
        this.attachmentType = attachmentType;
        this.attachmentSize = attachmentSize;
        this.attachmentUrl = attachmentUrl;
    }

    public boolean hasAttachment() {
        return attachmentName != null && !attachmentName.trim().isEmpty();
    }

    // Getters and Setters
    public String getNoticeId() { return noticeId; }
    public void setNoticeId(String noticeId) { this.noticeId = noticeId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getPublisherName() { return publisherName; }
    public void setPublisherName(String publisherName) { this.publisherName = publisherName; }

    public User.Role getPublisherRole() { return publisherRole; }
    public void setPublisherRole(User.Role publisherRole) { this.publisherRole = publisherRole; }

    public String getTargetDepartment() { return targetDepartment; }
    public void setTargetDepartment(String targetDepartment) { this.targetDepartment = targetDepartment; }

    public String getTargetAudience() { return targetAudience; }
    public void setTargetAudience(String targetAudience) { this.targetAudience = targetAudience; }

    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }

    public Urgency getUrgency() { return urgency; }
    public void setUrgency(Urgency urgency) { this.urgency = urgency; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }

    public String getAttachmentName() { return attachmentName; }
    public void setAttachmentName(String attachmentName) { this.attachmentName = attachmentName; }

    public String getAttachmentType() { return attachmentType; }
    public void setAttachmentType(String attachmentType) { this.attachmentType = attachmentType; }

    public String getAttachmentSize() { return attachmentSize; }
    public void setAttachmentSize(String attachmentSize) { this.attachmentSize = attachmentSize; }

    public String getAttachmentUrl() { return attachmentUrl; }
    public void setAttachmentUrl(String attachmentUrl) { this.attachmentUrl = attachmentUrl; }
}
