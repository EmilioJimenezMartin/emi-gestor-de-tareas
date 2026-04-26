import mongoose, { Schema, Document } from "mongoose";

export interface IExtractedData extends Document {
    id: string;
    title: string;
    description: string;
    type: string;
    source: {
        name: string;
        url: string;
        source_type: string;
        retrieved_at: Date;
    };
    content: {
        raw: string;
        clean: string;
        structured: Record<string, any>;
    };
    metadata: {
        language: string;
        tags: string[];
        category: string;
        confidence_score: number;
        relevance_score: number;
    };
    temporal: {
        created_at: Date;
        updated_at: Date;
        event_date?: Date;
        deadline?: Date;
        is_recurring: boolean;
    };
    engagement: {
        views: number;
        likes: number;
        comments_count: number;
        shares: number;
        comments: any[];
    };
    financial: {
        reward: number;
        currency: string;
        estimated_value: number;
        cost_to_execute: number;
    };
    processing: {
        status: string;
        pipeline_stage: string;
        assigned_system: string;
    };
    relationships: {
        related_ids: string[];
        duplicates_of: string[];
        depends_on: string[];
    };
    extra: Record<string, any>;
}

const ExtractedDataSchema = new Schema({
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String },
    type: { type: String },
    source: {
        name: { type: String },
        url: { type: String },
        source_type: { type: String },
        retrieved_at: { type: Date }
    },
    content: {
        raw: { type: String },
        clean: { type: String },
        structured: { type: Schema.Types.Mixed }
    },
    metadata: {
        language: { type: String },
        tags: [{ type: String }],
        category: { type: String },
        confidence_score: { type: Number },
        relevance_score: { type: Number }
    },
    temporal: {
        created_at: { type: Date, default: Date.now },
        updated_at: { type: Date, default: Date.now },
        event_date: { type: Date },
        deadline: { type: Date },
        is_recurring: { type: Boolean, default: false }
    },
    engagement: {
        views: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        comments_count: { type: Number, default: 0 },
        shares: { type: Number, default: 0 },
        comments: [{ type: Schema.Types.Mixed }]
    },
    financial: {
        reward: { type: Number },
        currency: { type: String },
        estimated_value: { type: Number },
        cost_to_execute: { type: Number }
    },
    processing: {
        status: { type: String, default: 'raw' },
        pipeline_stage: { type: String },
        assigned_system: { type: String }
    },
    relationships: {
        related_ids: [{ type: String }],
        duplicates_of: [{ type: String }],
        depends_on: [{ type: String }]
    },
    extra: { type: Schema.Types.Mixed }
});

export const ExtractedData = mongoose.models.ExtractedData || mongoose.model<IExtractedData>("ExtractedData", ExtractedDataSchema);
