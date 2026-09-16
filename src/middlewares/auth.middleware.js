import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";

const verifyJWT = async function (req, res, next) {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(404, "cannot get access token in verifyJWT");
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id).select(
      "-passwordHash -refreshToken",
    );

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(404, `Error while verifying: ${error.message}`);
  }
};

const optionalJWT = async function (req, res, next) {
  try {
    const token = req.cookies.accessToken;
    let user;
    if (!token) {
      user = null;
    } else {
      const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      user = await User.findById(decodedToken?._id).select(
        "-passwordHash -refreshToken",
      );
    }
    req.user = user;
    next();
  } catch (error) {
    req.user = null;
    next(error);
  }
};

export { verifyJWT, optionalJWT };
