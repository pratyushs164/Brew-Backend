import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = async function (req, res, next) {
  try {
    const { fullName, email, username, password } = req.body;

    if (
      [fullName, email, username, password].some((field) => field.trim() === "")
    ) {
      throw new ApiError(400, "All fields are required");
    }

    const existUser = await User.findOne({
      $or: [{ username }, { email }],
    });
    if (existUser) {
      throw new ApiError(404, "User already exist");
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    // console.log(req.files);
    if (!avatarLocalPath) {
      throw new ApiError(407, "Error in extraction of local path");
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar) {
      throw new ApiError(407, "Upload an avatar");
    }

    const user = await User.create({
      email,
      username: username.toLowerCase(),
      fullName,
      passwordHash: password,
      avatar: avatar.url,
    });
    const createdUser = await User.findById(user._id).select(
      "-passwordHash -refreshToken",
    );
    if (!createdUser) {
      throw new ApiError(407, "Error while creating user");
    }

    return res.status(202).json(createdUser);
  } catch (error) {
    next(error);
    console.log(error.message);
  }
};

const generateAccessAndRefreshToken = async function (userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User does not exist");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      400,
      `Cannot Generate Access token and refresh token: ${error.message}`,
    );
  }
};

const loginUser = async function (req, res, next) {
  try {
    const { username, email, password } = req.body;

    if (!username && !email) {
      throw new ApiError(404, "Username or email required");
    }

    if (!password || (typeof password === "string" && password.trim() === "")) {
      throw new ApiError(404, "Password not provided");
    }
    const user = await User.findOne({
      $or: [{ username }, { email }],
    });
    if (!user) {
      throw new ApiError(404, "User does not exist");
    }

    const isPaswordValid = await user.isPasswordCorrect(password);
    if (!isPaswordValid) {
      throw new ApiError(404, "Incorrect Password");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id,
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    const loggedInUser = await User.findById(user._id).select(
      "-passwordHash -refreshToken",
    );

    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json({ user: loggedInUser, refreshToken, accessToken });
  } catch (error) {
    throw new ApiError(400, `Error while logging in user: ${error.message}`);
    next(error);
  }
};

const logoutUser = async function (req, res, next) {
  try {
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: { refreshToken: undefined },
      },
      {
        new: true,
      },
    );
    const options = {
      httpOnly: true,
      secure: true,
    };

    res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json({});
  } catch (error) {
    throw new ApiError(400, `Error while logging out user: ${error.message}`);
    next(error);
  }
};

const refreshAccessToken = async function (req, res, next) {
  try {
    console.log(req.cookies.refreshToken);
    const incomingRefreshToken =
      req.cookies?.refreshToken || req.body?.refreshToken;
    if (!incomingRefreshToken) {
      throw new ApiError(404, "Invalid Refresh Token");
    }

    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(400, "No user Found");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(404, "Refresh Token has expired");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id,
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    res
      .status(202)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json({ accessToken, refreshToken });
  } catch (error) {
    throw new ApiError(
      404,
      `Error while refreshing access token: ${error.message}`,
    );
    next(error);
  }
};

export { registerUser, loginUser, logoutUser, refreshAccessToken };
