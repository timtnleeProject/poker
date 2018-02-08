var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
  res.render('index', { title: 'Hearts' });
});
router.get('/login', function(req, res, next) {
	if(req.session.userName)
		res.redirect('/lobby')
	else
  		res.render('login', { title: 'Hearts' });
})
//*********post***********
router.post('/login', (req,res)=>{
	req.session.userName = req.body.name;
	res.redirect('/lobby')
})
module.exports = router;
