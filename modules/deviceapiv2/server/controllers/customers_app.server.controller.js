'use strict';
var path = require('path'),
    db = require(path.resolve('./config/lib/sequelize')),
    response = require(path.resolve("./config/responses.js")),
    authentication = require(path.resolve("./modules/deviceapiv2/server/controllers/authentication.server.controller.js")),
    nodemailer = require('nodemailer'),
    models = db.models;


/** @module color/mixer

 * @param {string} color1 - The first color, in hexidecimal format.
 * @param {string} color2 - The second color, in hexidecimal format.
 * @return {string} The blended color.
 */

exports.user_settings = function(req, res) {

    var clear_response = new response.OK();
    models.login_data.findOne({
        attributes:['id', 'customer_id', 'pin', 'show_adult', 'auto_timezone', 'timezone', 'player', 'get_messages'],
        where: {username: req.auth_obj.username}
    }).then(function (result) {
        result.timezone = (result.timezone<1) ? result.timezone : "+"+result.timezone;
        clear_response.response_object[0] = result;
        res.send(clear_response);
    }).catch(function(error) {
        console.log(error);
        res.send(response.DATABASE_ERROR); //request not executed
    });

};

exports.user_data = function(req, res) {
    var clear_response = new response.OK();

    models.login_data.findOne({
        attributes:['customer_id'],
        where: {username: req.auth_obj.username}
    }).then(function (result) {
        models.customer_data.findOne({
            attributes: ['firstname', 'lastname', 'email', 'address', 'city', 'country', 'telephone' ],
            where: {id: result.customer_id}
        }).then(function (result) {
            clear_response.response_object[0] = result;
            res.send(clear_response);
        }).catch(function(error) {
            console.log(error);
            res.send(response.DATABASE_ERROR); //request not executed
        });
        return null;
    }).catch(function(error) {
        console.log(error);
        res.send(response.DATABASE_ERROR); //request not executed
    });
};

 //API UPDATES DATA FOR THIS USER, RETURNS STATUS
exports.update_user_data = function(req, res) {

    var clear_response = new response.OK();

    models.customer_data.findOne({
        attributes:['firstname', 'lastname', 'email'],
        where: {id: req.thisuser.customer_id}
    }).then(function (customer_data) {
        models.customer_data.update(
            {
                firstname : req.body.firstname,
                lastname  : req.body.lastname,
                email     : req.body.email,
                address   : req.body.address,
                city      : req.body.city,
                country   : req.body.country,
                telephone : req.body.telephone
            },
            {
                where: {id: req.thisuser.customer_id}
            }
        ).then(function (result) {
            if(result && customer_data.email !== req.body.email){
                var email_body = 'Dear '+customer_data.firstname+' '+customer_data.lastname+', the email address associated to your Magoware account has been changed to '+req.body.email;
                var smtpConfig = {
                    host: 'smtp.gmail.com',
                    port: 465,
                    secure: true, // use SSL
                    auth: {
                        user: req.app.locals.settings.email_username,
                        pass: req.app.locals.settings.email_password
                    }
                };
                var smtpTransport = nodemailer.createTransport(smtpConfig);
                var mailOptions = {
                    from: req.app.locals.settings.email_username,
                    to: customer_data.email,
                    subject: 'Magoware email changed', // Subject line
                    text: email_body, // plaintext body
                    html: '<b>'+email_body+'</b>' // html body
                };
                smtpTransport.sendMail(mailOptions, function(error, info){
                    if(error) console.log(error);
                    else console.log('Message sent: ' + info.response);
                });
            }
            res.send(clear_response);
        }).catch(function(error) {
            console.log(error);
            res.send(response.DATABASE_ERROR); //request not executed
        });
        return null;
    }).catch(function(error) {
        console.log(error);
        res.send(response.DATABASE_ERROR); //request not executed
    });

};

