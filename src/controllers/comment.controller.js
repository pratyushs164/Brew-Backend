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

    if (!commentId) {
      comment = await Comment.create({
        authorId: userId,
        postId: post._id,
        parentId: null,
        content: content.trim(),
      });
    } else {
      const commentPost = await Comment.findById(commentId);
      if (!commentPost) {
        throw new ApiError(404, "Error while finding the comment to reply on");
      }

      if (!commentPost.postId.equals(post._id)) {
        throw new ApiError(400, "Mallicious Reply");
      }

      comment = await Comment.create({
        authorId: userId,
        postId: post._id,
        parentId: commentId,
        content: content.trim(),
      });
    }

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

    // Include author information in the newly created comment.
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
          deletedAt: null,
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
      throw new ApiError(404, "Comment id not valid");
    }
    // const comment = await Comment.findOne({ _id: commentId });
    // if (!comment) {
    //   throw new ApiError(400, "Comment does not exist");
    // }
    // if (comment.authorId.equals(req.user?._id)) {
    //   throw new ApiError(400, "Not a valid User");
    // }
    const findComment = await Comment.findById(commentId);
    if (!findComment) {
      throw new ApiError(400, "Comment does not exist");
    }
    if (findComment.deletedAt) {
      throw new ApiError(400, " Comment is already deleted");
    }

    const deletedComment = await Comment.findOneAndUpdate(
      { _id: commentId, authorId: req.user?._id },
      {
        deletedAt: new Date(),
      },
      { new: true },
    );

    if (!deletedComment) {
      throw new ApiError(400, "Comment does not exist");
    }

    const updateCommmentCounter = await Post.updateOne(
      { _id: deletedComment.postId },
      { $inc: { commentsCount: -1 } },
    );

    if (!updateCommmentCounter) {
      throw new ApiError(400, "Error while updating the comment counter");
    }

    res.status(200).json({
      success: true,
      message: "Successfully soft deleted comment",
      deletedComment,
    });
  } catch (error) {
    next(error);
  }
};
