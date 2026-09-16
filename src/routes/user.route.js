import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import {
  followUser,
  getCurrentUser,
  getUserProfile,
  unfollowUser,
  updateAvatar,
  updatePassword,
  updateUserDetails,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/update-password").post(verifyJWT, updatePassword);
router.route("/get-current-user").get(verifyJWT, getCurrentUser);
router.route("/update-user").patch(verifyJWT, updateUserDetails);
router
  .route("/update-avatar")
  .patch(verifyJWT, upload.single("avatar"), updateAvatar);
router.route("/:username").get(verifyJWT, getUserProfile);

router.route("/:username/follow").post(verifyJWT, followUser);
router.route("/:username/unfollow").delete(verifyJWT, unfollowUser);
export default router;
