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
                    // Start from the Request object's own headers (if input is a Request),
                    // then layer init.headers on top, so nothing is lost.
                    const baseHeaders = input instanceof Request ? input.headers : undefined;
                    const headers = new Headers(baseHeaders);
                    if (init?.headers) {
                        new Headers(init.headers).forEach((v, k) => headers.set(k, v));
                    }
                    if (!headers.has("Authorization")) {
                        headers.set("Authorization", `Bearer ${token}`);
                    }
                    // Clone Request to avoid "body already used" when re-passing with new init
                    const finalInput = input instanceof Request ? input.clone() : input;
                    return originalFetch(finalInput, { ...init, headers });
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
