const mongoose = require('mongoose');
const Users = require('../models/user');
const Admin = require('../models/admin');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const passport = require('passport');

// Multer setup for file uploads
let storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, __dirname + '/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    },
});

let upload = multer({ storage: storage });

// Nodemailer setup for sending emails
const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD, 
    },
});

// Generate a random verification code
const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
};

const landingPage = (req, res) => {
    res.render('index');
};

const features = (req, res) => {
    res.render('features');
};

const usersignup = (req, res) => {
    res.render('signup', {
        errors: [],
        message: '',
        error_msg: '',
        fn: '',
        ln: '',
        phone: '',
        email: '',
        matric: '',
        age: '',
    });
};

const usersignupPost = async (req, res) => {
    const { fn, ln, phone, email, matric, age, pass1, pass2 } = req.body;
    const file = req.file;
    let errors = [];

    // Validate inputs
    if (!fn || !ln || !phone || !matric || !email || !age || !pass1 || !pass2) {
        errors.push({ msg: "Please ensure all fields are filled" });
    }

    if (pass1 !== pass2) {
        errors.push({ msg: "Passwords don't match" });
    }

    if (pass1.length < 6) {
        errors.push({ msg: "Passwords must be at least 6 characters" });
    }

    if (!file) {
        errors.push({ msg: "Please upload a profile picture" });
    }

    if (errors.length > 0) {
        return res.render('signup', {
            errors,
            message: '',
            error_msg: '',
            fn,
            ln,
            phone,
            email,
            matric,
            age,
        });
    }

    try {
        // Check if user already exists
        const existingUser = await Users.findOne({ email });
        if (existingUser) {
            errors.push({ msg: "Email is already registered" });
            return res.render('signup', { errors, fn, ln, phone, email, matric, age });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(pass1, 10);

        // Generate verification code
        const verificationCode = generateVerificationCode();

        // Save user to database (unverified)
        const newUser = new Users({
            fn,
            ln,
            phone,
            email,
            matric,
            age,
            password: hashedPassword,
            profilePicture: file.filename, // Save the local file path
            verificationCode, // Store the verification code
            isVerified: false, // Mark user as unverified
        });

        await newUser.save();

        // Send verification email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Verify Your Email Address',
            text: `Your verification code is: ${verificationCode}`,
            html: `<p>Your verification code is: <strong>${verificationCode}</strong></p>`,
        };

        transporter.sendMail(mailOptions, async (error, info) => {
            if (error) {
                console.error("Error sending verification email:", error);
                req.flash('error_msg', "Failed to send verification email. Please try again.");
                return res.redirect('/signup');
            } else {
                console.log("Verification email sent:", info.response);

                // Interact with Ethereum smart contract
                try {
                    const contract = req.contractInstance; // Ethereum instance passed via middleware
                    if (contract) {
                        const tx = await contract.registerUser(
                            fn, // firstName
                            ln, // lastName
                            phone, // phone
                            email, // email
                            matric,
                            parseInt(age), // age (convert to number)
                            file.filename // profilePicture (local file path)
                        );
                        await tx.wait(); // Wait for the transaction to be mined
                        console.log("User registered on blockchain:", tx.hash);
                    } else {
                        console.warn("Contract instance not available. Skipping blockchain registration.");
                    }
                } catch (contractError) {
                    console.error("Error interacting with smart contract:", contractError);
                }

                req.flash('message', "Signup successful! Please check your email for the verification code.");
                res.redirect('/verify-email'); // Redirect to email verification page
            }
        });
    } catch (err) {
        console.error("Error during signup:", err);
        req.flash('error_msg', "An error occurred. Please try again.");
        res.redirect('/signup');
    }
};

// Email verification page
const verifyEmailPage = (req, res) => {
    res.render('verify-email', {
        errors: [],
        message: '',
        error_msg: '',
    });
};

