'use strict';

/**
 * Module dependencies.
 */
const mongoose = require('mongoose'),
	errorHandler = require('../errors'),
	Project = mongoose.model('Project'),
	User = mongoose.model('User'),
	Talent = mongoose.model('Talent'),
	Log = mongoose.model('Log'),
	Newproject = mongoose.model('Newproject'),
	config = require('../../../config/config'),
	_ = require('lodash'),
	async = require('async'),
	nodemailer = require('nodemailer'),
	sgTransport = require('nodemailer-sendgrid-transport'),
	dateFormat = require('dateformat');

exports.sendEmail = function(req, res){

    // ensure email body is not blank
    if(typeof req.body.email !== 'undefined'){

        // gather admin and producers emails to include in send
        async.waterfall([
            function(done) {
                User.find({'roles':'admin','noemail':{ $ne: true }}).sort('-created').then(function (admins) {
                    done(null, admins);
                });
            },
            function(admins, done) {
                User.find({'roles':{ $in: ['producer/auditions director', 'auditions director', 'audio intern']},'noemail':{ $ne: true }}).sort('-created').then(function (directors) {
                    done(null, admins, directors);
                });
            },
            function(admins, directors, done) {
                User.find({'roles':'production coordinator','noemail':{ $ne: true }}).sort('-created').then(function (coordinators) {
                    done(null, admins, directors, coordinators);
                });
            },
            function(admins, directors, coordinators, done) {
                User.find({'roles':'talent director','noemail':{ $ne: true }}).sort('-created').then(function (talentdirectors) {
                    done(null, admins, directors, coordinators, talentdirectors);
                });
            },
            function(admins, directors, coordinators, talentdirectors, done) {
                var email = req.body.email;

                // add previously queried roles to email list
                var i, bcc = [];
                for(i = 0; i < admins.length; ++i){
                    bcc.push(admins[i].email);
                }
                for(i = 0; i < directors.length; ++i){
                    bcc.push(directors[i].email);
                }
                for(i = 0; i < coordinators.length; ++i){
                    bcc.push(coordinators[i].email);
                }
                for(i = 0; i < talentdirectors.length; ++i){
                    bcc.push(talentdirectors[i].email);
                }

                // // append default footer to email
                // email.message += '<br>' + 'The ' + config.app.title + ' Support Team' + '<br>';
                // email.message += '<br>' + 'To view your StudioCenterAuditions.com Home Page, visit:' + '<br>';
                // email.message += 'http://' + req.headers.host + '<br>';

                done('', email, bcc);
            },
            function(email, bcc, done) {
                res.render('templates/email-message', {
                    email: email
                }, function(err, emailHTML) {
                    done(err, emailHTML, email, bcc);
                });
            },
            function(emailHTML, email, bcc, done) {
                // send email
                var transporter = nodemailer.createTransport(sgTransport(config.mailer.options));
                var mailOptions = {
                    to: email.to,
                    cc: config.mailer.notifications,
                    bcc: bcc,
                    from: config.mailer.from,
                    subject: email.subject,
                    html: emailHTML
                };

                transporter.sendMail(mailOptions , function(err) {
                    done(err);
                });
            },
            ], function(err) {
                if (err) {
                    return res.status(400).json(err);
                } else {
                    res.status(200).jsonp();
                }
        });

    }
};

