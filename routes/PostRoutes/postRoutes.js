const express = require("express");
const router = express.Router();

const {
  createPost,
  getAllPosts,
  getPostById,
  deletePost,
  likePost,
  unlikePost,
  commentOnPost,
  deleteCommentOnPost,
  updatePost,
  grantAccess,
} = require("../../controllers/PostControllers/postController");
const {
  protect,
  customer,
  allowAllExceptCustomer,
} = require("../../middlewares/authMiddleware");

router.post("/create", allowAllExceptCustomer, createPost);
router.get("/all", protect, getAllPosts);

router.get("/:id", protect, getPostById);

//update post
router.put("/:id", protect, updatePost);

router.delete("/:id", allowAllExceptCustomer, deletePost);

router.put("/like/:id", protect, customer, likePost);
router.put("/unlike/:id", protect, customer, unlikePost);

router.post("/comment/:id", protect, customer, commentOnPost);
router.delete(
  "/comment/:id/:comment_id",
  allowAllExceptCustomer,
  deleteCommentOnPost
);

module.exports = router;
