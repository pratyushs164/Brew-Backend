import { Follow } from "../models/follow.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const updatePassword = async function (req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      throw new ApiError(400, "User not found");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
      throw new ApiError(400, "Password does not match the old password");
    }

    user.passwordHash = newPassword;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({});
  } catch (error) {
    next(error);
  }
};

const getCurrentUser = async function (req, res, next) {
  try {
    const user = await User.findById(req.user._id).select("-passwordHash");
    if (!user) {
      throw new ApiError(401, "User not found");
    }
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

const updateUserDetails = async function (req, res, next) {
  try {
    const { fullName, email, username } = req.body;
    const updates = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (email !== undefined) updates.email = email;
    if (username !== undefined) updates.username = username;

    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: updates,
      },
      {
        new: true,
      },
    ).select("-passwordHash -refreshToken");

    res.status(200).json(user);
  } catch (error) {
    next(error);
    throw new ApiError(400, `Couldn't update the user: ${error.message}`);
  }
};

const updateAvatar = async function (req, res, next) {
  try {
    const localFilePath = req.file?.path;
    if (!localFilePath) {
      throw new ApiError(400, `Error while finding local Path`);
    }

    const avatar = await uploadOnCloudinary(localFilePath);
    if (!avatar) {
      throw new ApiError(400, `error while uploading on cloudinary`);
    }

    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          avatar: avatar.url,
        },
      },
      {
        new: true,
      },
    ).select("-passwordHash");
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

const getUserProfile = async function (req, res, next) {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "Username is required");
  }

  // Logged-out visitors have no current user ID.
  const currentUserId = req.user?._id ?? null;

  const profile = await User.aggregate([
    // 1. Find the requested user.
    {
      $match: {
        username: username.trim().toLowerCase(),
      },
    },

    // 2. Find users who follow this profile.
    {
      $lookup: {
        from: "follows",
        localField: "_id",
        foreignField: "followingId",
        as: "followers",
      },
    },

    // 3. Find users this profile follows.
    {
      $lookup: {
        from: "follows",
        localField: "_id",
        foreignField: "followerId",
        as: "following",
      },
    },

    // 4. Fetch only published posts written by this user.
    {
      $lookup: {
        from: "posts",
        let: { profileUserId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$authorId", "$$profileUserId"] },
                  { $eq: ["$status", "published"] },
                ],
              },
            },
          },
          {
            $sort: {
              publishedAt: -1,
            },
          },
          {
            $project: {
              title: 1,
              slug: 1,
              coverImage: 1,
              publishedAt: 1,
              upvotesCount: 1,
              commentsCount: 1,
              content: 1,
            },
          },
        ],
        as: "publishedPosts",
      },
    },

    // 5. Calculate statistics and the current visitor's follow status.
    {
      $addFields: {
        followerCount: { $size: "$followers" },
        followingCount: { $size: "$following" },
        publishedPostCount: { $size: "$publishedPosts" },
        isFollowed: {
          $in: [currentUserId, "$followers.followerId"],
        },
      },
    },

    // 6. Return only the fields the profile page needs.
    {
      $project: {
        _id: 1,
        username: 1,
        fullName: 1,
        avatar: 1,
        bio: 1,
        followerCount: 1,
        followingCount: 1,
        publishedPostCount: 1,
        isFollowed: 1,
        publishedPosts: 1,
      },
    },
  ]);

  if (!profile.length) {
    throw new ApiError(404, "Profile not found");
  }

  return res.status(200).json({
    success: true,
    message: "Profile fetched successfully",
    profile: profile[0],
  });
};

const followUser = async function (req, res, next) {
  try {
    const username = req.params.username.toLowerCase().trim();

    const targetUser = await User.findOne({ username });
    if (!targetUser) {
      throw new ApiError(400, "User not found");
    }

    if (targetUser._id.equals(req.user._id)) {
      throw new ApiError(403, "Cannot follow yourself");
    }

    const followRelationship = await Follow.findOne({
      followerId: req.user._id,
      followingId: targetUser._id,
    });

    if (followRelationship) {
      throw new ApiError(400, "You already follow the user");
    }

    const followRel = await Follow.create({
      followerId: req.user._id,
      followingId: targetUser._id,
    });
    if (!followRel) {
      throw new ApiError(400, "Error while creating relationship");
    }

    const updatedTargetUser = await User.findByIdAndUpdate(
      targetUser._id,
      {
        $inc: { followersCount: 1 },
      },
      { new: true },
    ).select("followersCount followingCount");
    res.status(200).json({
      success: true,
      message: "Successfully followed the user",
      followRel,
      followersCount: updatedTargetUser.followersCount,
      followingCount: updatedTargetUser.followingCount,
    });
  } catch (error) {
    next(error);
  }
};

const unfollowUser = async function (req, res, next) {
  try {
    const username = req.params.username.toLowerCase().trim();

    const targetUser = await User.findOne({ username });
    if (!targetUser) {
      throw new ApiError(400, "User not found");
    }

    if (targetUser._id.equals(req.user._id)) {
      throw new ApiError(400, "Cannot unfollow yourself");
    }

    const followRelationship = await Follow.findOneAndDelete({
      followerId: req.user._id,
      followingId: targetUser._id,
    });
    if (!followRelationship) {
      throw new ApiError(400, "You do not follow the user");
    }

    const updatedTargetUser = await User.findByIdAndUpdate(
      targetUser._id,
      {
        $inc: { followersCount: -1 },
      },
      { new: true },
    ).select("followersCount followingCount");

    res.status(200).json({
      success: true,
      message: "Unfollowed Successfully",
      followRelationship,
      followersCount: updatedTargetUser.followersCount,
      followingCount: updatedTargetUser.followingCount,
    });
  } catch (error) {
    next(error);
  }
};

export {
  updateAvatar,
  updatePassword,
  getCurrentUser,
  updateUserDetails,
  getUserProfile,
  followUser,
  unfollowUser,
};