var emailTalent = function(selTalent, talentInfo, email, project, req, res, subjectAd){

    async.waterfall([
        function(done) {
            var ownerId = project.owner || project.user._id;
            User.findOne({'_id':ownerId}).sort('-created').then(function (owner) {
                owner = owner || req.user;
                done(null, owner);
            }).catch(function (err) {
                done(err, req.user);
            });
        },
        function(owner, done) {

            var emailTmpl = 'templates/projects/new-project-talent-email';
            // load language specific email templates
            if(talentInfo.prefLanguage === 'Spanish'){
                emailTmpl = 'templates/projects/new-project-talent-email-spanish';
            }

            var newDate = new Date(project.estimatedCompletionDate);
            newDate = newDate.setHours(newDate.getHours() - 1);
            newDate = dateFormat(newDate, 'dddd, mmmm dS, yyyy, h:MM TT');
            var part = '';

            // generate email signature
            var emailSig = '';
            if(owner.emailSignature){
                emailSig = owner.emailSignature;
            } else {
                emailSig = '';
            }

            // assign part text
            if(typeof selTalent.part !== 'undefined'){
                if(talentInfo.prefLanguage !== 'Spanish'){
                    if(selTalent.part !== ''){
                        part = '<p>You are cast for the part of ' + selTalent.part + '</p>';
                    }
                } else {
                    if(selTalent.part !== ''){
                        part = '<p>Usted está echado para el papel de ' + selTalent.part + '</p>';
                    }
                }
            }

            // add requested text if needed
            var requestedTxt = '';
            if(selTalent.requested === true){
                requestedTxt = 'REQUESTED ';
            }

            res.render(emailTmpl, {
                email: email,
                emailSignature: emailSig,
                dueDate: newDate,
                part: part,
                requestedTxt: requestedTxt
            }, function(err, talentEmailHTML) {
                done(err, talentEmailHTML, owner);
            });

        },
        // send out talent project creation email
        function(talentEmailHTML, owner, done) {
            // send email
            var transporter = nodemailer.createTransport(sgTransport(config.mailer.options)),
                emailSubject = '',
                newDate = new Date(project.estimatedCompletionDate),
                nameArr = [],
                talentEmails = [talentInfo.email];

            // set vars
            newDate = newDate.setHours(newDate.getHours() - 1);
            nameArr = talentInfo.name.split(' ');
            // add second email contact is available
            if(typeof talentInfo.email2 !== 'undefined'){
                talentEmails.push(talentInfo.email2);
            }

            // assign email subject line
            if(selTalent.requested === true){
                emailSubject = nameArr[0] + ' has a REQUESTED Audition - ' + project.title + ' - Due ' + dateFormat(newDate, 'dddd, mmmm dS, yyyy, h:MM TT') + ' EST';
            } else {
                emailSubject = nameArr[0] + ' has an Audition - ' + project.title + ' - Due ' + dateFormat(newDate, 'dddd, mmmm dS, yyyy, h:MM TT') + ' EST';
            }
            if(typeof subjectAd !== 'undefined'){
                emailSubject = 'NEW ' + subjectAd + ' FILE ' + emailSubject;
            }

            var mailOptions = {
                to: talentEmails,
                from: owner.email || config.mailer.from,
                replyTo: owner.email || config.mailer.from,
                subject: emailSubject,
                html: talentEmailHTML
            };

            transporter.sendMail(mailOptions, function(err){

                // write change to log
                var log = {
                    type: 'talent',
                    sharedKey: selTalent.talentId,
                    description: 'sent new project email to talent ' + selTalent.name + ' for ' + project.title,
                    user: req.user
                };
                log = new Log(log);
                log.save();

                done(err);
            });
        },
        ], function(err) {
        //return res.status(400).json(err);
    });

};

