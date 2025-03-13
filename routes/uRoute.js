const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/authMiddleware');

const{landingPage, features, usersignup, usersignupPost, upload, verifyEmailPage, verifyEmailPost, loginPage, loginPost, dashboardPage, updateWalletBalance, applyAidPage, submitAid, disbursementsPage, settingsPage, updateProfile, logout} = require('../controllers/userController');

router.get('/', landingPage);
router.get('/features', features);
router.get('/signup', usersignup);
router.post('/signup', upload.single('image'), usersignupPost);
router.get('/verify-email', verifyEmailPage);
router.post('/verify-email', verifyEmailPost);
router.get('/login', loginPage);
router.post('/login', loginPost);
router.get('/dashboard', ensureAuthenticated, dashboardPage);
router.get('/disbursements', ensureAuthenticated, disbursementsPage);
router.get('/settings', ensureAuthenticated, settingsPage);
router.post('/update-profile', ensureAuthenticated, upload.single('profilePicture'), updateProfile);
router.get('/logout', logout);

// New route for updating wallet balance
router.post('/update-wallet', updateWalletBalance);
router.get('/apply-aid', applyAidPage);
router.post('/submit-aid', upload.array('documents'), submitAid);


module.exports = router;