import { Post } from "../models/post.model.js";
import { PostVote } from "../models/postVote.model.js";
import { ApiError } from "../utils/ApiError.js";

export const votePost = async function (req, res, next) {
  try {
    const { voteType } = req.body;
    const { slug } = req.params;

    if (!voteType) {
      throw new ApiError(400, "Vote Type is Required");
    }

    if (voteType !== "upvote" && voteType !== "downvote") {
      throw new ApiError(400, "Return a valid vote type");
    }
    if (!slug) {
      throw new ApiError(400, "Slug not found");
    }

    const post = await Post.findOne({ slug, status: "published" });
    if (!post) {
      throw new ApiError(400, "No Post found");
    }

    const findPostVote = await PostVote.findOne({
      postId: post._id,
      userId: req.user?._id,
    });

    let createPostVote;
    if (!findPostVote) {
      //No vote present
      createPostVote = await PostVote.create({
        postId: post._id,
        userId: req.user._id,
        voteType,
      });
      if (!createPostVote) {
        throw new ApiError(400, "Error while Voting");
      }
      const count =
        voteType === "upvote" ? { upvotesCount: 1 } : { downvotesCount: 1 };
      const updateCount = await Post.updateOne(
        { _id: post._id },
        { $inc: count },
      );
    } else if (findPostVote.voteType === "upvote") {
      //Already upvoted
      if (voteType === "upvote") {
        // remove the upvote
        createPostVote = await PostVote.findOneAndDelete({
          postId: post._id,
          userId: req.user._id,
        });
        if (!createPostVote) {
          throw new ApiError(400, "Error while removing upvote");
        }
        const updateCount = await Post.updateOne(
          { _id: post._id },
          { $inc: { upvotesCount: -1 } },
        );
      } else {
        //switch to downvote
        createPostVote = await PostVote.findOneAndUpdate(
          {
            postId: post._id,
            userId: req.user._id,
          },
          {
            $set: { voteType: "downvote" },
          },
          { new: true },
        );
        if (!createPostVote) {
          throw new ApiError(
            400,
            "Error while switching from upvote to downvote",
          );
        }

        const updateCount = await Post.updateOne(
          { _id: post._id },
          { $inc: { downvotesCount: 1, upvotesCount: -1 } },
        );
      }
    } else if (findPostVote.voteType === "downvote") {
      ///Already downvoted
      if (voteType === "downvote") {
        // remove the downvote
        createPostVote = await PostVote.findOneAndDelete({
          postId: post._id,
          userId: req.user._id,
        });

        if (!createPostVote) {
          throw new ApiError(400, "Error while removing downvote");
        }
        const updateCount = await Post.updateOne(
          { _id: post._id },
          { $inc: { downvotesCount: -1 } },
        );
      } else {
        //switch to upvote
        createPostVote = await PostVote.findOneAndUpdate(
          {
            postId: post._id,
            userId: req.user._id,
          },
          {
            $set: { voteType: "upvote" },
          },
          { new: true },
        );
        if (!createPostVote) {
          throw new ApiError(
            400,
            "Error while switching from upvote to downvote",
          );
        }

        const updateCount = await Post.updateOne(
          { _id: post._id },
          { $inc: { upvotesCount: 1, downvotesCount: -1 } },
        );
      }
    }

    const [updatedPost, currentVote] = await Promise.all([
      Post.findById(post._id).select("upvotesCount downvotesCount"),

      PostVote.findOne({
        postId: post._id,
        userId: req.user._id,
      }).select("voteType"),
    ]);

    if (!updatedPost) {
      throw new ApiError(404, "Post not found");
    }

    return res.status(200).json({
      success: true,
      message: "Vote updated successfully",
      data: {
        postId: post._id,
        upvotesCount: updatedPost.upvotesCount,
        downvotesCount: updatedPost.downvotesCount,
        userVote: currentVote?.voteType ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
};
