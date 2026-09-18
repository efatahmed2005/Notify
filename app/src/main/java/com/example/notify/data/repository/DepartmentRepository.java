package com.example.notify.data.repository;

import com.example.notify.data.model.Department;
import java.util.List;

public interface DepartmentRepository {
    interface Callback<T> {
        void onSuccess(T result);
        void onError(Exception e);
    }

    void getDepartments(Callback<List<Department>> callback);
    void addDepartment(Department department, Callback<Department> callback);
}
