export interface ApiResponse<T = void> {
    data: T;
    message?: string;
}
export interface ApiError {
    statusCode: number;
    message: string;
    error?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}
export interface Interest {
    id: string;
    slug: string;
    label: string;
    emoji: string | null;
}
