const express = require('express');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const ethereumMiddleware = require('./middleware/ethereumMiddleware');
const path = require('path');

require('dotenv').config();


const app = express()
app.use(express.static("public"));
app.use('/uploads', express.static(path.join(__dirname, 'controllers/uploads')));


app.use(express.urlencoded({extended: true}));
app.set('view engine', 'ejs');
mongoose.connect(process.env.MONGO_URI).then(()=> {
    console.log('Database connected');
})

//EXPRESS SESSION MIDDLEWARE
app.use(session({
    secret: 'mysecretval',
    resave: true,
    saveUninitialized: true
}))


//CONNECT FLASH TO HANDLE OUR MESSAGES
app.use(flash());
app.use((req, res, next)=> {
    res.locals.message = req.flash('message');
    res.locals.error_msg = req.flash('error_msg');

    next();
})


//WE IMPORT THE ROUTE FILES

app.use('/', require('./routes/uRoute'));
app.use('/admin', require('./routes/aRoute'))

// Use Ethereum middleware globally
app.use(ethereumMiddleware);

app.listen(5600, ()=> console.log("Server Started on port 5600"))
