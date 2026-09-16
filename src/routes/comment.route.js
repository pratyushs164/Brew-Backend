import { Router } from "express";
import {
  createComment,
  deleteComment,
  editComment,
  getComments,
  likeComment,
  unlikeComment,
} from "../controllers/comment.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = new Router();

router.route("/:slug/comment/create").post(verifyJWT, createComment);
router.route("/:slug/comment/:commentId/reply").post(verifyJWT, createComment);
router.route("/:slug/comment/get-comments").get(getComments);
router.route("/:slug/comment/:commentId/get-reply").get(getComments);
router
  .route("/:slug/comment/:commentId/edit-comment")
  .patch(verifyJWT, editComment);
router
  .route("/:slug/comment/:commentId/like-comment")
  .post(verifyJWT, likeComment);
router
  .route("/:slug/comment/:commentId/unlike-comment")
  .delete(verifyJWT, unlikeComment);
router
  .route("/:slug/comment/:commentId/delete-comment")
  .patch(verifyJWT, deleteComment);

export default router;
