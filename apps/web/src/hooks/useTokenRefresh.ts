"use client";
import { useEffect } from "react";
import { refreshToken, getTokenExpiry, isAuthenticated } from "@/lib/auth-client";

// Refresh when less than 3h remain (token is 24h, so refresh kicks in after 21h of use)
const REFRESH_THRESHOLD_MS = 3 * 60 * 60 * 1000;
// Check every 30 minutes
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function useTokenRefresh() {
    useEffect(() => {
        const check = async () => {
            if (!isAuthenticated()) return;
            const expiry = getTokenExpiry();
            if (!expiry) return;
            const timeLeft = expiry - Date.now();
            if (timeLeft < REFRESH_THRESHOLD_MS) {
                await refreshToken();
            }
        };

        // Check immediately on mount
        check();

        // Check periodically
        const interval = setInterval(check, CHECK_INTERVAL_MS);

        // Also check when user returns to the tab (prevents expiry during idle)
        window.addEventListener("focus", check);

        return () => {
            clearInterval(interval);
            window.removeEventListener("focus", check);
        };
    }, []);
}
