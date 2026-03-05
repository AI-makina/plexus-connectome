const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync(process.argv[2]);

pdf(dataBuffer).then(function (data) {
    console.log(data.text);
}).catch(e => console.error(e));
