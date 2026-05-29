import { Schema, model, Document } from "mongoose";

export interface IAutopilotRun extends Document {
    startedAt: Date;
    finishedAt?: Date;
    status: "running" | "completed" | "aborted" | "error";
    discovered: number;
    duplicatesSkipped: number;
    pipelineProcessed: number;
    catalogsCreated: number;
    abortReason?: string;
}

const schema = new Schema<IAutopilotRun>({
    startedAt: { type: Date, default: Date.now },
    finishedAt: Date,
    status: { type: String, enum: ["running", "completed", "aborted", "error"], default: "running" },
    discovered: { type: Number, default: 0 },
    duplicatesSkipped: { type: Number, default: 0 },
    pipelineProcessed: { type: Number, default: 0 },
    catalogsCreated: { type: Number, default: 0 },
    abortReason: String,
});

export const AutopilotRun = model<IAutopilotRun>("AutopilotRun", schema);
