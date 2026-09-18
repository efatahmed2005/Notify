package com.example.notify.data.repository;

import android.os.Handler;
import android.os.Looper;
import com.example.notify.data.model.Department;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public class MockDepartmentRepository implements DepartmentRepository {

    private static MockDepartmentRepository instance;
    private final List<Department> departments = new CopyOnWriteArrayList<>();
    private final Handler handler = new Handler(Looper.getMainLooper());

    private MockDepartmentRepository() {
        departments.add(new Department("DEPT-CSE", "Computer Science & Engineering", "CSE"));
        departments.add(new Department("DEPT-EEE", "Electrical & Electronic Engineering", "EEE"));
        departments.add(new Department("DEPT-BBA", "School of Business Administration", "BBA"));
        departments.add(new Department("DEPT-LAW", "Department of Law & Justice", "LAW"));
    }

    public static synchronized MockDepartmentRepository getInstance() {
        if (instance == null) {
            instance = new MockDepartmentRepository();
        }
        return instance;
    }

    @Override
    public void getDepartments(Callback<List<Department>> callback) {
        handler.postDelayed(() -> callback.onSuccess(new ArrayList<>(departments)), 100);
    }

    @Override
    public void addDepartment(Department department, Callback<Department> callback) {
        handler.postDelayed(() -> {
            departments.add(department);
            callback.onSuccess(department);
        }, 150);
    }
}
