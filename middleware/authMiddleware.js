module.exports.ensureAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    req.flash('error_msg', "Please log in first.");
    res.redirect('/login');
};