var sendTalentEmail = function(req, res, project, talent, override){

    async.waterfall([
        // gather info for selected talent
        function(done) {
            Talent.findOne({'_id':talent.talentId}).sort('-created').then(function (talentInfo) {
                done(null, talentInfo);
            }).catch(function (err) {
                done(err, null);
            });
        },
        // generate email body
        function(talentInfo, done) {
            var email =  {
                            projectId: '',
                            to: [],
                            bcc: [],
                            subject: '',
                            header: '',
                            footer: '',
                            scripts: '',
                            referenceFiles: ''
                        };
            if(talentInfo.type.toLowerCase() === 'email' || override === true){
                var i;

                // add scripts and assets to email body
                email.scripts = '\n' + '<strong>Scripts:</strong>' + '<br>';
                if(typeof project.scripts !== 'undefined'){
                    if(project.scripts.length > 0){
                        for(i = 0; i < project.scripts.length; ++i){
                            email.scripts += '<a href="http://' + req.headers.host + '/res/scripts/' + project._id + '/' + project.scripts[i].file.name + '">' + project.scripts[i].file.name + '</a><br>';
                        }
                    } else {
                        email.scripts += 'None';
                    }
                } else {
                    email.scripts += 'None';
                }
                email.referenceFiles = '\n' + '<strong>Reference Files:</strong>' + '<br>';
                if(typeof project.referenceFiles !== 'undefined'){
                    if(project.referenceFiles.length > 0){
                        for(var j = 0; j < project.referenceFiles.length; ++j){
                            email.referenceFiles += '<a href="http://' + req.headers.host + '/res/referenceFiles/' + project._id + '/' + project.referenceFiles[j].file.name + '">' + project.referenceFiles[j].file.name + '</a><br>';
                        }
                    } else {
                        email.referenceFiles += 'None';
                    }
                } else {
                    email.referenceFiles += 'None';
                }
            }

            done('', email, talentInfo);
        },
        // update talent email status
        function(email, talentInfo, done){

            // update talent email status
            for(var i = 0; i < project.talent.length; ++i){
                if(project.talent[i].talentId === talent.talentId){
                    if(talentInfo.type.toLowerCase() === 'email' || override === true){
                        project.talent[i].status = 'Emailed';
                    }
                    done('', email, talentInfo);
                }
            }

        },
        // email selected talent
        function(email, talentInfo, done){
            // only send email to talent if that is the preferred contact method
            if(talentInfo.type.toLowerCase() === 'email' || override === true){
                emailTalent(talent, talentInfo, email, project, req, res);
            }

            var newProject = project;

            // write change to log
            if(typeof project.log !== 'undefined'){
                var log = project.log;
                log.user = req.user;

                log = new Log(log);
                log.save();

                // also send log for project if talent log attribute
                if(log.type === 'talent'){
                    log = log.toObject();
                    delete log._id;

                    log.type = 'project';
                    log.sharedKey = String(project._id);

                    log = new Log(log);
                    log.save();
                }
            }

            Project.findById(project._id).then(function (project) {
                project.populate('user', 'displayName');

                project = _.extend(project, newProject);

                req.project = project;

                project.save().then(function () {
                    res.status(200).json(project);
                }).catch(function (err) {
                    done(err);
                });

            });


        }
        ], function(err) {
        if (err) {
            if (err) {
                return res.status(400).json(err);
            } else {
                return res.status(200);
            }
        }
    });

};

exports.sendTalentCanceledEmail = function(req, res){

    var project;
    var projectId = req.body.projectId;
    var talents = req.body.talents;
    var override = req.body.override || false;

    // reload project
    Project.findOne({'_id':projectId}).sort('-created').then(function (project) {

        // walk through and email all selected clients
        async.eachSeries(talents, function (selTalent, callback) {

            Talent.findOne({'_id':selTalent.talentId}).sort('-created').then(function (talentInfo) {

                // check for null talent return
                if(talentInfo !== null){

                    // filter based on current talent status
                    if((talentInfo.type.toLowerCase() === 'email' || override === true) && selTalent.status.toLowerCase() === 'emailed'){

                        async.waterfall([
                            // update talent email status
                            function(done){

                                // update talent email status
                                for(var i = 0; i < project.talent.length; ++i){
                                    if(project.talent[i].talentId === selTalent.talentId){

                                        project.talent[i].status = 'Canceled';

                                        done('');
                                    }
                                }

                            },
                            function(done) {
                                var ownerId = project.owner || project.user._id;
                                User.findOne({'_id':ownerId}).sort('-created').then(function (owner) {
                                    owner = owner || req.user;
                                    done(null, owner);
                                }).catch(function (err) {
                                    done(err, req.user);
                                });
                            },
                            function(owner, done) {

                                var newDate = new Date(project.estimatedCompletionDate);
                                newDate = newDate.setHours(newDate.getHours() - 1);
                                newDate = dateFormat(newDate, 'dddd, mmmm dS, yyyy, h:MM TT');
                                var part = '';

                                // generate email signature
                                var emailSig = '';
                                if(owner.emailSignature){
                                    emailSig = owner.emailSignature;
                                } else {
                                    emailSig = '';
                                }

                                res.render('templates/cancelled-project-email', {
                                    emailSignature: emailSig,
                                    talent: talentInfo,
                                    project: project
                                }, function(err, talentEmailHTML) {
                                    done(err, talentEmailHTML, owner);
                                });

                            },
                            // send out talent project creation email
                            function(talentEmailHTML, owner, done) {
                                // send email
                                var transporter = nodemailer.createTransport(sgTransport(config.mailer.options));
                                var emailSubject = '';
                                var newDate = new Date(project.estimatedCompletionDate);
                                newDate = newDate.setHours(newDate.getHours() - 1);
                                var nameArr = [];

                                nameArr = talentInfo.name.split(' ');

                                // assign email subject line
                                emailSubject = 'The Audition Project ' + project.title + ' Has Been Cancelled';

                                var mailOptions = {
                                    to: talentInfo.email,
                                    from: owner.email || config.mailer.from,
                                    replyTo: owner.email || config.mailer.from,
                                    cc: config.mailer.notifications,
                                    subject: emailSubject,
                                    html: talentEmailHTML
                                };

                                transporter.sendMail(mailOptions, function(err){

                                    // write change to log
                                    var log = {
                                        type: 'talent',
                                        sharedKey: selTalent.talentId,
                                        description: 'sent cancelled email for ' + project.title,
                                        user: req.user
                                    };
                                    log = new Log(log);
                                    log.save();

                                    done(err);
                                });

                            }
                            ], function(err) {
                                callback(err);
                        });

                    } else {
                        callback();
                    }

                } else {
                    callback();
                }
            });

        }, function (err) {
            if( err ) {
                return res.status(400).send({
                    message: errorHandler.getErrorMessage(err)
                });
            } else {
                // save on finish, no error
                res.jsonp(project);

            }
            });

    });

};