//API UPDATES SETTINGS FOR THIS USER, RETURNS STATUS
exports.update_user_settings = function(req, res) {

    var clear_response = new response.OK();
    var salt = authentication.makesalt();
    var encrypted_password = authentication.encryptPassword(decodeURIComponent(req.auth_obj.password), salt);

    models.login_data.update(
        {
            password: encrypted_password,
            salt: salt,
            pin: req.body.pin,
            timezone: req.body.timezone,
            auto_timezone: req.body.auto_timezone,
            show_adult: req.body.show_adult,
            player: req.body.player,
            get_messages: req.body.get_messages
        },
        {where: {username: req.auth_obj.username}}
    ).then(function (result) {
        res.send(clear_response);
    }).catch(function(error) {
        console.log(error);
        res.send(response.DATABASE_ERROR); //request not executed
    });

};

exports.change_password = function(req, res) {
//TODO: only if auth data match proceed
    var clear_response = new response.OK();
    var salt = authentication.makesalt();
    var encrypted_password = authentication.encryptPassword(decodeURIComponent(req.body.password), salt);

    models.login_data.update(
        {
            password: encrypted_password,
            salt: salt
        },
        {where: {username: req.auth_obj.username}}
    ).then(function (result) {
        res.send(clear_response); //ok response, channel edited
    }).catch(function(error) {
        console.log(error);
        res.send(response.DATABASE_ERROR); //request not executed
    });

};

exports.reset_pin = function(req, res) {
//TODO: only if auth data match proceed
    var clear_response = new response.OK();
    clear_response.extra_data = "Your pin will be emailed in the address attached to this account!";

    models.customer_data.findOne({
        attributes:['firstname', 'lastname', 'email'],
        where: {id: req.thisuser.customer_id}
    }).then(function (result) {
        var email_body = 'Dear '+result.firstname+' '+result.lastname+', your current pin is '+req.thisuser.pin;
        var smtpConfig = {
            host: 'smtp.gmail.com',
            port: 465,
            secure: true, // use SSL
            auth: {
                user: req.app.locals.settings.email_username,
                pass: req.app.locals.settings.email_password
            }
        };
        var smtpTransport = nodemailer.createTransport(smtpConfig);
        var mailOptions = {
            from: req.app.locals.settings.email_username,
            to: result.email,
            subject: 'Pin information', // Subject line
            text: email_body, // plaintext body
            html: '<b>'+email_body+'</b>' // html body
        };
        smtpTransport.sendMail(mailOptions, function(error, info){
            if(error) console.log(error);
            else console.log('Message sent: ' + info.response);
        });
        res.send(clear_response);
    }).catch(function(error) {
        console.log(error);
        res.send(response.DATABASE_ERROR); //error in reading the user info
    });
};

//API GETS SUBSCRIPTION DATA
exports.subscription = function(req, res) {
    var clear_response = new response.OK();

    models.subscription.findAll({
        attributes: ['id', [db.sequelize.fn('date_format', db.sequelize.col('start_date'), '%Y-%m-%d %H:%m:%s'), 'start_date'],
            [db.sequelize.fn('date_format', db.sequelize.col('end_date'), '%Y-%m-%d %H:%m:%s'), 'end_date']],
        where: {customer_username: req.auth_obj.username},
        include: [{model: models.package, required: true, attributes:['package_name']}]
    }).then(function (result) {
        if(result[0].length == 0){
            clear_response.extra_data = "No subscriptions for this user";
            res.send(clear_response);
        }
        else{
            //the following loop avoids nested response
            var subscription = []; //temp array where we store the values of the query
            for(var i = 0; i < result.length; i++){
                //for each object we store its values in a temp variable
                var temp_subscription_record = {
                    "package_name": result[i].package.package_name,
                    "start_date": result[i].start_date,
                    "end_date": result[i].end_date
                };
                subscription.push(temp_subscription_record); //the object is pushed to the temp array
            }
            clear_response.response_object = subscription;
            res.send(clear_response);
        }

    }).catch(function(error) {
        console.log(error);
        res.send(response.DATABASE_ERROR); //request not executed
    });

 };

 
