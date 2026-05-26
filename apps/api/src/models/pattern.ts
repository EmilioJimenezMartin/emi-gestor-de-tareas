import { Schema, model } from "mongoose";

const PatternSchema = new Schema(
    {
        publicId:   { type: String, required: true },
        url:        { type: String, required: true },
        prompt:     { type: String, default: "" },
        style:      { type: String, default: "custom" },
        styleLabel: { type: String, default: "" },
        palette:    { type: String, default: "" },
        paletteLabel: { type: String, default: "" },
        modelName:  { type: String, default: "" },
        seed:       { type: Number, default: 0 },
        width:      { type: Number, default: 1024 },
        height:     { type: Number, default: 1024 },
        bytes:      { type: Number, default: 0 },
    },
    { timestamps: true }
);

export const Pattern = model("Pattern", PatternSchema);