// send project assigned talent new emails if projects gets new scripts
exports.sendTalentScriptUpdateEmail = function(req, res){

    // pause execution for project save
    setTimeout(function() {

    var project, i;
    var projectId = req.body.projectId;
    var talents = req.body.talents;
    var chgMade = req.body.chgMade;

    // reload project
    Project.findOne({'_id':projectId}).sort('-created').then(function (project) {

        var email =  {
                            projectId: '',
                            to: [],
                            bcc: [],
                            subject: '',
                            header: '',
                            footer: '',
                            scripts: '',
                            referenceFiles: ''
                        };

        // add scripts and assets to email body
        email.scripts = '\n' + '<strong>Scripts:</strong>' + '<br>';
        if(typeof project.scripts !== 'undefined'){
            if(project.scripts.length > 0){
                for(i = 0; i < project.scripts.length; ++i){
                    email.scripts += '<a href="http://' + req.headers.host + '/res/scripts/' + project._id + '/' + project.scripts[i].file.name + '">' + project.scripts[i].file.name + '</a><br>';
                }
            } else {
                email.scripts += 'None';
            }
        } else {
            email.scripts += 'None';
        }
        email.referenceFiles = '\n' + '<strong>Reference Files:</strong>' + '<br>';
        if(typeof project.referenceFiles !== 'undefined'){
            if(project.referenceFiles.length > 0){
                for(var j = 0; j < project.referenceFiles.length; ++j){
                    email.referenceFiles += '<a href="http://' + req.headers.host + '/res/referenceFiles/' + project._id + '/' + project.referenceFiles[j].file.name + '">' + project.referenceFiles[j].file.name + '</a><br>';
                }
            } else {
                email.referenceFiles += 'None';
            }
        } else {
            email.referenceFiles += 'None';
        }

        // walk through and email all selected clients
        async.eachSeries(talents, function (selTalent, callback) {

            Talent.findOne({'_id':selTalent.talentId}).sort('-created').then(function (talentInfo) {

                // check for null talent return
                if(talentInfo !== null){

                    // filter based on current talent status
                    if(talentInfo.type.toLowerCase() === 'email'){

                        emailTalent(selTalent, talentInfo, email, project, req, res, chgMade);

                        callback();

                    } else {
                        callback();
                    }

                } else {
                    callback();
                }
            });

        }, function (err) {

            if( err ) {
                return res.status(400).send({
                    message: errorHandler.getErrorMessage(err)
                });
            } else {
                res.status(200).jsonp();
            }

        });

    });

    }, 3500);
};


