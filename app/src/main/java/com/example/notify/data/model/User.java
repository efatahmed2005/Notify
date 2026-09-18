package com.example.notify.data.model;

import java.io.Serializable;

/**
 * User data model for Notifyy platform.
 * Supports 4-tier institutional roles: ADMIN, DEPT_ADMIN, TEACHER, STUDENT.
 */
public class User implements Serializable {
    public enum Role {
        ADMIN,          // University Admin
        DEPT_ADMIN,     // Department Head / HOD
        TEACHER,        // Faculty Member
        STUDENT         // Enrolled Student
    }

    private String userId;
    private String name;
    private String email;
    private Role role;
    private String departmentId; // e.g., "CSE", "EEE", "BBA", or "ALL"

    public User() {
        // Default constructor for Firebase / JSON deserialization
    }

    public User(String userId, String name, String email, Role role, String departmentId) {
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.role = role;
        this.departmentId = departmentId;
    }

    // Getters and Setters
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public String getDepartmentId() { return departmentId; }
    public void setDepartmentId(String departmentId) { this.departmentId = departmentId; }
}
