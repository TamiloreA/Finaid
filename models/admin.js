const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
    fn: {
        type: String,
        required: true,
    },
    ln: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['Course Advisor', 'HOD', 'VC', 'Bursary', 'Super Admin'],
        required: true,
    },
    notifications: [{
        message: String,
        date: { type: Date, default: Date.now },
        read: { type: Boolean, default: false },
    }],
    dateRegistered: {
        type: Date,
        default: Date.now,
    },
});

// Hash password before saving
adminSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

module.exports = mongoose.model('Admin', adminSchema);