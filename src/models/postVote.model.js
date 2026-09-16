import mongoose from "mongoose";

const postVoteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post",
    required: true,
  },
  voteType: {
    type: String,
    enum: ["upvote", "downvote"],
    required: true,
  },
});

postVoteSchema.index(
  {
    userId: 1,
    postId: 1,
  },
  {
    unique: true,
  },
);
export const PostVote = mongoose.model("PostVote", postVoteSchema);
