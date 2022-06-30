const generateToken = require("../../utils/generateToken");
const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");
const { roles } = require("../../utils/roles");
const bcrypt = require("bcryptjs");
const { User } = require("../../models/UserModels/userModel");
const { Trainer } = require("../../models/UserModels/trainerModel");
const {
  CustomerDetails,
} = require("../../models/UserModels/customerDetailsModel");
const crypto = require("crypto");
const smtpTransport = require("nodemailer-smtp-transport");
const nodemailer = require("nodemailer");

// let transporter = nodemailer.createTransport(
//   "smtp://confirmation@realchallenge.nl:Htf550z~@mail.realchallenge.nl:25"
// );

let transporter = nodemailer.createTransport({
  host: "mail.realchallenge.nl",
  port: 25,
  secure: false,
  auth: {
    user: "confirmation@realchallenge.nl",
    pass: "Htf550z~",
  },
  tls: {
    // do not fail on invalid certs
    rejectUnauthorized: false,
  },
});
// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const authUser = asyncHandler(async (req, res, next) => {
  if (Object.keys(req.body).length === 0) {
    return res.status(500).json("Body fields cannot be empty.");
  }
  try {
    const errors = validationResult(req); // Finds the validation errors in this request and wraps them in an object with handy functions

    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }
    console.log(req.body);
    let credentials = {
      username: req.body.username,
      passwordHash: bcrypt.hashSync(req.body.password, 10),
    };

    const user = await User.findOne({ username: credentials.username });

    if (!user) {
      return res.status(500).json({
        message:
          "User doesn't exist.Provide correct credentials or register yourself if you are not already registered.",
      });
    } else {
      if (user && bcrypt.compareSync(req.body.password, user.passwordHash)) {
        console.log(user);
        return res.status(200).json({
          message: "User Logged In successfully!",
          username: user.username,
          email: user.email,
          isActive: user.isActive,
          user_id: user.id,
          role: user.role,
          points: user.points,
          token: generateToken(
            user._id,
            user.role,
            user.email,
            user.username,
            user.isActive
          ),
        });
      } else {
        return res.status(400).json("Please enter correct credentials");
      }
    }
  } catch (err) {
    return next(err);
  }
});

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
const registerUser = asyncHandler(async (req, res, next) => {
  try {
    const errors = validationResult(req); // Finds the validation errors in this request and wraps them in an object with handy functions

    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }
    const { username, email } = req.body;
    const userExist = await User.findOne({ username });
    const emailExist = await User.findOne({ email });
    if (userExist) {
      return res
        .status(400)
        .json(
          "User Already exist with this username. Please choose another username"
        );
    }
    if (emailExist) {
      return res
        .status(400)
        .json("User Already exist with this email. Please login.");
    }
    let newUser = new User({
      username: req.body.username,
      email: req.body.email,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      passwordHash: bcrypt.hashSync(req.body.password, 10),
      gender: req.body.gender,
      // roleId: 4,
    });
    console.log(newUser);
    newUser = await newUser.save();

    if (!newUser) {
      return res.status(400).json("User cannot be created!");
    } else {
      // setting up nodemailer
      crypto.randomBytes(32, async (err, buffer) => {
        if (err) {
          console.log(err);
        }
        const token = buffer.toString("hex");
        // const user = await User.findOne({ email: newUser.email });
        if (!newUser) {
          return res.status(422).json({ error: "User does not exist" });
        } else {
          newUser.resetToken = token;
          // 24 hours expire time
          newUser.resetTokenExpire = Date.now() + 86400000;

          const results = newUser.save();
          if (results) {
            const mailOptions = {
              from: "no-reply@realchallenge.fit",
              to: newUser.email,
              subject: "Account Verification Link",
              html: `
              <h1>Real Challenge Account Confirmation</h1>
               <h2>Email Confirmation</h2>
               <p>Please verify your email in order to continue with Real Challenge.</p>
               <h5>Verification Link: <a href="${process.env.FRONTEND_ADD}/email-verification/${token}">link to verify your email</a><h5>
               <p>This link will expire after 24 hours.</p>
             `,
            };

            transporter.sendMail(mailOptions, function (err, success) {
              if (err) {
                // console.log(process.env.EMAIL);
                console.log("error from email transported", err);
                return res
                  .status(400)
                  .json("unable to send email to customer with given id");
              } else {
                res.status(200).json({
                  message:
                    "Success! Please Confirm your email to verify your registeration!",
                });
              }
            });
          }
        }
      });

      return res.status(201).json({
        mesage: "User Created Successfully",
        _id: newUser._id,
        username: newUser.username,
        role: newUser.role,
        isActive: newUser.isActive,
        emailVerification: newUser.resetTokenExpire,
        email: newUser.email,
        token: generateToken(
          newUser._id,
          newUser.role,
          newUser.email,
          newUser.username,
          newUser.isActive
        ),
      });
    }
  } catch (err) {
    return next(err);
  }
});