// Handle email verification
const verifyEmailPost = async (req, res) => {
    const { email, verificationCode } = req.body;
    let errors = [];

    if (!email || !verificationCode) {
        errors.push({ msg: "Please provide your email and verification code" });
    }

    if (errors.length > 0) {
        return res.render('verify-email', {
            errors,
            message: '',
            error_msg: '',
        });
    }

    try {
        // Find the user by email
        const user = await Users.findOne({ email });

        if (!user) {
            errors.push({ msg: "User not found" });
            return res.render('verify-email', {
                errors,
                message: '',
                error_msg: 'User not found',
            });
        }

        // Check if the verification code matches
        if (user.verificationCode !== verificationCode) {
            errors.push({ msg: "Invalid verification code" });
            return res.render('verify-email', {
                errors,
                message: '',
                error_msg: 'Invalid verification code',
            });
        }

        // Mark user as verified
        user.isVerified = true;
        user.verificationCode = null; // Clear the verification code
        await user.save();

        req.flash('message', "Email verified successfully! You can now log in.");
        res.redirect('/login');
    } catch (err) {
        console.error("Error during email verification:", err);
        req.flash('error_msg', "An error occurred. Please try again.");
        res.redirect('/verify-email');
    }
};

const loginPage = (req, res) => {
    res.render('login', {
        errors: [],
        message: '',
        error_msg: '',
        email: '',
    });
};

