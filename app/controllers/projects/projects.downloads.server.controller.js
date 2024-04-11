'use strict';

/**
 * Module dependencies.
 */
const mongoose = require('mongoose'),
	Audition = mongoose.model('Audition'),
	fs = require('fs'),
	_ = require('lodash'),
	async = require('async'),
	archiver = require('archiver');


exports.downloadAllAuditionsClient = function(req, res, next){

    Audition.find({'project': Object(req.body.project._id),'published':{ "$in": ["true",true] }}).sort('-created').then(function (auditionsFiles) {
        
        var i = 0,
            audFileCnt = auditionsFiles.length,
            fileLoc = '';
        // get app dir
        var appDir = global.appRoot;
        var relativePath =  'res' + '/' + 'auditions' + '/' + req.body.project._id + '/';
        var newPath = appDir + '/public/' + relativePath;
        var savePath = appDir + '/public/' + 'res' + '/' + 'archives' + '/';
        var zipName = req.body.project.title.replace('/','-') + '.zip';
        var newZip = savePath + zipName;

        // check for existing parent directory, create if needed
        if (!fs.existsSync(savePath)) {
            fs.mkdirSync(savePath);
        }

        var output = fs.createWriteStream(newZip);
        var archive = archiver('zip');

        output.on('close', function() {
            res.jsonp({zip:zipName});
        });

        for(i = 0; i < audFileCnt; i++){
            fileLoc = newPath + auditionsFiles[i].file.name;
            archive.file(fileLoc, { name:auditionsFiles[i].file.name });
        }

        archive.pipe(output);

        archive.finalize();

    }).catch(function (err) {
        res.status(500).end();
    });
    
};


exports.downloadAllAuditions = function(req, res, next){
    // get app dir
    var appDir = global.appRoot;
    var relativePath =  'res' + '/' + 'auditions' + '/' + req.body.project._id + '/';
    var newPath = appDir + '/public/' + relativePath;
    var savePath = appDir + '/public/' + 'res' + '/' + 'archives' + '/';
    var zipName = req.body.project.title.replace('/','-') + '.zip';
    var newZip = savePath + zipName;

    // check for existing parent directory, create if needed
    if (!fs.existsSync(savePath)) {
        fs.mkdirSync(savePath);
    }

    var output = fs.createWriteStream(newZip);
    var archive = archiver('zip');

    output.on('close', function() {
        res.jsonp({zip:zipName});
    });

    archive.directory(newPath, 'my-auditions');

    archive.pipe(output);

    archive.finalize();

    //    res.setHeader('Content-Type', 'application/zip');
    // res.setHeader('content-disposition', 'attachment; filename="auditions.zip"');
    //    return archive.pipe(res);

};

exports.downloadBookedAuditions = function(req, res, next){

    // method vars
    var projectId = req.body.projectId;
    var projectTitle = req.body.projectTitle.replace('/','-');
    var bookedAuds = req.body.bookedAuds;

    // get app dir
    var appDir = global.appRoot;
    var relativePath =  'res' + '/' + 'auditions' + '/' + projectId + '/';
    var newPath = appDir + '/public/' + relativePath;
    var savePath = appDir + '/public/' + 'res' + '/' + 'archives' + '/';
    var zipName = projectTitle + '.zip';
    var newZip = savePath + zipName;

    // check for existing parent directory, create if needed
    if (!fs.existsSync(savePath)) {
        fs.mkdirSync(savePath);
    }

    var output = fs.createWriteStream(newZip);
    var archive = archiver('zip');

    output.on('close', function() {
        res.jsonp({zip:zipName});
    });

    // add all booked auditions
    async.eachSeries(bookedAuds, function (audition, next) {

        if (fs.existsSync(newPath + audition)) {
            archive.file(newPath + audition, { name:audition });
        }

        next();

    }, function done(err) {

        archive.pipe(output);
        archive.finalize();

    });

};


exports.downloadSelectedAuditions = function(req, res, next){

    // method vars
    var projectId = req.body.projectId;
    var projectTitle = req.body.projectTitle.replace('/','-');
    var selAuds = req.body.selectedAuds;

    // get app dir
    var appDir = global.appRoot;
    var relativePath =  'res' + '/' + 'auditions' + '/' + projectId + '/';
    var newPath = appDir + '/public/' + relativePath;
    var savePath = appDir + '/public/' + 'res' + '/' + 'archives' + '/';
    var zipName = projectTitle + '.zip';
    var newZip = savePath + zipName;

    // check for existing parent directory, create if needed
    if (!fs.existsSync(savePath)) {
        fs.mkdirSync(savePath);
    }

    var output = fs.createWriteStream(newZip);
    var archive = archiver('zip');

    output.on('close', function() {
        res.jsonp({zip:zipName});
    });

    // add all booked auditions
    async.eachSeries(selAuds, function (audition, next) {

        if (fs.existsSync(newPath + audition)) {
            archive.file(newPath + audition, { name:audition });
        }
        next();

    }, function (err) {

        archive.pipe(output);
        archive.finalize();

    });

};
