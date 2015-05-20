'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
	errorHandler = require('./errors'),
	Talent = mongoose.model('Talent'),
	_ = require('lodash'),
	config = require('../../config/config'),
	async = require('async'),
	nodemailer = require('nodemailer'),
	dateFormat = require('dateformat'),
	now = new Date();

/**
 * Create a Talent
 */
exports.create = function(req, res) {
	var talent = new Talent(req.body);
	talent.user = req.user;

	var allowedRoles = ['admin','producer/auditions director','talent director'];

	if (_.intersection(req.user.roles, allowedRoles).length) {
		//console.log(talent);
		talent.save(function(err) {
			if (err) {
				return res.status(400).send({
					message: errorHandler.getErrorMessage(err)
				});
			} else {

			// send out new talent email
			async.waterfall([
				function(done) {
					var i;
					//generate talent report
					var talentData = '<p><strong>First Name</strong> ' + talent.name + '</p>';
					talentData += '<p><strong>Last Name</strong> ' + talent.lastName + '</p>';
					talentData += '<p><strong>Parent Name</strong> ' + talent.parentName + '</p>';
					talentData += '<p><strong>Gender</strong> ' + talent.gender + ' ' + talent.ageRange + '</p>';
					talentData += '<p><strong>Email</strong> ' + talent.email + '</p>';
					talentData += '<p><strong>Email Alt</strong> ' + talent.email2 + '</p>';
					talentData += '<p><strong>Phone Number</strong> ' + talent.phone + '</p>';
					talentData += '<p><strong>Phone Number Alt</strong> ' + talent.phone2 + '</p>';
					talentData += '<p><strong>Type</strong>';
					for(i = 0; i < talent.type.length; ++i){
						talentData += talent.type[i] + ' ';
					}
					talentData += '</p>';
					talentData += '<p><strong>Union Status</strong> ';
					for(i = 0; i < talent.unionStatus.length; ++i){
						talentData += talent.unionStatus[i] + ' ';
					}
					talentData += '<br>';
					for(i = 0; i < talent.unionJoined.length; ++i){
						talentData += talent.unionJoined[i] + ' ';
					}
					talentData += '</p>';
					talentData += '<p><strong>Last Name Code</strong> ' + talent.lastNameCode + '</p>';
					talentData += '<p><strong>Outage Times</strong> ' + talent.outageTimes + '</p>';
					talentData += '<p><strong>Location/ISDN</strong> ' + talent.locationISDN + '</p>';
					talentData += '<p><strong>Exclusivity</strong> ' + talent.exclusivity + '</p>';
					talentData += '<p><strong>ISDN Line 1</strong> ' + talent.ISDNLine1 + '</p>';
					talentData += '<p><strong>ISDN Line 2</strong> ' + talent.ISDNLine2 + '</p>';
					talentData += '<p><strong>Source Connect Username</strong> ' + talent.sourceConnectUsername + '</p>';
					talentData += '<p><strong>Producer</strong> ' + talent.producerOptional + '</p>';
					talentData += '<p><strong>Typecasts</strong>';
					for(i = 0; i < talent.typeCasts.length; ++i){
						talentData += talent.typeCasts[i] + ' ';
					}
					talentData += '</p>';

					done('', talentData);
				},
				// generate Dave's email
				function(talentData, done) {

					// generate email signature
					var emailSig = '';
					if(req.user.emailSignature){
						emailSig = req.user.emailSignature.replace(/\r?\n/g, '<br>');
					} else {
						emailSig = '';
					}

					res.render('templates/talents/new-talent-dave', {
						talentData: talentData,
						emailSignature: emailSig
					}, function(err, emailHTML) {
						done(err, emailHTML, talentData, emailSig);
					});
				},
				// send Dave an email
				function(emailHTML, talentData, emailSig, done) {

					var emailSubject = 'NEW TALENT ADDITION TO VO ROSTER:  ' + talent.name + ' ' + talent.lastName;

					// send email
					var transporter = nodemailer.createTransport(config.mailer.options);

					var mailOptions = {
										to: 'Dave@studiocenter.com',
										from: req.user.email || config.mailer.from,
										replyTo: req.user.email || config.mailer.from,
										subject: emailSubject,
										html: emailHTML
									};

					transporter.sendMail(mailOptions, function(err){
						done(err, talentData, emailSig );
					});

				},
				// generate Ken's email
				function(talentData, emailSig, done) {
					res.render('templates/talents/new-talent-ken', {
						talentData: talentData,
						emailSignature: emailSig
					}, function(err, emailHTML) {
						done(err, emailHTML, talentData, emailSig);
					});
				},
				// send Ken an email
				function(emailHTML, talentData, emailSig, done) {

					var emailSubject = 'NEW TALENT ADDITION TO VO ROSTER:  ' + talent.name + ' ' + talent.lastName;

					// send email
					var transporter = nodemailer.createTransport(config.mailer.options);

					var mailOptions = {
										to: 'Ken@studiocenter.com',
										from: req.user.email || config.mailer.from,
										replyTo: req.user.email || config.mailer.from,
										subject: emailSubject,
										html: emailHTML
									};

					transporter.sendMail(mailOptions, function(err){
						done(err, talentData, emailSig );
					});

				},
				// generate Kevin's email
				function(talentData, emailSig, done) {
					res.render('templates/talents/new-talent-kevin', {
						talentData: talent,
						emailSignature: emailSig
					}, function(err, emailHTML) {
						done(err, emailHTML, talentData, emailSig);
					});
				},
				// send Kevin an email
				function(emailHTML, talentData, emailSig, done) {

					var emailSubject = 'NEW TALENT ADDITION TO VO ROSTER:  ' + talent.name + ' ' + talent.lastName;

					// send email
					var transporter = nodemailer.createTransport(config.mailer.options);

					var mailOptions = {
										to: 'Kevin@studiocenter.com',
										from: req.user.email || config.mailer.from,
										replyTo: req.user.email || config.mailer.from,
										subject: emailSubject,
										html: emailHTML
									};

					transporter.sendMail(mailOptions, function(err){
						done(err);
					});

				},
				], function(err) {
				if (err) return console.log(err);
			});

				res.jsonp(talent);
			}
		});
	} else {
		return res.status(403).send('User is not authorized');
	}
};

