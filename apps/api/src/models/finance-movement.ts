import mongoose, { type InferSchemaType } from "mongoose";

const financeMovementSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      required: true,
      enum: ["ingreso", "gasto"],
      index: true,
    },
    cadence: {
      type: String,
      required: true,
      enum: ["anual", "mensual", "puntual"],
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: false, default: "" },
    amount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

financeMovementSchema.index({ createdAt: -1 });

export type FinanceMovement = InferSchemaType<typeof financeMovementSchema>;

export const FinanceMovementModel =
  mongoose.models.FinanceMovement ??
  mongoose.model("FinanceMovement", financeMovementSchema);

