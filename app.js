const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const debug = require('debug')('poker:app')
const random = require('./modules/random');
const record = require('./modules/record');
const session = require('express-session')({
    secret: 'zxcvfdsaqwer', //secret的值建议使用随机字符串
    resave: false,
    saveUninitialized: false,
    cookie: {
        //secure: true//for https 
        maxAge: 1000 * 60 * 10
    }
});

const index = require('./routes/index');
const con = require('./routes/connect');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
//app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session);
app.use(express.static(path.join(__dirname, 'public')));
//****render var
app.use((req,res,next)=>{
    res.locals.session = req.session;
    next()
})
//*******
app.use('/', index);
//***************test*********************
app.get('/test/sessionId',(req,res)=>{
    res.end(JSON.stringify(record.sessionId))
})
//****test
let disableSameDevice = process.env.device;
let logindev = process.env.logindev;
//certificate
app.use((req,res,next)=>{
    if(logindev=='yes'){
        debug('test: auto login')
        req.session.userName ='developer'
        next();
        return
    }
    if(req.session.userName)
            next();
    else
       res.redirect('/login')    
})
app.use((req, res, next) => {
    let asignId = ()=>{
        random(7, record.sessionId).then((id) => {
            req.session.userId = id;
            next()
        })
    }
    if(disableSameDevice=='yes'){
        console.log(req.session.userId)
        if (req.session.userId ) {
            // record.sessionId[req.session.userId] = {};
            next();
        } else {
            asignId()
        }
    } else{
        asignId()
    }
    
})
app.use('/', con);
// catch 404 and forward to error handler
app.use(function(req, res, next) {
    let err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

exports.app = app;
exports.session = session;