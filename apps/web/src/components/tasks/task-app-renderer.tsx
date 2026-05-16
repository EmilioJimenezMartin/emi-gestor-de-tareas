"use client";

import React from "react";
import { KdpFactoryApp } from "@/components/tasks/apps/kdp-factory-app";

const COMPONENTS: Record<string, React.ComponentType> = {
    "amazon-kdp-ai-automation": KdpFactoryApp,
};

export function TaskAppRenderer({ slug }: { slug: string }) {
    const Component = COMPONENTS[slug];
    if (!Component) return null;
    return <Component />;
}