// @desc    Confirmation-Email
// @route   GET /api/verify/:token
// @access  Public

const verifyEmail = async (req, res) => {
  const token = req.params.token;
  console.log(token);
  const user = await User.findOne({
    resetToken: token,
    resetTokenExpire: { $gt: Date.now() },
  });

  if (!token) {
    return res.status(400).json({
      msg: "Your verification link may have expired. Please click on resend for verify your Email.",
    });
  } else {
    // User.findOne({ _id: token._userId, email: req.params.email }, function (err, user) {
    // not valid user
    if (!user) {
      return res.status(401).send({
        msg: "We were unable to find a user for this verification. Please SignUp!",
      });
    }
    // user is already verified
    else if (user.isActive) {
      return res
        .status(200)
        .send("User has been already verified. Please Login");
    }
    // verify user
    else {
      // change isVerified to true
      user.isActive = true;
      user.save(function (err) {
        // error occur
        if (err) {
          return res.status(500).send({ msg: err.message });
        }
        // account successfully verified
        else {
          return res
            .status(200)
            .send("Your account has been successfully verified");
        }
      });
    }
  }
};

// @desc    Resend Verification Email
// @route   GET /api/resend
// @access  Public
const resendLink = (req, res, next) => {
  console.log("bbom");
  User.findOne({ email: req.body.email }, function (err, user) {
    // user is not found into database
    if (!user) {
      return res.status(400).send({
        msg: "We were unable to find a user with that email. Make sure your Email is correct!",
      });
    }
    // user has been already verified
    else if (user.isActive) {
      return res
        .status(200)
        .send("This account has been already verified. Please log in.");
    }
    // send verification link
    else {
      // generate token and save
      crypto.randomBytes(32, async (err, buffer) => {
        if (err) {
          console.log(err);
        }
        const token = buffer.toString("hex");
        // const user = await newUser.findOne({ email: newUser.email });
        // if (!user) {
        //   return res.status(422).json({ error: "User does not exist" });
        // } else {
        user.resetToken = token;
        // 24 hours expire time
        user.resetTokenExpire = Date.now() + 86400000;

        const results = user.save();
        if (results) {
          const mailOptions = {
            from: "no-reply@realchallenge.fit",
            to: user.email,
            subject: "Account Verification Link",
            html: `
                   <h1>Real Challenge Account Confirmation</h1>
                   <h2>Email Confirmation</h2>
                   <p>Please verify your email in order to continue with Real Challenge.</p>
                   <h5>Verification Link: <a href="${process.env.FRONTEND_ADD}/email-verification/${token}">link to reset your password</a><h5>
                   <p>This link will expire after 24 hours.</p>
                 `,
          };

          transporter.sendMail(mailOptions, function (err, success) {
            if (err) {
              // console.log(process.env.EMAIL);
              console.log("error from email transported", err);
              return res.status(400).json({
                msg: "Technical Issue!, Please click on resend for verify your Email.",
              });
            } else {
              res.status(200).json({
                message:
                  "A verification email has been sent to " +
                  user.email +
                  ". It will be expire after one day. If you not get verification Email click on resend token.",
              });
            }
          });
        }
      });

      // return res.status(201).json({
      //   mesage: "User Created Successfully",
      //   _id: newUser._id,
      //   username: newUser.username,
      //   role: newUser.role,
      //   isActive: newUser.isActive,
      //   token: generateToken(
      //     newUser._id,
      //     newUser.role,
      //     newUser.email,
      //     newUser.username
      //   ),
      // });

      // var token = new Token({ _userId: user._id, token: crypto.randomBytes(16).toString('hex') });
      // token.save(function (err) {
      //     if (err) {
      //       return res.status(500).send({msg:err.message});
      //     }

      //     // Send email (use credintials of SendGrid)
      //         var transporter = nodemailer.createTransport({ service: 'Sendgrid', auth: { user: process.env.SENDGRID_USERNAME, pass: process.env.SENDGRID_PASSWORD } });
      //         var mailOptions = { from: 'no-reply@example.com', to: user.email, subject: 'Account Verification Link', text: 'Hello '+ user.name +',\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/confirmation\/' + user.email + '\/' + token.token + '\n\nThank You!\n' };
      //         transporter.sendMail(mailOptions, function (err) {
      //            if (err) {
      //             return res.status(500).send({msg:'Technical Issue!, Please click on resend for verify your Email.'});
      //          }
      //         return res.status(200).send('A verification email has been sent to ' + user.email + '. It will be expire after one day. If you not get verification Email click on resend token.');
      //     });
      // });
    }
  });
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate("userRole")
    .select("-passwordHash");
  if (user) {
    res.json({
      user,
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

// @desc    Update User by Id
// @route   GET /api/users/:id
// @access  Private
const updateUserProfile = asyncHandler(async (req, res, next) => {
  try {
    const update = req.body;
    console.log("update", update);
    const userId = req.params.userId;
    await User.findByIdAndUpdate(userId, update, { useFindAndModify: false });
    const user = await User.findById(userId);
    res.status(200).json({
      data: user,
      message: "User has been updated",
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId).select("-passwordHash");

  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

// @desc    Get All users profile
// @route   GET /api/users/
// @access  Private/Admin
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({})
    .populate("trainerDetails")
    .select("-passwordHash");
  if (users) {
    res.status(200).json({
      users,
    });
  } else {
    res.status(404);
    throw new Error("Users Cannot be fetched");
  }
});

// @desc    Delete user
// @route   Delete /api/users/:userId
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);

  if (user) {
    if (user.trainerDetails) {
      await Trainer.findById(user.trainerDetails).remove();
    } else if (user.customerDetails) {
      await CustomerDetails.findById(user.customerDetails).remove();
    }
    await user.remove();
    res.json({ message: "User removed" });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

//============================================== Google & facebook Signup & Login ==============================================

// @desc    Register using Social Login Google
// @route   POST /api/users/register/:social
// @access  Public
const registerUserWithSocial = asyncHandler(async (req, res, next) => {
  try {
    const errors = validationResult(req); // Finds the validation errors in this request and wraps them in an object with handy functions

    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }

    const type = req.params.type;
    if (type == "google") {
      const { familyName, givenName, email, googleId, imageUrl } =
        req.body.profileObj;

      const emailExist = await User.findOne({ email });
      if (emailExist) {
        return res.status(400).json("User Already exist with this email");
      }

      let newUser = new User({
        username: givenName,
        email: email,
        firstName: givenName,
        lastName: familyName,
        passwordHash: req.body.accessToken,
        avatar: imageUrl,
        googleIdHash: bcrypt.hashSync(googleId, 10),
        gender: req.body.gender,
      });

      console.log(newUser);
      newUser = await newUser.save();

      if (!newUser) {
        return res.status(400).json("User cannot be created!");
      } else {
        return res.status(201).json({
          mesage: "User Created Successfully",
          _id: newUser._id,
          username: newUser.username,
          role: newUser.role,

          token: generateToken(
            newUser._id,
            newUser.role,
            newUser.email,
            newUser.username,
            newUser.isActive
          ),
        });
      }
    } else if (type == "facebook") {
      const emailExist = await User.findOne({ email: req.body.email });
      if (emailExist) {
        return res.status(400).json("User Already exist with this email");
      }
      const { name } = req.body.name.split(" ")[0];
      let newUser = new User({
        username: name,
        email: req.body.email,
        passwordHash: req.body.accessToken,
        avatar: req.body.picture.data.url,
        facebookIdHash: bcrypt.hashSync(req.body.id, 10),
        gender: req.body.gender,
      });

      console.log(newUser);
      newUser = await newUser.save();

      if (!newUser) {
        return res.status(400).json("User cannot be created!");
      } else {
        return res.status(201).json({
          mesage: "User Created Successfully",
          _id: newUser._id,
          username: newUser.username,
          role: newUser.role,

          token: generateToken(
            newUser._id,
            newUser.role,
            newUser.email,
            newUser.username,
            newUser.isActive
          ),
        });
      }
    }
  } catch (err) {
    return next(err);
  }
});

// @desc    Auth user & get token
// @route   POST /api/users/login/:type
// @access  Public
const socialLogin = asyncHandler(async (req, res, next) => {
  if (Object.keys(req.body).length === 0) {
    return res.status(500).json("Body fields cannot be empty.");
  }
  try {
    const errors = validationResult(req); // Finds the validation errors in this request and wraps them in an object with handy functions

    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }

    if (req.params.type == "google") {
      const user = await User.findOne({ email: req.body.email });

      if (!user) {
        return res.status(500).json({
          message: "User doesn't exist.Provide Correct Google Email ID.",
        });
      } else {
        if (user && bcrypt.compareSync(req.body.googleId, user.googleIdHash)) {
          return res.status(200).json({
            message: "User Logged In successfully!",
            username: user.username,
            user_id: user.id,
            role: user.role,
            token: generateToken(
              user._id,
              user.role,
              user.email,
              user.username,
              user.isActive
            ),
          });
        } else {
          return res.status(400).json("Incorrect Google ID");
        }
      }
    } else if (req.params.type == "facebook") {
      const user = await User.findOne({ email: req.body.email });

      if (!user) {
        return res.status(500).json({
          message: "User doesn't exist.Provide Correct Facebook Email ID.",
        });
      } else {
        if (user && bcrypt.compareSync(req.body.id, user.facebookIdHash)) {
          return res.status(200).json({
            message: "User Logged In successfully!",
            username: user.username,
            user_id: user.id,
            role: user.role,
            token: generateToken(
              user._id,
              user.role,
              user.email,
              user.username,
              user.isActive
            ),
          });
        } else {
          return res.status(400).json("Incorrect Facebook ID");
        }
      }
    }
  } catch (err) {
    return next(err);
  }
});

//=============================================================================================================

// @desc    Create users by role
// @route   POST /api/users/create
// @access  Private/Admin
const createUser = asyncHandler(async (req, res, next) => {
  try {
    const errors = validationResult(req); // Finds the validation errors in this request and wraps them in an object with handy functions

    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }
    const { username, email } = req.body;
    const userExist = await User.findOne({ username });
    const emailExist = await User.findOne({ email });
    if (userExist || emailExist) {
      return res
        .status(400)
        .json("User Already exist with this username/email.");
    }
    let newUser = new User({
      username: req.body.username,
      email: req.body.email,
      firstName: req.body.firstName ? req.body.firstName : "",
      lastName: req.body.lastName ? req.body.lastName : "",
      passwordHash: bcrypt.hashSync(req.body.password, 10),
      role: req.body.role,
      heroBanner: req.body.heroBanner ? req.body.heroBanner : "",
      videoTrailerLink: req.body.videoTrailerLink
        ? req.body.videoTrailerLink
        : "",
      motto: req.body.motto ? req.body.motto : "",
      bio: req.body.bio ? req.body.bio : "",
    });

    newUser = await newUser.save();

    if (!newUser) {
      return res.status(400).json("User cannot be created!");
    } else {
      return res.status(201).json({
        mesage: "User Created Successfully",
        _id: newUser._id,
        username: newUser.username,
        role: newUser.role,

        token: generateToken(
          newUser._id,
          newUser.role,
          newUser.email,
          newUser.username,
          newUser.isActive
        ),
      });
    }
  } catch (err) {
    return next(err);
  }
});

// @desc    resets user password
// @route   post /api/users/reset-password
// @access  public
const resetUserPassword = asyncHandler(async (req, res, next) => {
  if (Object.keys(req.body).length === 0) {
    return res.status(500).json("Body fields cannot be empty.");
  }
  try {
    crypto.randomBytes(32, async (err, buffer) => {
      if (err) {
        console.log(err);
      }
      const token = buffer.toString("hex");
      const user = await User.findOne({ email: req.body.email });
      if (!user) {
        return res.status(422).json({ error: "User does not exist" });
      } else {
        user.resetToken = token;
        // 2hours expire time
        user.resetTokenExpire = Date.now() + 7200000;

        const results = user.save();
        if (results) {
          const mailOptions = {
            from: "no-reply@realchallenge.fit",
            to: user.email,
            subject: "Password Reset",
            html: `
             <h1>Real Challenge Fit</h1>
             <h2>Password Reset</h2>
             <p>We have recently received your request to reset the password</p>
             <h5>Please click on this <a href="${process.env.FRONTEND_ADD}/reset-password/${token}">link to reset your password</a><h5>
             <p>This link will expire after 3 hours.</p>
           `,
          };

          transporter.sendMail(mailOptions, function (err, success) {
            if (err) {
              console.log("here", process.env.EMAIL);
              console.log("error from email transported", err);
              return res
                .status(400)
                .json("unable to send email to customer with given id");
            } else {
              res
                .status(200)
                .json({ message: "Success! Please check your email!" });
            }
          });
        }
      }
    });
  } catch (err) {
    return next(err);
  }
});

// @desc checks if user email is verified or not
// @route post /api/users/verify/check",
const checkEmailVerification = async (req, res, next) => {
  if (Object.keys(req.body).length === 0) {
    return res.status(500).json("Body fields cannot be empty.");
  }

  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(422).json({ error: "User does not exist" });
    } else {
      console.log(user);
      if (user.isActive) {
        return res.status(200).json({ error: "Email is verified!" });
      } else {
        return res.status(400).json({ error: "Email is not verified!" });
      }
    }
  } catch (err) {
    return next(err);
  }
};
// @desc    reset a new user
// @route   POST /api/users/new-password
// @access  Public
const newUserPassword = asyncHandler(async (req, res, next) => {
  try {
    const { password, token } = req.body;
    console.log(password, token);
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json("Unable to reset password, session expired");
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    user.passwordHash = passwordHash;
    user.resetToken = undefined;
    user.resetTokenExpire = undefined;
    const saved = user.save();
    if (saved) {
      return res.status(200).json("Passowrd updated!");
    } else {
      return res.status(400).json("Unable to reset password, please try again");
    }
  } catch (err) {
    return next(err);
  }
});

const grantAccess = function (action, resource) {
  return async (req, res, next) => {
    try {
      // console.log("Access Granted", req.user.role);
      // console.log(resource);
      const permission = roles.can(req.user.role)[action](resource);
      if (!permission.granted) {
        return res.status(401).json({
          error: "You don't have enough permission to perform this action",
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

const allowIfLoggedin = async (req, res, next) => {
  try {
    const user = res.locals.loggedInUser;
    console.log(user);
    if (!user)
      return res.status(401).json({
        error: "You need to be logged in to access this route",
      });
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

const destroy = asyncHandler(async (req, res, next) => {
  try {
    await User.deleteMany({});
    await Trainer.deleteMany({});
    await CustomerDetails.deleteMany({});
    console.log("deletesd");
    res.status(200).send({
      status:
        "Successfully removed all documents from user, trainer and customer detail files",
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
});

module.exports = {
  authUser,
  registerUser,
  getUserById,
  getUserProfile,
  getAllUsers,
  updateUserProfile,
  deleteUser,
  allowIfLoggedin,
  grantAccess,
  resetUserPassword,
  newUserPassword,
  registerUserWithSocial,
  socialLogin,
  createUser,
  verifyEmail,
  resendLink,
  checkEmailVerification,
  destroy,
};
