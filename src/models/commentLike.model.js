import mongoose from "mongoose";

const commentLikeSchema = new mongoose.Schema(
  {
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

commentLikeSchema.index(
  {
    commentId: 1,
    userId: 1,
  },
  {
    unique: true,
  },
);

export const CommentLike = mongoose.model("CommentLike", commentLikeSchema);
