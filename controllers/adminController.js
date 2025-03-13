const Admin = require('../models/admin');
const Users = require('../models/user');
const bcrypt = require('bcryptjs');

const adminSignupPage = (req, res) => {
    res.render('admin-signup', {
        errors: [],
        message: '',
        error_msg: '',
        fn: '',
        ln: '',
        email: '',
        role: '',
    });
};

const adminSignup = async (req, res) => {
    const { fn, ln, email, role, password, confirmPassword } = req.body;
    let errors = [];

    // Validate inputs
    if (!fn || !ln || !email || !role || !password || !confirmPassword) {
        errors.push({ msg: "Please fill in all fields." });
    }

    if (password !== confirmPassword) {
        errors.push({ msg: "Passwords do not match." });
    }

    if (password.length < 6) {
        errors.push({ msg: "Password must be at least 6 characters." });
    }

    if (errors.length > 0) {
        return res.render('admin-signup', {
            errors,
            message: '',
            error_msg: '',
            fn,
            ln,
            email,
            role,
        });
    }

    try {
        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            errors.push({ msg: "Email is already registered." });
            return res.render('admin-signup', {
                errors,
                message: '',
                error_msg: '',
                fn,
                ln,
                email,
                role,
            });
        }

        // Create new admin
        const newAdmin = new Admin({
            fn,
            ln,
            email,
            role,
            password,
        });

        await newAdmin.save();

        // Notify admin
        req.flash('message', "Admin account created successfully! Please log in.");
        res.redirect('/admin/login');
    } catch (err) {
        console.error("Error during admin signup:", err);
        req.flash('error_msg', "An error occurred. Please try again.");
        res.redirect('/admin/signup');
    }
};

// Admin login page
const adminLoginPage = (req, res) => {
    res.render('admin-login', {
        errors: [],
        message: '',
        error_msg: '',
        email: '',
    });
};

