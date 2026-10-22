import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { CommentLike } from "../models/commentLike.model.js";
import { Post } from "../models/post.model.js";
import { ApiError } from "../utils/ApiError.js";

export const createComment = async function (req, res, next) {
  try {
    const { content } = req.body;
    const { slug, commentId } = req.params;

    if (!content || !content.trim()) {
      throw new ApiError(400, "Comment cannot be left Empty");
    }

    if (!slug) {
      throw new ApiError(400, "Requested Post Not Found");
    }

    const post = await Post.findOne({ slug });

    if (!post) {
      throw new ApiError(404, "Error while finding post");
    }

    if (!req.user || !req.user._id) {
      throw new ApiError(401, "User must be logged in to comment");
    }

    const userId = req.user._id;

    let comment;

    // 1. Create a top-level comment when commentId is not provided.
    if (!commentId) {
      comment = await Comment.create({
        authorId: userId,
        postId: post._id,
        parentId: null,
        content: content.trim(),
      });
    } else {
      // 2. Find the comment the user wants to reply to.
      const parentComment = await Comment.findById(commentId);

      if (!parentComment) {
        throw new ApiError(404, "Error while finding the comment to reply on");
      }

      // 3. Ensure the target comment belongs to the requested post.
      if (!parentComment.postId.equals(post._id)) {
        throw new ApiError(400, "Malicious Reply");
      }

      // MODIFICATION 1:
      // Do not allow replies to a comment that has already been deleted.
      if (parentComment.deletedAt) {
        throw new ApiError(400, "Cannot reply to a deleted comment");
      }

      // MODIFICATION 2:
      // Enforce one-level replies.
      // A top-level comment has parentId = null.
      // If parentId exists, this comment is already a reply,
      // so reject attempts to create a reply to it.
      if (parentComment.parentId) {
        throw new ApiError(400, "Replies to replies are not allowed");
      }

      // 4. Create a reply to the top-level comment.
      comment = await Comment.create({
        authorId: userId,
        postId: post._id,
        parentId: parentComment._id,
        content: content.trim(),
      });
    }

    // 5. Increment the total comment count.
    // This includes both top-level comments and replies.
    const updatedPost = await Post.findByIdAndUpdate(
      post._id,
      {
        $inc: { commentsCount: 1 },
      },
      { new: true },
    ).select("commentsCount");

    if (!updatedPost) {
      throw new ApiError(500, "Error while updating comments count");
    }

    // 6. Include author information in the newly created comment.
    await comment.populate("authorId", "username fullName avatar");

    return res.status(201).json({
      success: true,
      message: "Successfully commented",
      comment,
      commentsCount: updatedPost.commentsCount,
    });
  } catch (error) {
    next(error);
  }
};

export const getComments = async function (req, res, next) {
  try {
    const { slug, commentId } = req.params;

    if (!slug) {
      throw new ApiError(400, "Slug parameter required");
    }

    if (commentId && !mongoose.isValidObjectId(commentId)) {
      throw new ApiError(400, "Invalid comment ID");
    }

    const post = await Post.findOne({ slug });

    if (!post) {
      throw new ApiError(404, "Post not found");
    }

    const currentUserId = req.user?._id
      ? new mongoose.Types.ObjectId(String(req.user._id))
      : null;

    const parentId = commentId ? new mongoose.Types.ObjectId(commentId) : null;

    const comments = await Comment.aggregate([
      // 1. Fetch top-level comments or replies.
      {
        $match: {
          postId: post._id,
          parentId,

          // MODIFICATION 1:
          // When fetching replies, continue excluding deleted comments.
          // When fetching top-level comments, allow deleted comments
          // through temporarily because some may still have active replies.
          ...(parentId ? { deletedAt: null } : {}),
        },
      },

      // 2. Sort newest first.
      {
        $sort: { createdAt: -1 },
      },

      // 3. Fetch the comment author's information.
      {
        $lookup: {
          from: "users",
          localField: "authorId",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                username: 1,
                fullName: 1,
                avatar: 1,
              },
            },
          ],
          as: "authorData",
        },
      },
      {
        $set: {
          authorId: {
            $ifNull: [{ $arrayElemAt: ["$authorData", 0] }, null],
          },
        },
      },

      // 4. Count direct, non-deleted replies to each comment.
      {
        $lookup: {
          from: "comments",
          let: {
            currentCommentId: "$_id",
            currentPostId: "$postId",
          },
          pipeline: [
            {
              $match: {
                deletedAt: null,
                $expr: {
                  $and: [
                    {
                      $eq: ["$parentId", "$$currentCommentId"],
                    },
                    {
                      $eq: ["$postId", "$$currentPostId"],
                    },
                  ],
                },
              },
            },
            {
              $count: "count",
            },
          ],
          as: "replyCountData",
        },
      },
      {
        $set: {
          repliesCount: {
            $ifNull: [{ $arrayElemAt: ["$replyCountData.count", 0] }, 0],
          },
        },
      },

      // MODIFICATION 2:
      // We now know how many active replies each comment has.
      //
      // Keep the comment if:
      // 1. It has not been deleted, OR
      // 2. It has at least one non-deleted reply.
      //
      // A deleted parent with active replies must remain in the result
      // so the frontend can display a deleted-comment placeholder.
      // A deleted comment with no active replies can be excluded.
      {
        $match: {
          $or: [{ deletedAt: null }, { repliesCount: { $gt: 0 } }],
        },
      },

      // 5. Find whether the current user liked each comment.
      {
        $lookup: {
          from: "commentlikes",
          let: {
            currentCommentId: "$_id",
            currentUserId,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ["$$currentUserId", null] },
                    {
                      $eq: ["$commentId", "$$currentCommentId"],
                    },
                    {
                      $eq: ["$userId", "$$currentUserId"],
                    },
                  ],
                },
              },
            },
            {
              $project: { _id: 1 },
            },
          ],
          as: "userLikeData",
        },
      },
      {
        $set: {
          isLiked: {
            $gt: [{ $size: "$userLikeData" }, 0],
          },
        },
      },

      // 6. Remove temporary lookup fields.
      // deletedAt is deliberately retained so the frontend can identify
      // deleted comments and render the appropriate placeholder.
      {
        $project: {
          authorData: 0,
          replyCountData: 0,
          userLikeData: 0,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Successfully fetched comments",
      comments,
      commentsCount: post.commentsCount,
    });
  } catch (error) {
    next(error);
  }
};

