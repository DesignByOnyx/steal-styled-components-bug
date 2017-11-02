const path = require('path');
const express = require('express');

express()
.use('/package.json', (req, res, next) => {
	const file = path.join(__dirname, '../package.json');
	res.sendFile(file);
}).use('/node_modules', (req, res, next) => {
	const file = path.join(__dirname, '../node_modules', req.url);
	res.sendFile(file);
}).use('/public', (req, res, next) => {
	const file = path.join(__dirname, '../public', req.url);
	res.sendFile(file);
}).use('/dist', (req, res, next) => {
	const file = path.join(__dirname, '../dist', req.url);
	res.sendFile(file);
}).use((req, res, next) => {
	const file = path.join(__dirname, '../public', req.url);
	res.sendFile(file);
}).listen(8080, function(){
    console.log('Server running on 8080...');
});