// Admin login
const adminLogin = async (req, res) => {
    const { email, password } = req.body;
    let errors = [];

    // Validate inputs
    if (!email || !password) {
        errors.push({ msg: "Please fill in all fields." });
    }

    if (errors.length > 0) {
        return res.render('admin-login', {
            errors,
            message: '',
            error_msg: '',
            email,
        });
    }

    try {
        // Check if admin exists
        const admin = await Admin.findOne({ email });
        if (!admin) {
            errors.push({ msg: "Email not registered." });
            return res.render('admin-login', {
                errors,
                message: '',
                error_msg: '',
                email,
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            errors.push({ msg: "Incorrect password." });
            return res.render('admin-login', {
                errors,
                message: '',
                error_msg: '',
                email,
            });
        }

        // Set session data
        req.session.adminId = admin._id;
        req.session.admin = {
            id: admin._id,
            name: `${admin.fn} ${admin.ln}`,
            email: admin.email,
            role: admin.role,
        };

        // Redirect to admin dashboard
        req.flash('message', "Login successful!");
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error("Error during admin login:", err);
        req.flash('error_msg', "An error occurred. Please try again.");
        res.redirect('/admin/login');
    }
};

const viewApplicationsPage = async (req, res) => {
    try {
        if (!req.session.adminId) {
            req.flash('error_msg', "Please log in first.");
            return res.redirect('/admin/login');
        }

        // Find the admin
        const admin = await Admin.findById(req.session.adminId);
        if (!admin) {
            req.flash('error_msg', "Admin not found.");
            return res.redirect('/admin/login');
        }

        // Fetch applications that are pending for the current admin's role
        const pendingApplications = await Users.aggregate([
            { $unwind: "$applications" },
            { 
                $match: { 
                    "applications.approvals": {
                        $elemMatch: { 
                            role: admin.role, 
                            status: "Pending" 
                        }
                    }
                }
            },
            { $project: { 
                aidType: "$applications.aidType",
                amount: "$applications.amount",
                user: { name: { $concat: ["$fn", " ", "$ln"] }, email: "$email" },
                _id: "$applications._id"
            }}
        ]);

        // Render the view-applications page
        res.render('view-applications', {
            admin: {
                name: `${admin.fn} ${admin.ln}`,
                profilePicture: admin.profilePicture || '/default-avatar.png',
                notifications: admin.notifications || [],
                role: admin.role,
            },
            pendingApplications, // Pass pending applications to the template
            message: req.flash('message'),
            error_msg: req.flash('error_msg'),
        });
    } catch (err) {
        console.error("Error loading applications page:", err);
        req.flash('error_msg', "Error loading applications data.");
        res.redirect('/admin/dashboard');
    }
};

const admindashboardPage = async (req, res) => {
    try {
        if (!req.session.adminId) {
            req.flash('error_msg', "Please log in first.");
            return res.redirect('/admin/login');
        }

        // Find the admin
        const admin = await Admin.findById(req.session.adminId);
        if (!admin) {
            req.flash('error_msg', "Admin not found.");
            return res.redirect('/admin/login');
        }

                // Fetch stats for the cards
                const totalApplications = await Users.aggregate([
                    { $unwind: "$applications" },
                    { $count: "totalApplications" }
                ]);
        
                const pendingReview = await Users.aggregate([
                    { $unwind: "$applications" },
                    { $match: { "applications.status": "Pending" } },
                    { $count: "pendingReview" }
                ]);
        
                const totalAidDisbursed = await Users.aggregate([
                    { $unwind: "$applications" },
                    { $match: { "applications.status": "Completed" } },
                    { $group: { _id: null, totalAidDisbursed: { $sum: "$applications.amount" } } }
                ]);
        
                const activeStudents = await Users.countDocuments({}); // Count all users (or filter by active status if applicable)

                // Fetch applications over time (grouped by month)
                const applicationsOverTime = await Users.aggregate([
                    { $unwind: "$applications" },
                    {
                        $group: {
                            _id: { $month: "$applications.dateApplied" },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } } // Sort by month
                ]);

                // Format the data for the chart
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const chartData = months.map((month, index) => {
                    const monthData = applicationsOverTime.find(data => data._id === index + 1);
                    return {
                        month,
                        count: monthData ? monthData.count : 0
                    };
                });

                // Fetch recent applications
        const recentApplications = await Users.aggregate([
            { $unwind: "$applications" },
            { $sort: { "applications.dateApplied": -1 } }, // Sort by most recent
            { $limit: 5 }, // Limit to 5 recent applications
            {
                $project: {
                    studentName: { $concat: ["$fn", " ", "$ln"] },
                    aidType: "$applications.aidType",
                    amount: "$applications.amount",
                    date: "$applications.dateApplied",
                    status: "$applications.status"
                }
            }
        ]);

        // Fetch aid distribution data
        const aidDistribution = await Users.aggregate([
            { $unwind: "$applications" },
            {
                $group: {
                    _id: "$applications.aidType",
                    totalAmount: { $sum: "$applications.amount" }
                }
            }
        ]);

        // Format the data for the pie chart
        const pieChartData = {
            tuition: aidDistribution.find(data => data._id === "Tuition Fee Aid")?.totalAmount || 0,
            living: aidDistribution.find(data => data._id === "Living Expenses")?.totalAmount || 0,
            books: aidDistribution.find(data => data._id === "Books")?.totalAmount || 0,
            other: aidDistribution.find(data => data._id === "Other")?.totalAmount || 0,
        };

        // Calculate percentages
        const totalAid = Object.values(pieChartData).reduce((sum, amount) => sum + amount, 0);
        const pieChartPercentages = {
            tuition: ((pieChartData.tuition / totalAid) * 100).toFixed(2),
            living: ((pieChartData.living / totalAid) * 100).toFixed(2),
            books: ((pieChartData.books / totalAid) * 100).toFixed(2),
            other: ((pieChartData.other / totalAid) * 100).toFixed(2),
        };

        // Ensure notifications array exists
        if (!admin.notifications) {
            admin.notifications = []; // Initialize if it doesn't exist
        }

        // Fetch applications that are pending for the current admin's role
        const pendingApplications = await Users.aggregate([
            { $unwind: "$applications" },
            { 
                $match: { 
                    "applications.approvals": {
                        $elemMatch: { 
                            role: admin.role, 
                            status: "Pending" 
                        }
                    }
                }
            },
            { $project: { 
                "aidType": "$applications.aidType",
                "amount": "$applications.amount",
                "user": { name: "$fn", email: "$email" },
                "_id": "$applications._id"
            }}
        ]);

        // Format today's date
        const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
        const todayDate = new Date().toLocaleDateString('en-US', dateOptions);

        // Render the dashboard with admin and pending applications
        res.render('admin-dashboard1', {
            admin: {
                name: `${admin.fn} ${admin.ln}`,
                profilePicture: admin.profilePicture || '/default-avatar.png',
                notifications: admin.notifications,
                role: admin.role,
            },
            pendingApplications, // Pass filtered applications to the template
            todayDate,
            stats: {
                totalApplications: totalApplications[0]?.totalApplications || 0,
                pendingReview: pendingReview[0]?.pendingReview || 0,
                totalAidDisbursed: totalAidDisbursed[0]?.totalAidDisbursed || 0,
                activeStudents: activeStudents || 0,
            },
            chartData,
            recentApplications,
            pieChartPercentages,
            message: req.flash('message'),
            error_msg: req.flash('error_msg'),
        });
    } catch (err) {
        console.error("Error loading dashboard:", err);
        req.flash('error_msg', "Error loading dashboard data");
        return res.redirect('/admin/login');
    }
};

// Admin logout
const adminLogout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Error during logout:", err);
            return res.redirect('/admin/dashboard');
        }
        res.redirect('/admin/login');
    });
};

