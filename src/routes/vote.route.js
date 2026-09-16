import { Router } from "express";
import { votePost } from "../controllers/vote.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = new Router();

router.route("/:slug/vote").post(verifyJWT, votePost);

export default router;