// send talent project start email
exports.sendTalentEmail = function(req, res){

    var project = req.body.project;
    var talent = req.body.talent;
    var override = req.body.override || false;

    sendTalentEmail(req, res, project, talent, override);

};

// send talent director talent add email
exports.sendTalentDirectorsEmail = function(req, res){

    var project, i;
    var projectId = req.body.projectId;
    var talent = req.body.talent;
    var chgMade = req.body.chgMade;

    // reload project
    Project.findOne({'_id':projectId}).sort('-created').then(function (project) {

        // walk through and email all selected clients
        async.waterfall([
        function(done) {
            var ownerId = project.owner || project.user._id;
            User.findOne({'_id':ownerId}).sort('-created').then(function (owner) {
                owner = owner || req.user;
                done(null, owner);
            }).catch(function (err) {
                done(err, req.user);
            });
        },
        function(owner, done) {
            User.find({'roles':'talent director'}).sort('-created').then(function (talentdirectors) {
                done(null, owner, talentdirectors);
            });
        },
        function(owner, talentdirectors, done) {

            var i = 0,
                to = [];

            for(i = 0; i < talentdirectors.length; ++i){
                to.push(talentdirectors[i].email);
            }

            res.render('templates/added-talent-email', {
                project: project
            }, function(err, talentEmailHTML) {
                done(err, owner, to, talentEmailHTML);
            });

        },
        // send out talent project creation email
        function(owner, to, talentEmailHTML, done) {
            // send email
            var transporter = nodemailer.createTransport(sgTransport(config.mailer.options));
            var emailSubject = '';
            var newDate = new Date(project.estimatedCompletionDate);
            newDate = newDate.setHours(newDate.getHours() - 1);

            // assign email subject line
            emailSubject = project.title + ' - Additional Talent Added';

            if(to.length > 0){
                var mailOptions = {
                    to: to,
                    from: owner.email || config.mailer.from,
                    replyTo: owner.email || config.mailer.from,
                    cc: config.mailer.notifications,
                    subject: emailSubject,
                    html: talentEmailHTML
                };
    
                transporter.sendMail(mailOptions, function(err){
    
                    // write change to log
                    var log = {
                        type: 'project',
                        sharedKey: project._id,
                        description: 'sent talent added email for ' + project.title,
                        user: req.user
                    };
                    log = new Log(log);
                    log.save();
    
                    done(err);
                });
            } else {
                done();
            }
            
        }
        ], function(err) {
            if (err) {
                if (err) {
                    return res.status(400).json(err);
                } else {
                    return res.status(200);
                }
            }
        });

    });

};

exports.sendTalentEmailById = function(req, res){

    var projectId = req.body.projectId;
    var talent = req.body.talent;
    var override = req.body.override || false;

    async.waterfall([
        // gather info for selected talent
        function(done) {
            Project.findOne({'_id':projectId}).sort('-created').then(function (project) {
                done(null, project);
            }).catch(function (err) {
                done(err, null);
            });
        },
        function(project, done) {
            project = project.toObject();
            sendTalentEmail(req, res, project, talent, override);
        }
        ], function(err) {
        if (err) {
            return res.status(400).json(err);
        } else {
            return res.status(200);
        }
    });

};

// convert number to word
var a = ['','First ','Second ','Third ','Fourth ', 'Fifth ','Sixth ','Seventh ','Eighth ','Ninth ','Tenth ','Eleventh ','Twelfth ','Thirteenth ','Fourteenth ','Fifteenth ','Sixteenth ','Seventeenth ','Eighteenth ','Nineteenth '];
var b = ['', '', 'twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety'];

function inWords (num) {
    if ((num = num.toString()).length > 9) return 'overflow';
    var n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return; var str = '';
    // str += (n[1] !== 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) : '';
    // str += (n[2] !== 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) : '';
    // str += (n[3] !== 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]])  : '';
    // str += (n[4] !== 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) : '';
    str += a[n[5][1]];
    return str;
}

