const fs = require('fs');
const path = require('path');

const cert = path.join(__dirname,'mycert.pem');
const key = path.join(__dirname,'mykey.pem');;

const options={
	key:fs.readFileSync(key),
	cert:fs.readFileSync(cert)
}

module.exports = options;