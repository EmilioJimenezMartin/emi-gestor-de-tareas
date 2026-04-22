import mongoose from "mongoose";

let connected = false;

export async function connectMongo(mongoUri: string) {
  if (connected) return;
  await mongoose.connect(mongoUri);
  connected = true;
}

