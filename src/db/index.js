import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

export const connectDB = async function () {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`,
    );
  } catch (error) {
    console.log("Connection with mongoDB failed:", error.message);
    process.exit(1);
  }
};
