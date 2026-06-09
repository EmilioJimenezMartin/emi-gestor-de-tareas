"use client";

import { useEffect } from "react";
import { getToken } from "@/lib/auth-client";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");

// Patch window.fetch once on mount so all client-side API calls automatically
// include the JWT Authorization header — avoids touching every component.
export function AuthFetchPatcher() {
    useEffect(() => {
        const originalFetch = window.fetch.bind(window);

        window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
            const url = typeof input === "string"
                ? input
                : input instanceof URL
                    ? input.toString()
                    : (input as Request).url;

            if (url.startsWith(API_URL)) {
                const token = getToken();
                if (token) {
                    const headers = new Headers(init?.headers);
                    if (!headers.has("Authorization")) {
                        headers.set("Authorization", `Bearer ${token}`);
                    }
                    return originalFetch(input, { ...init, headers });
                }
            }

            return originalFetch(input, init);
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, []);

    return null;
}