//API GETS SALEREPORT DATA
exports.salereport = function(req, res) {

    var clear_response = new response.OK();

    models.salesreport.findAll({
        attributes: ['user_username', 'distributorname', [db.sequelize.fn('date_format', db.sequelize.col('saledate'), '%Y-%m-%d %H:%m:%s'), 'saledate']],
        where: {user_username: req.auth_obj.username},
        include: [{model: models.combo, required: true, attributes:['duration', 'name']}]
    }).then(function (result) {
        //the following loop avoids nested response
        var salereport = []; //temp array where we store the values of the query
        for(var i = 0; i < result.length; i++){
            //for each objevt we store its values in a temp variable
            var temp_salereport_record = {
                "user_username": result[i].user_username,
                "distributorname": result[i].distributorname,
                "sale_date": result[i].saledate,
                "combo_name": result[i].combo.name,
                "combo_duration": result[i].combo.duration
            };
            salereport.push(temp_salereport_record); //the object is pushed to the temp array
        }
        clear_response.response_object = salereport;
        res.send(clear_response);
    }).catch(function(error) {
        console.log(error);
        res.send(response.DATABASE_ERROR); //request not executed
    });

 };
 


/*******************************************************************
  		Listing, adding, editing and deleting user channels
  *******************************************************************/
exports.add_channel = function(req, res) {

    var clear_response = new response.OK();
    models.login_data.findOne({
        attributes:['id'],
        where: {username: req.auth_obj.username}
    }).then(function (result) {
        models.my_channels.create({
            channel_number: 66666, login_id: result.id, title: req.body.title , description: req.body.description, icon_url: '/images/do_not_delete/mago_logo.png', stream_url: req.body.stream , isavailable: 1
        }).then(function (result) {
            var new_channel_number = result.id + 999; //smallest channel number will be 1000 (for id 0). This way conflicts are avoided with normal channel numbers, which are <= 999
            models.my_channels.update(
                {
                    channel_number: new_channel_number //set channel number equal to the unique number we created
                },
                {
                    where: {id: result.id} //for the recently added channel
                }
            ).then(function (result) {
                res.send(clear_response);
            }).catch(function(error) {
                console.log(error);
                res.send(response.DATABASE_ERROR); //request not executed
            });
            return null;
        }).catch(function(error) {
            console.log(error);
            res.send(response.DATABASE_ERROR); //request not executed
        });
        return null;
    }).catch(function(error) {
        console.log(error);
        res.send(response.DATABASE_ERROR); //request not executed
    });
};

//LIST QUERY. GET METHOD. No explicit parameter
exports.channel_list = function(req, res) {

    var clear_response = new response.OK();

    models.login_data.findOne({
        attributes:['id'],
        where: {username: req.auth_obj.username}
    }).then(function (result) {
        models.my_channels.findAll({
            attributes: ['channel_number', 'title', 'description', [db.sequelize.fn("concat", req.app.locals.settings.assets_url, db.sequelize.col('icon_url')), 'icon_url'], 'stream_url', 'isavailable'],
            where: {login_id: result.id}
        }).then(function (result) {
            clear_response.response_object = result;
            res.send(clear_response);
        }).catch(function(error) {
            console.log(error);
            res.send(response.DATABASE_ERROR); //request not executed
        });
        return null;
    }).catch(function(error) {
        console.log(error);
        res.send(response.DATABASE_ERROR); //request not executed
    });

};

//DELETE QUERY. PUT METHOD. channel_number as parameter
exports.delete_channel = function(req, res) {

    var clear_response = new response.OK();
    models.my_channels.destroy({
		where: {channel_number: req.body.channel_number}
	}).then(function (result) {
        res.send(clear_response); //ok response, channel deleted
	}).catch(function(error) {
		console.log(error);
        res.send(response.DATABASE_ERROR); //request not executed
	});

};

exports.edit_channel = function(req, res) {

    var clear_response = new response.OK();
	models.my_channels.update(
	{
		title: req.body.title,
		description: req.body.description,
		stream_url: req.body.stream_url
	},
		{where: {channel_number: req.body.channel_number}}
	).then(function (result) {
		res.send(clear_response); //ok response, channel edited
	}).catch(function(error) {
		console.log(error);
        res.send(response.DATABASE_ERROR); //request not executed
	});

};