// send client email based on user button click
exports.sendClientEmail = function(req, res){

	// determine email type
	var template;
	var type = req.body.type;
	var emlCnt = req.body.count;

	switch(type){
		case 'opening':
			template = 'templates/projects/create-project-client-email';
		break;
		case 'carryover':
			template = 'templates/projects/carryover-email';
		break;
		case 'closing':
			template = 'templates/projects/closing-email';
		break;
	}


	// gather clients ids
	var clientIds = [];
	for(var i = 0; i < req.body.clients.length; ++i){
		if(typeof req.body.clients[i] !== 'undefined' && req.body.clients[i] !== null && req.body.clients[i] !== false){
			clientIds.push(req.body.clients[i]);
		}
	}

	// query required data then email clients
	User.where('_id').in(clientIds).sort('-created').then(function (foundClients) {

		// walk through and email all selected clients
		async.eachSeries(foundClients, function (foundClient, callback) {

			// wrap in anonymous function to preserve client values per iteration
			var curClient = foundClient;

			var client = {name: curClient.displayName};

			async.waterfall([
				function(done) {
					var ownerId = req.body.project.owner || req.body.project.user._id;
					User.findOne({'_id':ownerId}).sort('-created').then(function (owner) {
						done(null, owner);
					}).catch(function (err) {
						done(err, '');
					});
				},
				function(owner, done) {
					User.find({'roles':{ $in: ['producer/auditions director', 'auditions director', 'audio intern']}}).sort('-created').then(function (directors) {
						done(null, owner, directors);
					});
				},
				function(owner, directors, done) {

					var emailSig = '';
					if(owner.emailSignature){
						emailSig = owner.emailSignature;
					} else if(req.user.emailSignature){
						emailSig = req.user.emailSignature;
					} else {
						emailSig = '';
					}

					res.render(template, {
						emailSignature: emailSig,
						project: req.body.project,
						client: client,
						clientInfo: curClient,
						audURL: 'http://' + req.headers.host + '/#!/signin',
						dueDate: dateFormat(req.body.project.estimatedCompletionDate, 'dddd, mmmm dS, yyyy, h:MM TT'),
						dueDateDay: dateFormat(req.body.project.estimatedCompletionDate, 'dddd')
					}, function(err, clientEmailHTML) {
						done(err, clientEmailHTML, owner, directors);
					});

				},
				function(clientEmailHTML, owner, directors, done){

					var bccList = [];
					for(i = 0; i < directors.length; ++i){
						if(req.user.email !== directors[i].email && owner.email !== directors[i].email) {
							bccList.push(directors[i].email);
						}
					}
					// inject user and owner into bcc list
					bccList.push(req.user.email);
					bccList.push(owner.email);

					var emailSubject;

					switch(type){
						case 'opening':
							emailSubject = 'Your audition project: ' + req.body.project.title + ' Due ' + dateFormat(req.body.project.estimatedCompletionDate, 'dddd, mmmm dS, yyyy, h:MM TT') + ' EST';
						break;
						case 'carryover':
							emailSubject = 'Your '+inWords(emlCnt)+' Batch of ' + req.body.project.title + '  Auditions - Studio Center';
						break;
						case 'closing':
							emailSubject = 'Your Audition Project ' + req.body.project.title + ' is Complete';
						break;
					}

					// send email
					var transporter = nodemailer.createTransport(sgTransport(config.mailer.options));

					var mailOptions = {
										to: curClient.email,
										from: owner.email || req.user.email || config.mailer.from,
										replyTo: owner.email || req.user.email || config.mailer.from,
										cc: config.mailer.notifications,
										bcc: bccList || config.mailer.from,
										subject: emailSubject,
										html: clientEmailHTML
									};

					transporter.sendMail(mailOptions, function(err){
						// write change to log
						var log = {
							type: 'project',
							sharedKey: String(req.body.project._id),
							description: 'client ' + curClient.displayName + ' sent ' + type + ' email ' + req.body.project.title,
							user: req.user
						};
						log = new Log(log);
						log.save();

						done(err);
					});
				}
				], function(err) {
				callback(err);
			});
		}, function (err) {
			if( err ) {
				return res.status(400).send({
					message: errorHandler.getErrorMessage(err)
				});
			} else {
				return res.status(200).send();
			}
       	});

	});

};
    

