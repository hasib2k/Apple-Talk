export interface User {
    id: string;
    deviceId: string;
    googleId: string | null;
    email: string | null;
    isLinked: boolean;
    anonAlias: string;
    region: string | null;
    gender: string | null;
    interests: string[];
    isPremium: boolean;
    premiumUntil: Date | null;
    isBanned: boolean;
    createdAt: Date;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export interface AuthResponse {
    tokens: AuthTokens;
    user: User;
}
export interface UpdateUserDto {
    anonAlias?: string;
    region?: string;
    gender?: string;
    interests?: string[];
}
