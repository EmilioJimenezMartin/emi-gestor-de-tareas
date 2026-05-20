"use client";

import React from "react";
import { KdpFactoryApp } from "@/components/tasks/apps/kdp-factory-app";
import { GelatoEtsyApp } from "@/components/tasks/apps/gelato-etsy-app";

const COMPONENTS: Record<string, React.ComponentType> = {
    "amazon-kdp-ai-automation": KdpFactoryApp,
    "etsy-gelato-platform": GelatoEtsyApp,
};

export function TaskAppRenderer({ slug }: { slug: string }) {
    const Component = COMPONENTS[slug];
    if (!Component) return null;
    return <Component />;
}