// send emails from lead form
exports.lead = function(req, res){

	// if honey pot empty perform mailer, if not pretend was success anyway
	if(req.body.acomment.length == 0 && typeof req.user !== 'undefined' && req.user.roles[0] !== 'user'){

		// build email
		var emailBody = 'First Name: ' + req.body.firstName + '\n';
			emailBody += 'Last Name: ' + req.body.lastName + '\n';
			emailBody += 'Company: ' + req.body.company + '\n';
			emailBody += 'Phone: ' + req.body.phone + '\n';
			emailBody += 'Email: ' + req.body.email + '\n';
			emailBody += 'Description: ' + req.body.describe + '\n';

		//var file = req.files.file;
	var appDir = global.appRoot;

	var relativePath =  'res' + '/' + 'scripts' + '/temp/';
	var newPath = appDir + '/public/' + relativePath;

		var attachements = [];

		for(var i = 0; i < req.body.scripts.length; ++i){
			attachements[i] = {
				filename: req.body.scripts[i].file.name,
				path: newPath + req.body.scripts[i].file.name
			};
		}

		// send email
		var transporter = nodemailer.createTransport(sgTransport(config.mailer.options));
		transporter.sendMail({
			from: config.mailer.from,
			to: 'scripts@studiocenter.com, william@studiocenter.com',
			cc: config.mailer.notifications,
			subject: 'Start a new Audition Project Form Submission',
			text: emailBody,
			attachments: attachements
		});

		var uid = 'N/A';
		if(typeof req.user !== 'undefined'){
			uid = req.user._id;
		}

		// build submission object
		var sub = {
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			company: req.body.company,
			phone: req.body.phone,
			email: req.body.email,
			describe: req.body.describe
		};

		// save submission to db for later retrieval
		var newproject = {
			project: emailBody,
			sub: sub,
			attachements: req.body.scripts
		};
		newproject = new Newproject(newproject);
		newproject.save();

		// write change to log
		var log = {
			type: 'system',
			sharedKey: uid,
			description: 'new project lead submitted by ' + req.body.firstName + ' ' + req.body.lastName,
			user: req.user
		};
		log = new Log(log);
		log.save();

	}

	return res.status(200).send();
};


var emailClients = function(client, email, project, req, res){
    async.waterfall([
        function(done) {
            User.findOne({'_id':client.userId}).sort('-created').then(function (clientInfo) {
                done(null, clientInfo);
            });
        },
        function(clientInfo, done) {
            var emailSig = '';
            if(req.user.emailSignature){
                emailSig = req.user.emailSignature;
            } else {
                emailSig = '';
            }
            res.render('templates/projects/create-project-client-email', {
                email: email,
                emailSignature: emailSig,
                project: project,
                client: client,
                clientInfo: clientInfo,
                audURL: 'http://' + req.headers.host + '/#!/signin',
                dueDate: dateFormat(project.estimatedCompletionDate, 'dddd, mmmm dS, yyyy, h:MM TT')
            }, function(err, clientEmailHTML) {
                done(err, clientInfo, clientEmailHTML);
            });
        },
        function(clientInfo, clientEmailHTML, done){

            var emailSubject = 'Your audition project:  ' + project.title + ' Due ' + dateFormat(project.estimatedCompletionDate, 'dddd, mmmm dS, yyyy, h:MM TT') + ' EST';

            // send email
            var transporter = nodemailer.createTransport(sgTransport(config.mailer.options));

            var mailOptions = {
                                to: client.email,
                                from: req.user.email || config.mailer.from,
                                replyTo: req.user.email || config.mailer.from,
                                cc: config.mailer.notifications,
                                subject: emailSubject,
                                html: clientEmailHTML
                            };

            transporter.sendMail(mailOptions);

            // write change to log
            var log = {
                type: 'project',
                sharedKey: String(project._id),
                description: 'client ' + clientInfo.displayName + ' sent project created email ' + project.title,
                user: req.user
            };
            log = new Log(log);
            log.save();

        }
    ], function(err) {
        if (err) {
            return res.status(400).json(err);
        } else {
            res.status(200).jsonp();
        }
    });
};

