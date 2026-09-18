package com.example.notify.data.model;

import java.io.Serializable;

/**
 * Academic Department model.
 */
public class Department implements Serializable {
    private String deptId;
    private String deptName;
    private String deptCode;

    public Department() {
    }

    public Department(String deptId, String deptName, String deptCode) {
        this.deptId = deptId;
        this.deptName = deptName;
        this.deptCode = deptCode;
    }

    public String getDeptId() { return deptId; }
    public void setDeptId(String deptId) { this.deptId = deptId; }

    public String getDeptName() { return deptName; }
    public void setDeptName(String deptName) { this.deptName = deptName; }

    public String getDeptCode() { return deptCode; }
    public void setDeptCode(String deptCode) { this.deptCode = deptCode; }

    @Override
    public String toString() {
        return deptName + " (" + deptCode + ")";
    }
}