const approveApplication = async (req, res) => {
    const { applicationId, comments, action } = req.body; // action can be 'approve' or 'reject'
    const adminId = req.session.adminId;

    try {
        // Find the admin
        const admin = await Admin.findById(adminId);
        if (!admin) {
            req.flash('error_msg', "Admin not found.");
            return res.redirect('/admin/dashboard');
        }

        // Find the user with the application
        const user = await Users.findOne({ 'applications._id': applicationId });
        if (!user) {
            req.flash('error_msg', "User not found.");
            return res.redirect('/admin/dashboard');
        }

        // Find the application
        const application = user.applications.id(applicationId);
        if (!application) {
            req.flash('error_msg', "Application not found.");
            return res.redirect('/admin/dashboard');
        }

        // Find the approval for the current role
        const approval = application.approvals.find(app => app.role === admin.role);
        if (!approval) {
            req.flash('error_msg', "Approval not found.");
            return res.redirect('/admin/dashboard');
        }

        // Update the approval status based on the action
        if (action === 'approve') {
            approval.status = 'Approved';
            approval.comments = comments;
            approval.date = new Date();

            // Add status update for approval
            application.statusUpdates.push({
                message: `${admin.role} Approved → Moving to ${getNextRole(admin.role)}`,
                date: new Date(),
            });

            // If approved, move to the next level
            const nextRole = getNextRole(admin.role);
            if (nextRole) {
                application.approvals.push({
                    role: nextRole,
                    status: 'Pending',
                    date: new Date(),
                });

                // Notify the next admin
                const nextAdmin = await Admin.findOne({ role: nextRole });
                if (nextAdmin) {
                    nextAdmin.notifications.push({
                        message: `New financial aid application requires your approval (submitted by ${user.fn} ${user.ln}).`,
                        date: new Date(),
                    });
                    await nextAdmin.save();
                }
            }
        } else if (action === 'reject') {
            approval.status = 'Rejected';
            approval.comments = comments;
            approval.date = new Date();

            // Add status update for rejection
            application.statusUpdates.push({
                message: `Rejected by ${admin.role} - Reason: ${comments}`,
                date: new Date(),
            });

            // Set the removedAt field to 30 minutes from now
            application.removedAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes later

            // Update the application status to 'Rejected'
            application.status = 'Rejected';

            // Notify the user
            req.flash('message', `Application rejected by ${admin.role}.`);
        }

        await user.save();

        // Notify the user
        if (action === 'approve') {
            req.flash('message', `Application approved by ${admin.role}.`);
        }

        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error("Error processing application:", err);
        req.flash('error_msg', "An error occurred. Please try again.");
        res.redirect('/admin/dashboard');
    }
};

const getNextRole = (currentRole) => {
    const roles = ['Course Advisor', 'HOD', 'VC', 'Bursary', 'Super Admin'];
    const currentIndex = roles.indexOf(currentRole);
    return roles[currentIndex + 1]; // Returns the next role or undefined if no more roles
};

// Disburse funds (Super Admin)
const disburseFunds = async (req, res) => {
    const { applicationId } = req.body;
    const adminId = req.session.adminId;

    try {
        // Find the admin
        const admin = await Admin.findById(adminId);
        if (!admin) {
            req.flash('error_msg', "Admin not found.");
            return res.redirect('/admin/dashboard');
        }

        // Ensure the admin is a Super Admin
        if (admin.role !== 'Super Admin') {
            req.flash('error_msg', "You do not have permission to disburse funds.");
            return res.redirect('/admin/dashboard');
        }

        // Find the user with the application
        const user = await Users.findOne({ 'applications._id': applicationId });
        if (!user) {
            req.flash('error_msg', "User not found.");
            return res.redirect('/admin/dashboard');
        }

        // Find the application
        const application = user.applications.id(applicationId);
        if (!application) {
            req.flash('error_msg', "Application not found.");
            return res.redirect('/admin/dashboard');
        }

        // Check if all approvals are granted
        const allApproved = application.approvals.every(app => app.status === 'Approved');
        if (!allApproved) {
            req.flash('error_msg', "Not all approvals have been granted.");
            return res.redirect('/admin/dashboard');
        }

        // Disburse the funds
        user.walletBalance += application.amount;
        application.status = 'Completed'; // Mark the application as completed

        // Remove the application from the user's applications array
        user.applications = user.applications.filter(app => app._id.toString() !== applicationId);

        await user.save();

        // Notify the user
        req.flash('message', "Your application has been approved, and funds have been disbursed.");
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error("Error disbursing funds:", err);
        req.flash('error_msg', "An error occurred. Please try again.");
        res.redirect('/admin/dashboard');
    }
};

