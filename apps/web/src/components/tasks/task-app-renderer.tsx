"use client";

import React from "react";
import { KdpFactoryApp } from "@/components/tasks/apps/kdp-factory-app";
import { GelatoEtsyApp } from "@/components/tasks/apps/gelato-etsy-app";
import { DataRefineryApp } from "@/components/tasks/apps/data-refinery-app";
import { SeamlessPatternApp } from "@/components/tasks/apps/seamless-pattern-app";

const COMPONENTS: Record<string, React.ComponentType> = {
    "amazon-kdp-ai-automation": KdpFactoryApp,
    "etsy-gelato-platform": GelatoEtsyApp,
    "ai-training-data-factory": DataRefineryApp,
    "ai-seamless-pattern-automation": SeamlessPatternApp,
};

export function TaskAppRenderer({ slug }: { slug: string }) {
    const Component = COMPONENTS[slug];
    if (!Component) return null;
    return <Component />;
}
