import mongoose, { Schema, Document } from "mongoose";

export interface ITaskComment {
    id: string;
    text: string;
    createdAt: Date;
    updatedAt?: Date;
}

export interface ITask extends Document {
    id: string;
    title: string;
    slug: string;
    status: string;
    priority: string;
    categories?: string[];
    internal_score?: number;
    description: string;
    viability_metrics: {
        implementation_ease: number;
        success_probability: number;
        resource_intensity: number;
        time_to_mvp: number;
        roi_potential: number;
    };
    technical_stack: {
        framework: string;
        database: string;
        apis_required: string[];
    };
    business_logic: {
        problem: string;
        solution: string;
        monetization: string[];
    };
    execution_pipeline: Array<{
        step: number;
        task: string;
        details: string;
    }>;
    data_schema_preview: Record<string, any>;
    comments?: ITaskComment[];
}

const TaskSchema: Schema = new Schema({
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    status: { type: String, required: true },
    priority: { type: String, required: true },
    categories: [{ type: String }],
    internal_score: { type: Number, default: 0 },
    description: { type: String, required: true },
    viability_metrics: {
        implementation_ease: { type: Number },
        success_probability: { type: Number },
        resource_intensity: { type: Number },
        time_to_mvp: { type: Number },
        roi_potential: { type: Number }
    },
    technical_stack: {
        framework: { type: String },
        database: { type: String },
        apis_required: [{ type: String }]
    },
    business_logic: {
        problem: { type: String },
        solution: { type: String },
        monetization: [{ type: String }]
    },
    execution_pipeline: [{
        step: { type: Number, required: true },
        task: { type: String, required: true },
        details: { type: String, required: true }
    }],
    data_schema_preview: { type: Schema.Types.Mixed, required: true },
    // Mixed to accept legacy string[] values already stored in Mongo,
    // while allowing the new {id,text,createdAt,...} objects.
    comments: { type: [Schema.Types.Mixed], default: [] }
}, {
    timestamps: true,
    strict: false // Permitir guardar campos nuevos como 'comments' sin reiniciar la API si es necesario
});

export const Task = mongoose.models.Task || mongoose.model<ITask>("Task", TaskSchema);
