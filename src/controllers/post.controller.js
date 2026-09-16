import { slugify } from "../utils/Slugify.js";
import { Post } from "../models/post.model.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";

// create post
export const createPost = async function (req, res, next) {
  try {
    const { title, content } = req.body;
    if (!title || title.trim() === "") {
      throw new ApiError(400, "Title is required");
    }
    if (!content || content.trim() === "") {
      throw new ApiError(400, "Content is required");
    }
    const coverImageLocalPath = req.file?.path;
    let uploadedCoverImage;
    if (coverImageLocalPath) {
      // console.log(req.file);
      uploadedCoverImage = await uploadOnCloudinary(coverImageLocalPath);
      if (!uploadedCoverImage) {
        throw new ApiError(400, "Failted to upload cover Image");
      }
    }
    const postId = new mongoose.Types.ObjectId();
    const slug = `${slugify(title)}-${postId}`;

    const post = await Post.create({
      _id: postId,
      authorId: req.user._id,
      title,
      slug,
      content,
      status: "draft",
      coverImage: uploadedCoverImage ? uploadedCoverImage.url : null,
      publishedAt: null,
    });

    return res.status(200).json({ post, message: "Post Created successfully" });
  } catch (error) {
    next(error);
  }
};

// publish the  post
export const publishPost = async function (req, res, next) {
  try {
    const { slug } = req.params;
    const post = await Post.findOneAndUpdate(
      {
        slug,
        authorId: req.user._id,
        status: {
          $in: ["draft", "archived"],
        },
      },
      {
        $set: {
          status: "published",
          publishedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!post) {
      throw new ApiError(400, "No post found");
    }

    res
      .status(200)
      .json({ success: true, message: "Post published successfully", post });
  } catch (error) {
    next(error);
  }
};

//archive a post
export const archivePost = async function (req, res, next) {
  try {
    const { slug } = req.params;
    const post = await Post.findOneAndUpdate(
      {
        slug,
        authorId: req.user._id,
        status: "published",
      },
      {
        $set: {
          status: "archived",
        },
      },
      { new: true },
    );

    if (!post) {
      throw new ApiError(400, "No post found");
    }

    res
      .status(200)
      .json({ success: true, message: "Post archived successfully", post });
  } catch (error) {
    throw new ApiError(400, "Error while archiving post");
    next(error);
  }
};

// get my post
export const getMyPosts = async function (req, res, next) {
  try {
    const post = await Post.find({
      authorId: req.user._id,
    });
    if (!post) {
      throw new ApiError(400, " No post exist");
    }

    res
      .status(200)
      .json({ success: true, message: "Users post fetched", post });
  } catch (error) {
    next(error);
  }
};

// get published Posts
export const getPublishedPosts = async function (req, res, next) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);

    const posts = await Post.aggregate([
      {
        $match: {
          status: "published",
        },
      },
      {
        $sort: {
          publishedAt: -1,
        },
      },
      {
        $skip: (page - 1) * limit,
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: "users",
          localField: "authorId",
          foreignField: "_id",
          as: "author",
          pipeline: [
            {
              $project: {
                username: 1,
                firstName: 1,
                avatar: 1,
              },
            },
          ],
        },
      },
      {
        $set: {
          author: { $first: "$author" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      message: "Fetched the post successfully",
      posts,
      limit,
      page,
    });
  } catch (error) {
    next(error);
  }
};

// get post by slug
export const getPostBySlug = async function (req, res, next) {
  try {
    let currUser = req.user ? req.user._id : null;
    const { slug } = req.params;

    const post = await Post.aggregate([
      {
        $match: { slug, status: "published" },
      },
      {
        $lookup: {
          from: "users",
          localField: "authorId",
          foreignField: "_id",
          as: "author",
          pipeline: [
            {
              $project: {
                username: 1,
                fullName: 1,
                avatar: 1,
                followersCount: 1,
              },
            },
          ],
        },
      },
      {
        $set: {
          author: { $first: "$author" },
        },
      },
      {
        $lookup: {
          from: "follows",

          let: { authorId: "$author._id", userId: currUser },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ["$$userId", null] },
                    { $eq: ["$followerId", "$$userId"] },
                    { $eq: ["$followingId", "$$authorId"] },
                  ],
                },
              },
            },
          ],

          as: "followData",
        },
      },
      {
        $set: {
          "author.isFollowing": {
            $gt: [{ $size: "$followData" }, 0],
          },
        },
      },
      {
        $lookup: {
          from: "postvotes",

          let: { postId: "$_id", userId: currUser },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ["$$userId", null] },
                    { $eq: ["$postId", "$$postId"] },
                    { $eq: ["$userId", "$$userId"] },
                  ],
                },
              },
            },
          ],

          as: "postVoteData",
        },
      },
      {
        $set: {
          userVote: {
            $first: "$postVoteData.voteType",
          },
        },
      },
    ]);
    if (!post.length) {
      throw new ApiError(400, "No Post Exist");
    }
    res.status(200).json({
      success: true,
      message: "Post Info Fetched Successfully",
      post: post[0],
    });
  } catch (error) {
    next(error);
  }
};

// update post
export const updatePost = async function (req, res, next) {
  try {
    const { slug } = req.params;
    const { title, content } = req.body;

    const updates = {};

    if (title !== undefined) {
      if (title.trim() == "") {
        throw new ApiError(400, "Can't leave title field empty");
      }
      updates.title = title;
    }
    if (content !== undefined) {
      if (content.trim() == "") {
        throw new ApiError(400, "Can't leave content field empty");
      }
      updates.content = content;
    }

    const coverImageLocalPath = req.file?.path;

    if (coverImageLocalPath) {
      uploadedCoverImage = await uploadOnCloudinary(coverImageLocalPath);
      if (!coverImage) {
        throw new ApiError(400, "Failed to upload Image");
      }
      updates.coverImage = uploadedCoverImage.url;
    }

    const post = await Post.findOneAndUpdate(
      {
        slug,
        authorId: req.user._id,
      },
      {
        $set: updates,
      },
      { new: true },
    );
    if (!post) {
      throw new ApiError(400, "No post found");
    }

    res
      .status(200)
      .json({ success: true, message: "Post updated successfully", post });
  } catch (error) {
    next(error);
  }
};

// delete post
export const deletePost = async function (req, res, next) {
  const { slug } = req.params;
  if (!slug) {
    throw new ApiError(400, "Post slug is required");
  }

  const post = await Post.findOneAndDelete({
    slug,
    authorId: req.user._id,
  });
  if (!post) {
    throw new ApiError(
      400,
      "Either post does not exist or you are not authorized to delete the post",
    );
  }

  res.status(200).json({ success: true, message: "Post deleted successfully" });
};
