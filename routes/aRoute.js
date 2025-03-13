const express = require('express');
const router = express.Router();

const{adminSignup, adminSignupPage, adminLogin, adminLoginPage, adminLogout, approveApplication, viewApplicationsPage, admindashboardPage, fetchFilteredChartData, fetchFilteredRecentApplications, fetchFilteredStats} = require('../controllers/adminController');

router.get('/signup', adminSignupPage);
router.post('/signup', adminSignup);
router.get('/login', adminLoginPage);
router.post('/login', adminLogin);
router.get('/logout', adminLogout);

router.get('/applications', viewApplicationsPage);
router.post('/approve-application', approveApplication);
router.get('/dashboard', admindashboardPage);

router.get('/filter-data', async (req, res) => {
    const { period } = req.query;

    try {
        // Fetch filtered data based on the selected period
        const stats = await fetchFilteredStats(period);
        const chartData = await fetchFilteredChartData(period);
        const recentApplications = await fetchFilteredRecentApplications(period);

        res.json({ stats, chartData, recentApplications });
    } catch (err) {
        console.error("Error filtering data:", err);
        res.status(500).json({ error: "An error occurred while filtering data." });
    }
});
// router.post('/disburse-funds', disburseFunds);

module.exports = router;