/**
 * Show the current Talent
 */
exports.read = function(req, res) {
	res.jsonp(req.talent);
};

/**
 * Update a Talent
 */
exports.update = function(req, res) {
	var talent = req.talent ;

	talent = _.extend(talent , req.body);

	talent.save(function(err) {
		if (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else {
			res.jsonp(talent);
		}
	});
};

/**
 * Delete an Talent
 */
exports.delete = function(req, res) {
	var talent = req.talent;

	// send delete talent emails
	async.waterfall([
		// generate Dave's email
		function(done) {

			// generate email signature
			var emailSig = '';
			if(req.user.emailSignature){
				emailSig = req.user.emailSignature.replace(/\r?\n/g, '<br>');
			} else {
				emailSig = '';
			}

			res.render('templates/talents/delete-talent-dave', {
				talentData: talent,
				emailSignature: emailSig
			}, function(err, emailHTML) {
				done(err, emailHTML, emailSig);
			});
		},
		// send Dave an email
		function(emailHTML, emailSig, done) {

			var emailSubject = 'TALENT TERMINATED FROM VO ROSTER: ' + talent.name + ' ' + talent.lastName;

			// send email
			var transporter = nodemailer.createTransport(config.mailer.options);

			var mailOptions = {
								to: 'Dave@studiocenter.com',
								from: req.user.email || config.mailer.from,
								replyTo: req.user.email || config.mailer.from,
								subject: emailSubject,
								html: emailHTML
							};

			transporter.sendMail(mailOptions, function(err){
				done(err, emailSig);
			});

		},
		// generate Ken's email
		function(emailSig, done) {
			res.render('templates/talents/delete-talent-ken', {
				talentData: talent,
				emailSignature: emailSig
			}, function(err, emailHTML) {
				done(err, emailHTML);
			});
		},
		// send Ken an email
		function(emailHTML, done) {

			var emailSubject = 'TALENT TERMINATED FROM VO ROSTER: ' + talent.name + ' ' + talent.lastName;

			// send email
			var transporter = nodemailer.createTransport(config.mailer.options);

			var mailOptions = {
								to: 'Ken@studiocenter.com',
								from: req.user.email || config.mailer.from,
								replyTo: req.user.email || config.mailer.from,
								subject: emailSubject,
								html: emailHTML
							};

			transporter.sendMail(mailOptions, function(err){
				done(err);
			});

		},
		function(done) {
			talent.remove(function(err) {
				if (err) {
					done(err);
				} else {
					res.jsonp(talent);
					done(err);
				}
			});
		}
	], function(err) {
		if (err) return console.log(err);
	});

	
};

/**
 * List of Talents
 */
exports.list = function(req, res) { Talent.find().sort('-created').populate('user', 'displayName').exec(function(err, talents) {
		if (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else {
			res.jsonp(talents);
		}
	});
};

/**
 * Talent middleware
 */
exports.talentByID = function(req, res, next, id) { Talent.findById(id).populate('user', 'displayName').exec(function(err, talent) {
		if (err) return next(err);
		if (! talent) return next(new Error('Failed to load Talent ' + id));
		req.talent = talent ;
		next();
	});
};

/**
 * Talent authorization middleware
 */
exports.hasAuthorization = function(req, res, next) {
	var allowedRoles = ['admin','producer/auditions director','talent director'];

	if (!_.intersection(req.user.roles, allowedRoles).length) {
		return res.status(403).send('User is not authorized');
	}
	next();
};