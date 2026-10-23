package com.example.notify.data.model;

import java.io.Serializable;

/**
 * User data model for Notify platform.
 * Display model from the authenticated API; never an authorization source.
 */
public class User implements Serializable {

  public enum Role {
    ADMIN, // University Admin
    TEACHER, // Faculty Member
    STUDENT, // Enrolled Student
  }

  private String status;
  private boolean mustChangePassword;
  private String teacherId;
  private final java.util.LinkedHashMap<String, String> departmentNames =
    new java.util.LinkedHashMap<>();
  private final java.util.List<String> headDepartmentIds =
    new java.util.ArrayList<>();

  public java.util.Map<String, String> getDepartmentNames() {
    return departmentNames;
  }

  public java.util.List<String> getHeadDepartmentIds() {
    return headDepartmentIds;
  }

  public boolean isApproved() {
    return "APPROVED".equals(status) && !mustChangePassword;
  }

  public String getTeacherId() {
    return teacherId;
  }

  public static User fromJson(org.json.JSONObject json)
    throws org.json.JSONException {
    User user = new User();
    user.userId = json.getString("id");
    user.name = json.getString("name");
    user.email = json.getString("email");
    user.role = Role.valueOf(json.getString("role"));
    user.status = json.getString("status");
    user.mustChangePassword = json.getBoolean("mustChangePassword");
    user.teacherId = json.optString("teacherId", "");
    org.json.JSONArray departments = json.getJSONArray("departments");
    for (int i = 0; i < departments.length(); i++) {
      org.json.JSONObject d = departments.getJSONObject(i);
      user.departmentNames.put(d.getString("id"), d.getString("name"));
      if (i == 0) user.departmentId = d.getString("id");
    }
    org.json.JSONArray heads = json.getJSONArray("headDepartmentIds");
    for (int i = 0; i < heads.length(); i++) user.headDepartmentIds.add(
      heads.getString(i)
    );
    return user;
  }

  private String userId;
  private String name;
  private String email;
  private Role role;
  private String departmentId; // e.g., "CSE", "EEE", "BBA", or "ALL"

  public User() {
    // Default constructor for Firebase / JSON deserialization
  }

  public User(
    String userId,
    String name,
    String email,
    Role role,
    String departmentId
  ) {
    this.userId = userId;
    this.name = name;
    this.email = email;
    this.role = role;
    this.departmentId = departmentId;
  }

  // Getters and Setters
  public String getUserId() {
    return userId;
  }

  public void setUserId(String userId) {
    this.userId = userId;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public Role getRole() {
    return role;
  }

  public void setRole(Role role) {
    this.role = role;
  }

  public String getDepartmentId() {
    return departmentId;
  }

  public void setDepartmentId(String departmentId) {
    this.departmentId = departmentId;
  }
}
