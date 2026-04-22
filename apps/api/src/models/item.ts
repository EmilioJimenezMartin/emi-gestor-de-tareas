import mongoose, { type InferSchemaType } from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: false },
  },
  { timestamps: true }
);

itemSchema.index({ createdAt: -1 });

export type Item = InferSchemaType<typeof itemSchema>;

export const ItemModel =
  mongoose.models.Item ?? mongoose.model("Item", itemSchema);

