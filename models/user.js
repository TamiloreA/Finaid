const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fn: {
        type: String,
        required: true,
    },
    ln: {
        type: String,
        required: true,
    },
    age: {
        type: Number,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    matric : {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    profilePicture: {
        type: String,
        required: true,
    },
    verificationCode: {
        type: String,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    walletBalance: {
        type: Number,
        default: 0, // Default wallet balance
    },
    pendingDisbursement: {
        type: Number,
        default: 0, // Default pending disbursement
    },
    documentsRequired: {
        type: Number,
        default: 0, // Default documents required
    },
    recentDisbursements: [{
        name: String,
        amount: Number,
        date: Date,
    }],
    aidProgress: {
        fafsaCompletion: Number,
        documentSubmission: Number,
        sapRequirements: Number,
    },
    importantDates: [{
        date: Date,
        description: String,
    }],
    applications: [{
        aidType: { type: String, required: true },
        amount: { type: Number, required: true },
        reason: { type: String, required: true },
        documents: [{ type: String }],
        status: { type: String, default: 'Pending' }, // Pending, Approved, Rejected, Completed
        dateApplied: { type: Date, default: Date.now },
        approvals: [{
            role: { type: String, required: true },
            status: { type: String, default: 'Pending' }, // Pending, Approved, Rejected
            date: { type: Date, default: Date.now },
            comments: String,
        }],
        statusUpdates: [{
            message: String,
            date: { type: Date, default: Date.now },
        }],
        removedAt: { type: Date }, // Track when the application should be removed from Aid Progress
    }],
    dateRegistered: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Users', userSchema);