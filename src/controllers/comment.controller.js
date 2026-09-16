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

    const userId = req.user._id;
    if (!userId) {
      throw new ApiError(400, "User should be logged in to comment");
    }
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
        throw new ApiError(400, "Error while finding the comment to reply on");
      }

      if (!commentPost.postId.equals(post._id)) {
        throw new ApiError(400, "Mallicious Reply");
      }

      const updateCommentCounter = await Post.updateOne(
        { _id: post._id },
        {
          $inc: { commentsCount: 1 },
        },
      );
      if (!updateCommentCounter) {
        throw new ApiError(400, "Error while updating comments count");
      }

      comment = await Comment.create({
        authorId: userId,
        postId: post._id,
        parentId: commentId,
        content: content.trim(),
      });
    }

    res
      .status(201)
      .json({ success: true, message: "Successfully commented", comment });
  } catch (error) {
    next(error);
  }
};

export const getComments = async function (req, res, next) {
  try {
    const { slug, commentId } = req.params;
    if (!slug) {
      throw new ApiError(404, "No post found");
    }
    const post = await Post.findOne({ slug });
    if (!post) {
      throw new ApiError(400, "Error while finding the post");
    }
    let comments;
    if (!commentId) {
      comments = await Comment.find({
        postId: post._id,
      });
      if (!comments) {
        throw new ApiError(404, "No comments on this post");
      }
    } else {
      comments = await Comment.find({
        parentId: commentId,
        postId: post._id,
      });
      if (!comments.length) {
        throw new ApiError(404, "No replies on this comment");
      }
    }

    res.status(200).json({
      status: true,
      message: "Successfully fetched all the comments",
      comments,
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

    res.send(200).json({
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

    const updateCount = await Comment.updateOne(
      { _id: commentId },
      {
        $inc: { likeCount: 1 },
      },
    );

    if (!updateCount) {
      throw new ApiError(400, "Error while updating like count");
    }

    res.status(200).json({
      success: true,
      message: "successfuly liked the comment",
      updateCount,
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
    const updateCount = await Comment.updateOne(
      { _id: commentId },
      { $inc: { likeCount: -1 } },
    );
    if (!updateCount) {
      throw new ApiError(400, "Error while updating like count");
    }
    res
      .status(200)
      .json({ success: true, message: "Successfully unliked", updateCount });
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