export const editComment = async function (req, res, next) {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      throw new ApiError(404, "No content found to edit");
    }
    const { commentId } = req.params;
    if (!commentId) {
      throw new ApiError(404, "Not a valid comment id");
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new ApiError(404, "No comment found");
    }

    if (!comment.authorId.equals(req.user?._id)) {
      throw new ApiError(404, "Not a valid user trying to edit the comment");
    }
    const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      { $set: { content } },
      { new: true },
    );
    if (!updatedComment) {
      throw new ApiError(404, "Error while updating the comment");
    }

    res.status(200).json({
      success: true,
      message: "Successfully edited the comment",
      updatedComment,
    });
  } catch (error) {
    next(error);
  }
};

export const likeComment = async function (req, res, next) {
  try {
    const { commentId } = req.params;
    if (!commentId) {
      throw new ApiError(404, "Comment id not valid");
    }
    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new ApiError(400, "No comment exist");
    }

    const checkLike = await CommentLike.findOne({
      commentId,
      userId: req.user?._id,
    });

    if (checkLike) {
      throw new ApiError(409, "You already Liked this post");
    }

    const like = await CommentLike.create({
      commentId,
      userId: req.user._id,
    });

    if (!like) {
      throw new ApiError(400, "There was an error liking the comment");
    }

    const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      {
        $inc: { likeCount: 1 },
      },
      { new: true },
    ).select("likeCount");

    if (!updatedComment) {
      throw new ApiError(404, "Error while updating like count");
    }

    return res.status(200).json({
      success: true,
      message: "Successfully liked the comment",
      data: {
        commentId,
        likeCount: updatedComment.likeCount,
        isLiked: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const unlikeComment = async function (req, res, next) {
  try {
    const { commentId } = req.params;
    if (!commentId) {
      throw new ApiError(404, "Comment id not valid");
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new ApiError(404, "Comment not found");
    }

    const unlike = await CommentLike.findOneAndDelete({
      commentId,
      userId: req.user?._id,
    });
    if (!unlike) {
      throw new ApiError(404, "Error while unliking");
    }
    const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      {
        $inc: { likeCount: -1 },
      },
      { new: true },
    ).select("likeCount");

    if (!updatedComment) {
      throw new ApiError(404, "Error while updating like count");
    }
    return res.status(200).json({
      success: true,
      message: "Successfully liked the comment",
      data: {
        commentId,
        likeCount: updatedComment.likeCount,
        isLiked: false,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async function (req, res, next) {
  try {
    const { commentId } = req.params;

    if (!commentId) {
      throw new ApiError(400, "Comment ID is required");
    }

    // 1. Find the comment before attempting deletion.
    const findComment = await Comment.findById(commentId);

    if (!findComment) {
      throw new ApiError(404, "Comment does not exist");
    }

    // 2. Prevent an already deleted comment from being deleted again.
    if (findComment.deletedAt) {
      throw new ApiError(400, "Comment is already deleted");
    }

    // MODIFICATION:
    // Explicitly verify ownership before attempting the update.
    if (!req.user?._id) {
      throw new ApiError(401, "User must be logged in");
    }

    if (!findComment.authorId.equals(req.user._id)) {
      throw new ApiError(403, "You can only delete your own comment");
    }

    // 3. Soft-delete the comment instead of removing it permanently.
    // The deletedAt field allows getComments to identify deleted parents
    // that still need to be displayed because they have active replies.
    const deletedComment = await Comment.findOneAndUpdate(
      {
        _id: commentId,
        authorId: req.user._id,
        deletedAt: null,
      },
      {
        $set: { deletedAt: new Date() },
      },
      { new: true },
    );

    if (!deletedComment) {
      throw new ApiError(
        400,
        "Comment could not be deleted or is already deleted",
      );
    }

    // 4. Decrement the total comment count by exactly one.
    // This deletion removes one comment from the active discussion,
    // regardless of whether it is top-level or a reply.
    const updateCommentCounter = await Post.updateOne(
      { _id: deletedComment.postId },
      { $inc: { commentsCount: -1 } },
    );

    if (updateCommentCounter.matchedCount === 0) {
      throw new ApiError(500, "Error while updating the comment counter");
    }

    return res.status(200).json({
      success: true,
      message: "Successfully soft deleted comment",
      deletedComment,
    });
  } catch (error) {
    next(error);
  }
};