const fetchFilteredStats = async (period) => {
    const now = new Date();
    let startDate;

    switch (period) {
        case 'week':
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
        case 'month':
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
        case 'quarter':
            startDate = new Date(now.setMonth(now.getMonth() - 3));
            break;
        case 'year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
        default:
            startDate = new Date(0); // All time
    }

    // Fetch total applications
    const totalApplications = await Users.aggregate([
        { $unwind: "$applications" },
        { $match: { "applications.dateApplied": { $gte: startDate } } },
        { $count: "totalApplications" }
    ]);

    // Fetch pending review
    const pendingReview = await Users.aggregate([
        { $unwind: "$applications" },
        { $match: { "applications.dateApplied": { $gte: startDate }, "applications.status": "Pending" } },
        { $count: "pendingReview" }
    ]);

    // Fetch total aid disbursed
    const totalAidDisbursed = await Users.aggregate([
        { $unwind: "$applications" },
        { $match: { "applications.dateApplied": { $gte: startDate }, "applications.status": "Completed" } },
        { $group: { _id: null, totalAidDisbursed: { $sum: "$applications.amount" } } }
    ]);

    // Fetch active students
    const activeStudents = await Users.countDocuments({}); // Or filter by active status if applicable

    return {
        totalApplications: totalApplications[0]?.totalApplications || 0,
        pendingReview: pendingReview[0]?.pendingReview || 0,
        totalAidDisbursed: totalAidDisbursed[0]?.totalAidDisbursed || 0,
        activeStudents: activeStudents || 0,
    };
};

const fetchFilteredChartData = async (period) => {
    const now = new Date();
    let startDate;

    switch (period) {
        case 'week':
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
        case 'month':
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
        case 'quarter':
            startDate = new Date(now.setMonth(now.getMonth() - 3));
            break;
        case 'year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
        default:
            startDate = new Date(0); // All time
    }

    // Fetch applications over time (grouped by month)
    const applicationsOverTime = await Users.aggregate([
        { $unwind: "$applications" },
        { $match: { "applications.dateApplied": { $gte: startDate } } },
        {
            $group: {
                _id: { $month: "$applications.dateApplied" },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } } // Sort by month
    ]);

    // Format the data for the chart
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const chartData = months.map((month, index) => {
        const monthData = applicationsOverTime.find(data => data._id === index + 1);
        return {
            month,
            count: monthData ? monthData.count : 0
        };
    });

    return chartData;
};

const fetchFilteredRecentApplications = async (period) => {
    const now = new Date();
    let startDate;

    switch (period) {
        case 'week':
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
        case 'month':
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
        case 'quarter':
            startDate = new Date(now.setMonth(now.getMonth() - 3));
            break;
        case 'year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
        default:
            startDate = new Date(0); // All time
    }

    // Fetch recent applications
    const recentApplications = await Users.aggregate([
        { $unwind: "$applications" },
        { $match: { "applications.dateApplied": { $gte: startDate } } },
        { $sort: { "applications.dateApplied": -1 } }, // Sort by most recent
        { $limit: 5 }, // Limit to 5 recent applications
        {
            $project: {
                studentName: { $concat: ["$fn", " ", "$ln"] },
                aidType: "$applications.aidType",
                amount: "$applications.amount",
                date: "$applications.dateApplied",
                status: "$applications.status"
            }
        }
    ]);

    return recentApplications;
};


module.exports = {
    adminSignupPage,
    adminSignup,
    adminLoginPage,
    adminLogin,
    adminLogout,
    admindashboardPage,
    viewApplicationsPage,
    approveApplication,
    getNextRole,
    disburseFunds,
    fetchFilteredStats,
    fetchFilteredChartData,
    fetchFilteredRecentApplications,
};