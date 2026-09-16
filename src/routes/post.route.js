import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  archivePost,
  createPost,
  publishPost,
  getMyPosts,
  getPublishedPosts,
  getPostBySlug,
  updatePost,
  deletePost,
} from "../controllers/post.controller.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router
  .route("/create-post")
  .post(verifyJWT, upload.single("coverImage"), createPost);
router.route("/publish-post/:slug").patch(verifyJWT, publishPost);
router.route("/archive-post/:slug").patch(verifyJWT, archivePost);
router
  .route("/update-post/:slug")
  .patch(verifyJWT, upload.single("coverImage"), updatePost);
router.route("/delete-post/:slug").delete(verifyJWT, deletePost);
router.route("/user-posts").get(verifyJWT, getMyPosts);
router.route("/published-posts").get(getPublishedPosts);
router.route("/get-post/:slug").get(verifyJWT, getPostBySlug);

export default router;
