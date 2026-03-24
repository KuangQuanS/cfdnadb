package org.cfdna.database.dto;

import java.time.Instant;

public class ApiResponse<T> {

    private final boolean success;
    private final T data;
    private final String message;
    private final Instant timestamp;

    public ApiResponse(boolean success, T data, String message, Instant timestamp) {
        this.success = success;
        this.data = data;
        this.message = message;
        this.timestamp = timestamp;
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<T>(true, data, null, Instant.now());
    }

    public static <T> ApiResponse<T> failure(String message) {
        return new ApiResponse<T>(false, null, message, Instant.now());
    }

    public boolean success() { return success; }
    public T data() { return data; }
    public String message() { return message; }
    public Instant timestamp() { return timestamp; }

    public boolean isSuccess() { return success; }
    public T getData() { return data; }
    public String getMessage() { return message; }
    public Instant getTimestamp() { return timestamp; }
}