const loginPost = async (req, res) => {
    const { email, password } = req.body;
    let errors = [];

    // Validate inputs
    if (!email || !password) {
        errors.push({ msg: "Please fill in all fields" });
    }

    if (errors.length > 0) {
        return res.render('login', {
            errors,
            message: '',
            error_msg: '',
            email,
        });
    }

    try {
        // Check if user exists
        const user = await Users.findOne({ email });
        if (!user) {
            errors.push({ msg: "Email not registered" });
            return res.render('login', {
                errors,
                message: '',
                error_msg: '',
                email,
            });
        }

        // Check if user is verified
        if (!user.isVerified) {
            errors.push({ msg: "Please verify your email before logging in" });
            return res.render('login', {
                errors,
                message: '',
                error_msg: '',
                email,
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            errors.push({ msg: "Incorrect password" });
            return res.render('login', {
                errors,
                message: '',
                error_msg: '',
                email,
            });
        }

        // Set session data
            req.session.userId = user._id;
            req.session.user = {
                id: user._id,
                name: `${user.fn} ${user.ln}`,
                email: user.email,
                profilePicture: user.profilePicture,
                matric: user.matric
            };

            req.flash('message', "Login successful!");
            return res.redirect('/dashboard');
        } catch (err) {
            console.error("Error during login:", err);
            req.flash('error_msg', "An error occurred. Please try again.");
            return res.redirect('/login');
    }
};

const dashboardPage = async (req, res) => {
    try {
        if (!req.session.userId) {
            req.flash('error_msg', "Please log in first.");
            return res.redirect('/login');
        }

        const user = await Users.findById(req.session.userId);
        if (!user) {
            req.flash('error_msg', "User not found.");
            return res.redirect('/login');
        }

        // Calculate progress for each application
        user.applications = user.applications.map(application => {
            application.progress = calculateProgress(application);
            return application;
        });

        // Format today's date
        const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
        const todayDate = new Date().toLocaleDateString('en-US', dateOptions);

        res.render('dashboard', {
            user: {
                name: `${user.fn} ${user.ln}`,
                profilePicture: user.profilePicture ? `/uploads/${user.profilePicture}` : '/default-avatar.png',
                matric: `${user.matric}`,
                walletBalance: user.walletBalance,
                pendingDisbursement: user.pendingDisbursement,
                documentsRequired: user.documentsRequired,
                recentDisbursements: user.recentDisbursements,
                aidProgress: user.aidProgress, 
                importantDates: user.importantDates,
                applications: user.applications, // Pass applications with progress
            },
            todayDate,
            message: req.flash('message'),
            error_msg: req.flash('error_msg'),
        });
    } catch (err) {
        console.error("Error loading dashboard:", err);
        req.flash('error_msg', "Error loading dashboard data");
        return res.redirect('/login');
    }
};

const updateWalletBalance = async (req, res) => {
    const { userId, amount } = req.body;

    try {
        const user = await Users.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.walletBalance += amount;
        await user.save();

        res.status(200).json({ success: true, message: 'Wallet balance updated', walletBalance: user.walletBalance });
    } catch (err) {
        console.error("Error updating wallet balance:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const applyAidPage = async (req, res) => {
    try {
        const user = await Users.findById(req.session.userId);
        if (!user) {
            req.flash('error_msg', "User not found.");
            return res.redirect('/login');
        }

        res.render('apply-aid', {
            user: {
                name: `${user.fn} ${user.ln}`,
                profilePicture: user.profilePicture ? `/uploads/${user.profilePicture}` : '/default-avatar.png', 
                matric: user.matric,
            },
            message: req.flash('message'),
            error_msg: req.flash('error_msg'),
        });
    } catch (err) {
        console.error("Error loading aid application page:", err);
        req.flash('error_msg', "Error loading aid application page.");
        res.redirect('/dashboard');
    }
};

const submitAid = async (req, res) => {
    const { aidType, amount, reason } = req.body;
    const documents = req.files.map(file => file.filename); // Get uploaded file paths
    const userId = req.session.userId;

    try {
        // Find the user
        const user = await Users.findById(userId);
        if (!user) {
            req.flash('error_msg', "User not found.");
            return res.redirect('/apply-aid');
        }

        // Validate the form data
        if (!aidType || !amount || !reason || documents.length === 0) {
            req.flash('error_msg', "Please fill out all fields and upload required documents.");
            return res.redirect('/apply-aid');
        }

        // Validate the amount (must be a positive number)
        if (isNaN(amount) || amount <= 0) {
            req.flash('error_msg', "Invalid amount. Please enter a positive number.");
            return res.redirect('/apply-aid');
        }

        // Check user eligibility (example: no more than 3 pending applications)
        const pendingApplications = user.applications.filter(app => app.status === 'Pending');
        if (pendingApplications.length >= 3) {
            req.flash('error_msg', "You have reached the maximum number of pending applications.");
            return res.redirect('/apply-aid');
        }

        // Create a new application object
        const newApplication = {
            aidType,
            amount,
            reason,
            documents,
            status: 'Pending', // Default status
            dateApplied: new Date(), // Add the current date
            approvals: [
                {
                    role: 'Course Advisor', // First level of approval
                    status: 'Pending', // Default status
                    date: new Date(), // Current date
                },
            ],
        };

        // Add the application to the user's applications array
        user.applications.push(newApplication);
        await user.save();

        // Notify the Course Advisor
        const courseAdvisor = await Admin.findOne({ role: 'Course Advisor' });
        if (courseAdvisor) {
            courseAdvisor.notifications.push({
                message: `New financial aid application submitted by ${user.fn} ${user.ln} (${user.email}).`,
                date: new Date(),
            });
            await courseAdvisor.save();
        }

        // Notify the user
        req.flash('message', "Your application has been submitted successfully!");
        res.redirect('/dashboard');
    } catch (err) {
        console.error("Error submitting aid application:", err);
        req.flash('error_msg', "An error occurred. Please try again.");
        res.redirect('/apply-aid');
    }
};

const calculateProgress = (application) => {
    const roles = ['Course Advisor', 'HOD', 'VC', 'Bursary', 'Super Admin'];
    let progress = 0;

    // Find the highest approval level reached
    for (let i = 0; i < roles.length; i++) {
        const approval = application.approvals.find(app => app.role === roles[i]);
        if (approval && approval.status === 'Approved') {
            progress = (i + 1) * 20; // 20% for each level
        } else {
            break; // Stop if an approval is missing or rejected
        }
    }

    return progress;
};

const disbursementsPage = async (req, res) => {
    try {
        if (!req.session.userId) {
            req.flash('error_msg', "Please log in first.");
            return res.redirect('/login');
        }

        const user = await Users.findById(req.session.userId);
        if (!user) {
            req.flash('error_msg', "User not found.");
            return res.redirect('/login');
        }

        // Fetch disbursement data from recentDisbursements
        const disbursements = user.recentDisbursements || [];

        res.render('disbursements', {
            user: {
                name: `${user.fn} ${user.ln}`,
                profilePicture: user.profilePicture ? `/uploads/${user.profilePicture}` : '/default-avatar.png',
                matric: user.matric,
            },
            disbursements, // Pass disbursements data to the view
            message: req.flash('message'),
            error_msg: req.flash('error_msg'),
        });
    } catch (err) {
        console.error("Error loading disbursements page:", err);
        req.flash('error_msg', "Error loading disbursements data.");
        res.redirect('/dashboard');
    }
};

const settingsPage = async (req, res) => {
    try {
        if (!req.session.userId) {
            req.flash('error_msg', "Please log in first.");
            return res.redirect('/login');
        }

        const user = await Users.findById(req.session.userId);
        if (!user) {
            req.flash('error_msg', "User not found.");
            return res.redirect('/login');
        }

        res.render('settings', {
            user: {
                name: `${user.fn} ${user.ln}`,
                profilePicture: user.profilePicture ? `/uploads/${user.profilePicture}` : '/default-avatar.png',
                matric: user.matric,
                email: user.email,
                phone: user.phone,
                age: user.age,
            },
            message: req.flash('message'),
            error_msg: req.flash('error_msg'),
        });
    } catch (err) {
        console.error("Error loading settings page:", err);
        req.flash('error_msg', "Error loading settings data.");
        res.redirect('/dashboard');
    }
};

const updateProfile = async (req, res) => {
    try {
        if (!req.session.userId) {
            req.flash('error_msg', "Please log in first.");
            return res.redirect('/login');
        }

        const user = await Users.findById(req.session.userId);
        if (!user) {
            req.flash('error_msg', "User not found.");
            return res.redirect('/login');
        }

        const { email, matric, phone, age, password, confirmPassword } = req.body;
        const file = req.file;

        // Validate password match
        if (password && password !== confirmPassword) {
            req.flash('error_msg', "Passwords do not match.");
            return res.redirect('/settings');
        }

        // Update user fields
        if (email) user.email = email;
        if (matric) user.matric = matric;
        if (phone) user.phone = phone;
        if (age) user.age = age;
        if (file) user.profilePicture = file.filename; // Update profile picture
        if (password) user.password = await bcrypt.hash(password, 10); // Hash new password

        await user.save();

        req.flash('message', "Profile updated successfully!");
        res.redirect('/settings');
    } catch (err) {
        console.error("Error updating profile:", err);
        req.flash('error_msg', "An error occurred. Please try again.");
        res.redirect('/settings');
    }
};

const logout = (req, res) => {
    if (!req.session.userId) { // Check if the user is logged in
        req.flash('error_msg', "Please log in to access our platform.");
        res.redirect('/login');
    } else {
        req.session.destroy((err) => { // Destroy the session
            if (err) {
                console.error("Error destroying session:", err);
                req.flash('error_msg', "An error occurred during logout.");
                return res.redirect('/dashboard');
            }
            res.redirect('/login'); // Redirect to the login page
        });
    }
};

module.exports = {
    landingPage,
    features,
    usersignup,
    usersignupPost,
    verifyEmailPage,
    verifyEmailPost,
    loginPage,
    loginPost,
    dashboardPage,
    updateWalletBalance,
    applyAidPage,
    submitAid,
    disbursementsPage,
    settingsPage,
    updateProfile,
    logout,
    upload,
};